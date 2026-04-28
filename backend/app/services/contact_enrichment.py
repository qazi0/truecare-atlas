"""Optional contact enrichment via Tavily search."""

import re

from app.schemas import ContactEnrichment, ContactLink, FacilityFull
from app.settings import settings

_EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
_PHONE_RE = re.compile(r"(?:\+?91[-\s]?)?[6-9]\d{9}")


def enrich_facility_contact(facility: FacilityFull) -> ContactEnrichment:
    if not settings.tavily_api_key:
        return ContactEnrichment(
            facility_id=facility.facility_id,
            query=_query_for_facility(facility),
            snippets=["Tavily enrichment is not configured. Set TM_TAVILY_API_KEY on the backend."],
        )

    try:
        from tavily import TavilyClient
    except Exception:
        return ContactEnrichment(
            facility_id=facility.facility_id,
            query=_query_for_facility(facility),
            snippets=["tavily-python is not installed in the active backend environment."],
        )

    query = _query_for_facility(facility)
    client = TavilyClient(settings.tavily_api_key)
    try:
        response = client.search(query=query, search_depth="advanced", max_results=5)
    except Exception as exc:
        return ContactEnrichment(
            facility_id=facility.facility_id,
            query=query,
            snippets=[f"Tavily enrichment request failed: {exc}"],
        )
    results = response.get("results", []) if isinstance(response, dict) else []
    links: list[ContactLink] = []
    snippets: list[str] = []
    sources: list[str] = []

    for result in results:
        if not isinstance(result, dict):
            continue
        url = str(result.get("url") or "").strip()
        content = str(result.get("content") or result.get("title") or "").strip()
        if url:
            sources.append(url)
            kind, label = _kind_for_url(url)
            links.append(ContactLink(kind=kind, label=label, url=url))
        if content:
            snippets.append(content[:360])
            for email in _EMAIL_RE.findall(content):
                links.append(ContactLink(kind="email", label="Email", url=f"mailto:{email}"))
            for phone in _PHONE_RE.findall(content):
                links.append(ContactLink(kind="phone", label="Phone", url=f"tel:{phone}"))

    return ContactEnrichment(
        facility_id=facility.facility_id,
        query=query,
        found_contacts=_dedupe_links(links),
        snippets=snippets[:5],
        sources=list(dict.fromkeys(sources))[:5],
    )


def _query_for_facility(facility: FacilityFull) -> str:
    parts = [facility.name, facility.city, facility.state, facility.pincode, "official website phone email"]
    return " ".join(str(part) for part in parts if part)


def _kind_for_url(url: str) -> tuple[str, str]:
    lower = url.lower()
    if "facebook.com" in lower:
        return "facebook", "Facebook"
    if "instagram.com" in lower:
        return "instagram", "Instagram"
    if "linkedin.com" in lower:
        return "linkedin", "LinkedIn"
    if "twitter.com" in lower or "x.com" in lower:
        return "twitter", "X / Twitter"
    return "website", "Website"


def _dedupe_links(links: list[ContactLink]) -> list[ContactLink]:
    seen: set[str] = set()
    unique: list[ContactLink] = []
    for link in links:
        key = link.url.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(link)
    return unique[:10]
