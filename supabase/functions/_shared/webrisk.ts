// supabase/functions/_shared/webrisk.ts
export async function webRiskLookup(url: string) {
  const apiKey = Deno.env.get("GOOGLE_WEBRISK_API_KEY");
  if (!apiKey) throw new Error("Missing GOOGLE_WEBRISK_API_KEY secret");

  const params = new URLSearchParams();
  params.set("uri", url);

  // Web Risk Lookup: threatTypes típicos
  for (const t of ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"]) {
    params.append("threatTypes", t);
  }

  params.set("key", apiKey);

  const endpoint = `https://webrisk.googleapis.com/v1/uris:search?${params.toString()}`;
  const res = await fetch(endpoint);
  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(`WebRisk HTTP ${res.status}: ${rawText}`);
  }

  const json = rawText ? JSON.parse(rawText) : {};
  const threatTypes: string[] = json?.threat?.threatTypes ?? [];
  return { threatTypes, raw: json };
}
