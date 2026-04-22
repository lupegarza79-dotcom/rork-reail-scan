export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return Response.json({ error: "Missing URL" }, { status: 400 });
    }

    const parsed = new URL(url);
    const domain = parsed.hostname.toLowerCase();
    const isHttps = parsed.protocol === "https:";

    let score = 70;

    if (!isHttps) score -= 30;

    if (
      domain.includes("login") ||
      domain.includes("verify") ||
      domain.includes("secure") ||
      domain.includes("account")
    ) {
      score -= 15;
    }

    if (
      domain.includes("amaz0n") ||
      domain.includes("paypaI") ||
      domain.includes("waImart") ||
      domain.includes("micr0soft")
    ) {
      score -= 40;
    }

    let verdict: "SAFE" | "CAUTION" | "DANGER" = "SAFE";

    if (score < 60) verdict = "CAUTION";
    if (score < 40) verdict = "DANGER";

    return Response.json({
      ok: true,
      input: url,
      domain,
      isHttps,
      score,
      verdict,
      reasons: [
        !isHttps ? "Connection is not HTTPS" : "HTTPS detected",
        domain.includes("login") || domain.includes("verify")
          ? "Suspicious keyword in domain"
          : "No suspicious keyword in domain",
      ],
    });
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }
}
