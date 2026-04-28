import { BACKEND_URL, backendHeaders } from "@/lib/backend";
import type { ContactEnrichment, FacilityFull } from "@/lib/types";

const TAVILY_API_KEY =
  process.env.TAVILY_API_KEY ??
  process.env.TM_TAVILY_API_KEY;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?91[-\s]?)?[6-9]\d{9}/g;

type TavilyResult = {
  url?: string;
  content?: string;
  title?: string;
};

function queryForFacility(facility: FacilityFull): string {
  const parts = [
    facility.name,
    facility.city,
    facility.state,
    facility.pincode,
    "official website phone email",
  ];
  return parts.filter(Boolean).join(" ");
}

function kindForUrl(url: string): { kind: string; label: string } {
  const lower = url.toLowerCase();
  if (lower.includes("facebook.com")) return { kind: "facebook", label: "Facebook" };
  if (lower.includes("instagram.com")) return { kind: "instagram", label: "Instagram" };
  if (lower.includes("linkedin.com")) return { kind: "linkedin", label: "LinkedIn" };
  if (lower.includes("twitter.com") || lower.includes("x.com")) return { kind: "twitter", label: "X / Twitter" };
  return { kind: "website", label: "Website" };
}

function dedupeLinks(links: ContactEnrichment["found_contacts"]): ContactEnrichment["found_contacts"] {
  const seen = new Set<string>();
  const unique: ContactEnrichment["found_contacts"] = [];
  for (const link of links) {
    const key = link.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(link);
  }
  return unique.slice(0, 10);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const facilityResp = await fetch(
    `${BACKEND_URL}/api/facility/${encodeURIComponent(id)}`,
    {
      headers: await backendHeaders({ Accept: "application/json" }),
      cache: "no-store",
    },
  );

  const facilityData = await facilityResp.json();
  if (!facilityResp.ok) {
    return Response.json(facilityData, { status: facilityResp.status });
  }

  const facility = facilityData as FacilityFull;
  const query = queryForFacility(facility);

  if (!TAVILY_API_KEY) {
    return Response.json(
      {
        facility_id: id,
        query,
        found_contacts: [],
        snippets: ["Tavily enrichment is not configured on the frontend route."],
        sources: [],
      } satisfies ContactEnrichment,
    );
  }

  try {
    const tavilyResp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        max_results: 5,
      }),
      cache: "no-store",
    });

    if (!tavilyResp.ok) {
      return Response.json(
        {
          facility_id: id,
          query,
          found_contacts: [],
          snippets: [`Tavily request failed with HTTP ${tavilyResp.status}.`],
          sources: [],
        } satisfies ContactEnrichment,
      );
    }

    const payload = (await tavilyResp.json()) as { results?: TavilyResult[] };
    const results = Array.isArray(payload.results) ? payload.results : [];
    const foundContacts: ContactEnrichment["found_contacts"] = [];
    const snippets: string[] = [];
    const sources: string[] = [];

    for (const result of results) {
      const url = String(result.url ?? "").trim();
      const content = String(result.content ?? result.title ?? "").trim();

      if (url) {
        const { kind, label } = kindForUrl(url);
        sources.push(url);
        foundContacts.push({ kind, label, url });
      }

      if (content) {
        snippets.push(content.slice(0, 360));
        for (const email of content.match(EMAIL_RE) ?? []) {
          foundContacts.push({ kind: "email", label: "Email", url: `mailto:${email}` });
        }
        for (const phone of content.match(PHONE_RE) ?? []) {
          foundContacts.push({ kind: "phone", label: "Phone", url: `tel:${phone}` });
        }
      }
    }

    return Response.json({
      facility_id: id,
      query,
      found_contacts: dedupeLinks(foundContacts),
      snippets: snippets.slice(0, 5),
      sources: Array.from(new Set(sources)).slice(0, 5),
    } satisfies ContactEnrichment);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Tavily request failure";
    return Response.json({
      facility_id: id,
      query,
      found_contacts: [],
      snippets: [`Tavily enrichment request failed: ${message}`],
      sources: [],
    } satisfies ContactEnrichment);
  }
}
