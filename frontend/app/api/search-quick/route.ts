import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";
import type { FacilityHit } from "@/lib/types";

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

  if (strictMatches.length > 0) return strictMatches.slice(0, 20);

  return Array.from(byId.values())
    .sort((a, b) => b.matches - a.matches)
    .map(({ hit }) => hit)
    .slice(0, 20);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const k = searchParams.get("k") ?? "20";

  const backendResp = await fetchQuickSearch(q, k);

  const data = await backendResp.json();
  if (backendResp.ok && Array.isArray(data) && data.length === 0) {
    const fallback = await fallbackMultiTermSearch(q);
    if (fallback.length > 0) {
      return Response.json(fallback);
    }
  }

  return Response.json(data, { status: backendResp.status });
}
