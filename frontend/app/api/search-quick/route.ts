import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";
import type { FacilityHit } from "@/lib/types";

const CAPABILITY_QUERY: Record<string, keyof NonNullable<FacilityHit["capabilities"]>> = {
  nicu: "has_nicu",
  icu: "has_icu",
  dialysis: "has_dialysis",
  oncology: "has_oncology",
  maternity: "has_maternity",
  trauma: "has_trauma",
};

const STATE_HINTS = [
  "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh",
  "delhi", "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand",
  "karnataka", "kerala", "madhya pradesh", "maharashtra", "manipur",
  "meghalaya", "mizoram", "nagaland", "odisha", "punjab", "rajasthan",
  "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh",
  "uttarakhand", "west bengal", "puducherry",
];

async function fetchQuickSearch(q: string, k: string): Promise<Response> {
  return fetch(
    `${BACKEND_URL}/api/search-quick?q=${encodeURIComponent(q)}&k=${encodeURIComponent(k)}`,
    { headers: await backendHeaders({ Accept: "application/json" }) }
  );
}

function textForHit(hit: FacilityHit): string {
  const capabilityText = hit.capabilities?.capabilities_caption ?? "";
  return [
    hit.name,
    hit.city,
    hit.state,
    hit.pincode,
    hit.facility_type,
    capabilityText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

async function fallbackMultiTermSearch(q: string): Promise<FacilityHit[]> {
  const terms = q
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);

  if (terms.length < 2) return [];

  const results = await Promise.all(
    terms.map(async (term) => {
      const resp = await fetchQuickSearch(term, "50");
      if (!resp.ok) return [];
      const data = await resp.json();
      return Array.isArray(data) ? (data as FacilityHit[]) : [];
    })
  );

  const byId = new Map<string, { hit: FacilityHit; matches: number }>();
  for (const hits of results) {
    for (const hit of hits) {
      const entry = byId.get(hit.facility_id) ?? { hit, matches: 0 };
      entry.matches += 1;
      byId.set(hit.facility_id, entry);
    }
  }

  const strictMatches = Array.from(byId.values())
    .filter(({ hit, matches }) => {
      const haystack = textForHit(hit);
      return matches > 1 || terms.every((term) => haystack.includes(term));
    })
    .map(({ hit }) => hit);

  const looseMatches = Array.from(byId.values())
    .sort((a, b) => b.matches - a.matches)
    .map(({ hit }) => hit);

  if (strictMatches.length > 0) {
    const merged = new Map<string, FacilityHit>();
    for (const hit of strictMatches) merged.set(hit.facility_id, hit);
    for (const hit of looseMatches) merged.set(hit.facility_id, hit);
    return Array.from(merged.values()).slice(0, 20);
  }

  return looseMatches.slice(0, 20);
}

function scoreHit(hit: FacilityHit, q: string): number {
  const query = q.toLowerCase();
  const haystack = textForHit(hit);
  const capKey = Object.entries(CAPABILITY_QUERY).find(([term]) => query.includes(term))?.[1];
  const capability = capKey && hit.capabilities ? hit.capabilities[capKey] : null;
  const capabilityMatch = Boolean(
    capability && typeof capability === "object" && "value" in capability && capability.value,
  );
  const stateHint = STATE_HINTS.find((state) => query.includes(state));
  const regionMatch = stateHint ? hit.state?.toLowerCase() === stateHint : true;
  const terms = query.split(/\s+/).filter((term) => term.length >= 3);
  const termMatches = terms.filter((term) => haystack.includes(term)).length;
  return (
    (capabilityMatch ? 1_000_000 : 0) +
    (regionMatch ? 100_000 : 0) +
    termMatches * 1_000 +
    (hit.trust_score ?? 0)
  );
}

function rankHits(hits: FacilityHit[], q: string): FacilityHit[] {
  return [...hits].sort((a, b) => {
    const byScore = scoreHit(b, q) - scoreHit(a, q);
    if (byScore !== 0) return byScore;
    return (b.trust_score ?? 0) - (a.trust_score ?? 0);
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const k = searchParams.get("k") ?? "20";
  const target = Number.parseInt(k, 10) || 20;

  const backendResp = await fetchQuickSearch(q, k);

  const data = await backendResp.json();
  if (backendResp.ok && Array.isArray(data) && data.length < Math.min(target, 12)) {
    const fallback = await fallbackMultiTermSearch(q);
    if (fallback.length > 0) {
      const merged = new Map<string, FacilityHit>();
      for (const hit of data as FacilityHit[]) merged.set(hit.facility_id, hit);
      for (const hit of fallback) merged.set(hit.facility_id, hit);
      return Response.json(rankHits(Array.from(merged.values()), q).slice(0, target));
    }
  }

  return Response.json(Array.isArray(data) ? rankHits(data, q) : data, { status: backendResp.status });
}
