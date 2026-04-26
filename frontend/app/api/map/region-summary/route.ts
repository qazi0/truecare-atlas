import { NextRequest } from "next/server";
import { BACKEND_URL, backendHeaders } from "@/lib/backend";
import type { AggregateRowWithCI, FacilityHit, FacilityPoint, RegionSummary } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") ?? "Bihar";
  const capability = searchParams.get("capability") ?? "has_nicu";
  const headers = await backendHeaders({ Accept: "application/json" });
  const resp = await fetch(
    `${BACKEND_URL}/api/map/region-summary?region=${encodeURIComponent(region)}&capability=${encodeURIComponent(capability)}`,
    { headers },
  );
  if (!resp.ok && resp.status === 404) {
    return Response.json(await fallbackRegionSummary(region, capability, headers));
  }
  const data = await resp.json();
  return Response.json(data, { status: resp.status });
}

async function fallbackRegionSummary(region: string, capability: string, headers: HeadersInit): Promise<RegionSummary> {
  const [aggregates, facilities] = await Promise.all([
    fetch(`${BACKEND_URL}/api/map/aggregates/ci?capability=${encodeURIComponent(capability)}&level=state`, { headers })
      .then((r) => r.ok ? r.json() : []),
    fetch(`${BACKEND_URL}/api/map/facilities?capability=${encodeURIComponent(capability)}&verified_only=false&show_review_needed=true`, { headers })
      .then((r) => r.ok ? r.json() : []),
  ]);
  return buildRegionSummary(
    region,
    capability,
    Array.isArray(aggregates) ? aggregates : [],
    Array.isArray(facilities) ? facilities : [],
  );
}

function buildRegionSummary(
  region: string,
  capability: string,
  aggregates: AggregateRowWithCI[],
  facilities: FacilityPoint[],
): RegionSummary {
  const aggregate = aggregates.find((row) => row.region_name === region);
  const regionFacilities = facilities.filter((facility) => facility.state === region);
  const top_facilities: FacilityHit[] = regionFacilities
    .slice()
    .sort((a, b) => (b.trust_score ?? 0) - (a.trust_score ?? 0))
    .slice(0, 5)
    .map((facility) => ({
      facility_id: facility.facility_id,
      name: facility.name,
      city: facility.city,
      state: facility.state,
      pincode: null,
      latitude: facility.lat,
      longitude: facility.lng,
      facility_type: facility.type,
      trust_score: facility.trust_score,
      distance_km: null,
      capabilities: null,
      flag_count: facility.flag_count,
      has_contradiction: facility.has_contradiction,
      trust_status: facility.trust_status,
    }));

  return {
    region,
    capability,
    claimed_count: aggregate?.claimed_count ?? regionFacilities.length,
    verified_count: aggregate?.verified_count ?? regionFacilities.filter((facility) => facility.trust_status === "Verified").length,
    needs_review_count: regionFacilities.filter((facility) => facility.trust_status !== "Verified").length,
    contradiction_count: regionFacilities.filter((facility) => facility.has_contradiction).length,
    ci_lower: aggregate?.ci_lower ?? null,
    ci_upper: aggregate?.ci_upper ?? null,
    verification_rate: aggregate?.verification_rate ?? null,
    top_facilities,
  };
}
