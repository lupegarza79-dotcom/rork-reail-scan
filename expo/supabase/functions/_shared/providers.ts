export interface ProviderResult {
  provider: string;
  provider_label: string;
  status: "pass" | "warn" | "fail" | "unknown";
  summary: string;
  weight: number;
  score_impact: number;
  payload: Record<string, unknown>;
}

export async function runProvider(
  providerName: string,
  fn: () => Promise<ProviderResult>,
  telemetry: Record<string, unknown>[],
  endpoint: string,
  deviceId: string,
  ip: string,
): Promise<ProviderResult> {
  const start = Date.now();
  try {
    const result = await fn();
    telemetry.push({
      endpoint,
      event_type: "provider",
      provider: providerName,
      latency_ms: Date.now() - start,
      status: "ok",
      success: true,
      device_id: deviceId,
      ip,
    });
    return result;
  } catch (error) {
    console.error(`[Provider] ${providerName} failed (fail-soft):`, error);
    telemetry.push({
      endpoint,
      event_type: "provider",
      provider: providerName,
      latency_ms: Date.now() - start,
      status: "error",
      success: false,
      error_code: (error as any)?.code ?? "PROVIDER_ERROR",
      device_id: deviceId,
      ip,
    });
    return {
      provider: providerName,
      provider_label: providerName,
      status: "unknown",
      summary: `Provider ${providerName} unavailable`,
      weight: 0,
      score_impact: 0,
      payload: { error: "provider_failure", provider: providerName },
    };
  }
}

export async function analyzeUrlscanIo(url: string): Promise<ProviderResult> {
  const apiKey = Deno.env.get("URLSCAN_API_KEY");
  if (!apiKey) {
    return {
      provider: "urlscan_io", provider_label: "urlscan.io",
      status: "unknown", summary: "urlscan.io not configured", weight: 0, score_impact: 0,
      payload: { configured: false },
    };
  }

  try {
    console.log("[urlscan.io] Searching:", url);
    const searchResp = await fetch(
      `https://urlscan.io/api/v1/search/?q=page.url:"${encodeURIComponent(url)}"&size=1`,
      {
        headers: { "API-Key": apiKey },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!searchResp.ok) {
      console.log("[urlscan.io] Search API error:", searchResp.status);
      return {
        provider: "urlscan_io", provider_label: "urlscan.io",
        status: "unknown", summary: "urlscan.io API error", weight: 0, score_impact: 0,
        payload: { configured: true, apiError: searchResp.status },
      };
    }

    const searchData = await searchResp.json();
    const results = searchData?.results || [];

    if (results.length === 0) {
      const submitResp = await fetch("https://urlscan.io/api/v1/scan/", {
        method: "POST",
        headers: { "API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ url, visibility: "unlisted" }),
        signal: AbortSignal.timeout(8000),
      });
      if (submitResp.ok) {
        return {
          provider: "urlscan_io", provider_label: "urlscan.io",
          status: "unknown", summary: "URL submitted to urlscan.io (pending analysis)", weight: 0, score_impact: 0,
          payload: { configured: true, pending: true },
        };
      }
      return {
        provider: "urlscan_io", provider_label: "urlscan.io",
        status: "unknown", summary: "No urlscan.io data available", weight: 0, score_impact: 0,
        payload: { configured: true, noData: true },
      };
    }

    const latest = results[0];
    const verdicts = latest?.verdicts || {};
    const overall = verdicts?.overall || {};
    const malicious = overall?.malicious === true;
    const score = overall?.score ?? 0;
    const categories = overall?.categories || [];
    const tags = latest?.tags || [];

    if (malicious || score >= 70) {
      return {
        provider: "urlscan_io", provider_label: "urlscan.io",
        status: "fail",
        summary: `urlscan.io flags as malicious (score: ${score})${categories.length ? `: ${categories.join(", ")}` : ""}`,
        weight: 12, score_impact: -20,
        payload: { configured: true, malicious, score, categories, tags, resultUrl: latest?._id ? `https://urlscan.io/result/${latest._id}/` : null },
      };
    }

    if (score >= 40 || tags.some((t: string) => /phish|scam|malware/i.test(t))) {
      return {
        provider: "urlscan_io", provider_label: "urlscan.io",
        status: "warn",
        summary: `urlscan.io suspicious (score: ${score})${tags.length ? `, tags: ${tags.slice(0, 3).join(", ")}` : ""}`,
        weight: 12, score_impact: -10,
        payload: { configured: true, malicious, score, categories, tags },
      };
    }

    return {
      provider: "urlscan_io", provider_label: "urlscan.io",
      status: "pass", summary: `Clean on urlscan.io (score: ${score})`, weight: 12, score_impact: 3,
      payload: { configured: true, malicious: false, score, categories, tags },
    };
  } catch (e) {
    console.log("[urlscan.io] Error:", e);
    return {
      provider: "urlscan_io", provider_label: "urlscan.io",
      status: "unknown", summary: "urlscan.io check failed", weight: 0, score_impact: 0,
      payload: { configured: true, error: String(e) },
    };
  }
}

export async function analyzeUrlhaus(url: string): Promise<ProviderResult> {
  try {
    console.log("[URLhaus] Checking:", url);
    const resp = await fetch("https://urlhaus-api.abuse.ch/v1/url/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `url=${encodeURIComponent(url)}`,
      signal: AbortSignal.timeout(6000),
    });

    if (!resp.ok) {
      console.log("[URLhaus] API error:", resp.status);
      return {
        provider: "urlhaus", provider_label: "URLhaus (abuse.ch)",
        status: "unknown", summary: "URLhaus API error", weight: 0, score_impact: 0,
        payload: { apiError: resp.status },
      };
    }

    const data = await resp.json();
    const queryStatus = data?.query_status;

    if (queryStatus === "no_results") {
      return {
        provider: "urlhaus", provider_label: "URLhaus (abuse.ch)",
        status: "pass", summary: "Not listed in URLhaus threat database", weight: 10, score_impact: 3,
        payload: { listed: false },
      };
    }

    if (queryStatus === "ok" || data?.url_status) {
      const urlStatus = data?.url_status || "unknown";
      const threat = data?.threat || "unknown";
      const tags = data?.tags || [];
      const dateAdded = data?.date_added || null;

      if (urlStatus === "online") {
        return {
          provider: "urlhaus", provider_label: "URLhaus (abuse.ch)",
          status: "fail",
          summary: `Active threat in URLhaus: ${threat}${tags.length ? ` [${tags.join(", ")}]` : ""}`,
          weight: 10, score_impact: -25,
          payload: { listed: true, urlStatus, threat, tags, dateAdded },
        };
      }

      return {
        provider: "urlhaus", provider_label: "URLhaus (abuse.ch)",
        status: "warn",
        summary: `Previously listed in URLhaus (${urlStatus}): ${threat}`,
        weight: 10, score_impact: -10,
        payload: { listed: true, urlStatus, threat, tags, dateAdded },
      };
    }

    return {
      provider: "urlhaus", provider_label: "URLhaus (abuse.ch)",
      status: "pass", summary: "Not found in URLhaus database", weight: 10, score_impact: 2,
      payload: { listed: false, queryStatus },
    };
  } catch (e) {
    console.log("[URLhaus] Error:", e);
    return {
      provider: "urlhaus", provider_label: "URLhaus (abuse.ch)",
      status: "unknown", summary: "URLhaus check failed", weight: 0, score_impact: 0,
      payload: { error: String(e) },
    };
  }
}

export async function analyzeOpenPhish(url: string): Promise<ProviderResult> {
  try {
    console.log("[OpenPhish] Checking against feed");
    const resp = await fetch("https://openphish.com/feed.txt", {
      signal: AbortSignal.timeout(6000),
    });

    if (!resp.ok) {
      return {
        provider: "openphish", provider_label: "OpenPhish",
        status: "unknown", summary: "OpenPhish feed unavailable", weight: 0, score_impact: 0,
        payload: { apiError: resp.status },
      };
    }

    const feedText = await resp.text();
    const normalizedUrl = url.toLowerCase().replace(/\/+$/, "");
    const lines = feedText.split("\n").map((l) => l.trim().toLowerCase().replace(/\/+$/, ""));
    const found = lines.some((line) => line && (normalizedUrl.startsWith(line) || line.startsWith(normalizedUrl)));

    if (found) {
      return {
        provider: "openphish", provider_label: "OpenPhish",
        status: "fail", summary: "URL found in OpenPhish active phishing feed", weight: 10, score_impact: -25,
        payload: { listed: true },
      };
    }

    return {
      provider: "openphish", provider_label: "OpenPhish",
      status: "pass", summary: "Not listed in OpenPhish feed", weight: 10, score_impact: 2,
      payload: { listed: false },
    };
  } catch (e) {
    console.log("[OpenPhish] Error:", e);
    return {
      provider: "openphish", provider_label: "OpenPhish",
      status: "unknown", summary: "OpenPhish check failed", weight: 0, score_impact: 0,
      payload: { error: String(e) },
    };
  }
}
