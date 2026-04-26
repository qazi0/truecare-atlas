"use client";

/* eslint-disable react/no-unescaped-entities */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, AlertOctagon, ArrowLeft, ClipboardList, Download, ExternalLink, Globe, Loader2, Mail, MapPin, Microscope, Phone, Plus, ShieldCheck, Stethoscope } from "lucide-react";
import { AppShell, Breadcrumbs, CapabilityBadge, EmptyState, StatusBadge, TrustRing } from "@/components/atlas/primitives";
import { EvidenceLedgerButton } from "@/components/evidence-ledger";
import { Button } from "@/components/ui/button";
import { activeEvidenceRows, addToShortlist, deriveStatus, formatLocation, trustFlagTitle } from "@/lib/atlas";
import type { ContactEnrichment, ContactLink, FacilityFull, ValidatorResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = ["Overview", "Capabilities", "Trust Audit", "Validation", "Source Evidence", "Raw Record", "Trace"] as const;
type Tab = typeof TABS[number];

export default function FacilityPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [facility, setFacility] = useState<FacilityFull | null>(null);
  const [validation, setValidation] = useState<ValidatorResult | null>(null);
  const [enrichment, setEnrichment] = useState<ContactEnrichment | null>(null);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [rawRecord, setRawRecord] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");

  useEffect(() => {
    fetch(`/api/facility?id=${encodeURIComponent(id)}`).then((r) => r.ok ? r.json() : null).then(setFacility).catch(() => null);
    fetch(`/api/validate?id=${encodeURIComponent(id)}`).then((r) => r.ok ? r.json() : null).then(setValidation).catch(() => null);
  }, [id]);

  useEffect(() => {
    if (tab !== "Raw Record" || rawRecord) return;
    fetch(`/api/facility/${encodeURIComponent(id)}/raw-record`)
      .then((r) => r.ok ? r.json() : null)
      .then(setRawRecord)
      .catch(() => null);
  }, [id, rawRecord, tab]);

  if (!facility) return <AppShell><FacilitySkeleton id={id} /></AppShell>;

  const rows = activeEvidenceRows(facility);
  const status = deriveStatus(facility);
  const contradiction = status === "Contradiction" || facility.trust_report?.flags.some((f) => f.severity === "red");

  return (
    <AppShell>
      <div className="border-b hairline bg-background">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Link href="/command" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back</Link>
          <Breadcrumbs items={[{ label: "Smart Search", to: "/command" }, { label: facility.name }]} />
        </div>
      </div>
      <header className="border-b hairline bg-surface">
        <div className="flex flex-wrap items-start gap-5 px-6 py-5">
          <TrustRing score={facility.trust_score} status={status} size={84} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-[22px] font-semibold tracking-tight">{facility.name}</h1><StatusBadge status={status} /></div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {formatLocation(facility)}</span><span className="h-3 w-px bg-hairline" /><span>{facility.facility_type || "Facility"}</span><span className="h-3 w-px bg-hairline" /><span className="font-mono">id {facility.facility_id}</span></div>
            <div className="mt-3 flex flex-wrap gap-1">{rows.slice(0, 8).map((row) => <CapabilityBadge key={row.key} label={row.label} />)}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="h-8 text-[12px]" onClick={() => addToShortlist(facility.facility_id)}><Plus className="h-3.5 w-3.5" /> Shortlist</Button>
            <Button size="sm" variant="outline" className="h-8 text-[12px]"><ShieldCheck className="h-3.5 w-3.5" /> Validate</Button>
            <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => exportFacility(facility.facility_id)}><Download className="h-3.5 w-3.5" /> Export</Button>
            <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => createReview(facility)}><AlertOctagon className="h-3.5 w-3.5" /> Review</Button>
          </div>
        </div>
        <div className="px-6"><div className="-mb-px flex overflow-x-auto">{TABS.map((item) => <button key={item} onClick={() => setTab(item)} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-[12px] font-medium", tab === item ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{item}</button>)}</div></div>
      </header>
      <div className="grid flex-1 grid-cols-1 gap-5 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {contradiction && <div className="mb-5 rounded-lg border border-alert/30 bg-alert-soft p-4 text-[13px] text-alert"><AlertOctagon className="mr-2 inline h-4 w-4" /> Contradiction detected in trust rules or facility claims. Review before field use.</div>}
          {tab === "Overview" && <FacilityProfile facility={facility} />}
          {(tab === "Overview" || tab === "Capabilities") && <ClinicalProfile facility={facility} />}
          {(tab === "Overview" || tab === "Capabilities") && <Section title="Evidence Capability Matrix" subtitle="Audited Capability Claims, Evidence, And Confidence"><CapabilityTable rows={rows} /></Section>}
          {(tab === "Overview" || tab === "Trust Audit") && <Section title="Trust Audit" subtitle="Rules Evaluated Against Evidence"><TrustAudit facility={facility} /></Section>}
          {tab === "Validation" && <Section title="Validation" subtitle="Medical-Plausibility Checks">{validation ? <Validation validation={validation} /> : <p className="text-sm text-muted-foreground">Validation Running...</p>}</Section>}
          {(tab === "Overview" || tab === "Source Evidence") && <Section title="Source Evidence" subtitle="Evidence Excerpts From Facility Records"><div className="grid gap-3 sm:grid-cols-2">{rows.filter((r) => r.quote).map((row) => <div key={row.key} className="rounded-md border hairline bg-surface p-3"><EvidenceLedgerButton facilityId={facility.facility_id} capability={row.key} quote={formatClinicalTerm(row.quote!)} source={row.source} confidence={row.confidence} contradicted={row.status === "Contradicted"} /></div>)}</div></Section>}
          {tab === "Raw Record" && <Section title="Raw Source Record" subtitle="All Non-Empty Fields Preserved From The Ingested Facility Record"><RawRecordPanel record={rawRecord} /></Section>}
          {tab === "Trace" && <Section title="Trace" subtitle="Facility Scoring Provenance"><TracePanel id={facility.facility_id} rows={rows.length} flags={facility.trust_report?.flags.length ?? 0} /></Section>}
        </div>
        <aside className="flex flex-col gap-4">
          <Panel title="Trust Score"><div className="flex items-center gap-3"><TrustRing score={facility.trust_score} status={status} size={64} /><p className="text-[12px] text-muted-foreground">Score Combines Evidence Directness, Trust Flags, And Cross-Field Plausibility.</p></div></Panel>
          <Panel title="Contact And Web Presence"><ContactPanel facility={facility} enrichment={enrichment} loading={enrichmentLoading} onEnrich={async () => {
            setEnrichmentLoading(true);
            try {
              const data = await fetch(`/api/facility/${encodeURIComponent(facility.facility_id)}/contact-enrichment`).then((r) => r.ok ? r.json() : null);
              setEnrichment(data);
            } finally {
              setEnrichmentLoading(false);
            }
          }} /></Panel>
          <Panel title="Evidence Summary"><Summary rows={rows} /></Panel>
          <Panel title="Provenance"><ul className="flex flex-col gap-1 font-mono text-[12px] text-muted-foreground"><li>silver_facility</li><li>gold_facility_capabilities</li><li>gold_facility_trust</li><li>validator agent</li></ul></Panel>
        </aside>
      </div>
    </AppShell>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="mb-5"><header className="mb-2"><h2 className="text-[13px] font-semibold">{title}</h2>{subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}</header>{children}</section>;
}

function FacilityProfile({ facility }: { facility: FacilityFull }) {
  if (!facility.description) return null;
  return (
    <Section title="Facility Profile" subtitle="Source Description From The Ingested Clinic Record">
      <div className="rounded-md border hairline bg-surface px-4 py-3">
        <p className="max-w-4xl text-[13px] leading-6 text-foreground/85">{facility.description}</p>
      </div>
    </Section>
  );
}

function ClinicalProfile({ facility }: { facility: FacilityFull }) {
  const groups = [
    {
      title: "Specialties",
      subtitle: "Clinical Focus Areas",
      icon: Stethoscope,
      items: facility.specialties.map(formatClinicalTerm),
      tone: "primary",
    },
    {
      title: "Procedures And Services",
      subtitle: "Care Services Listed In The Source Record",
      icon: ClipboardList,
      items: facility.procedures.map(formatClinicalTerm),
      tone: "trust",
    },
    {
      title: "Capabilities",
      subtitle: "Operational And Service Capability Signals",
      icon: Activity,
      items: facility.capability_text.map(formatClinicalTerm),
      tone: "caution",
    },
    {
      title: "Equipment",
      subtitle: "Equipment And Infrastructure Signals",
      icon: Microscope,
      items: facility.equipment.map(formatClinicalTerm),
      tone: "neutral",
    },
  ].map((group) => ({ ...group, items: uniqueItems(group.items) })).filter((group) => group.items.length > 0);

  if (!groups.length) return null;

  return (
    <Section title="Clinical Intelligence" subtitle="Structured Source Fields Promoted From The Raw Record">
      <div className="grid gap-3 lg:grid-cols-2">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.title} className="rounded-md border hairline bg-surface p-4">
              <div className="mb-3 flex items-start gap-2.5">
                <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border", clinicalTone(group.tone))}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold">{group.title}</h3>
                  <p className="text-[11px] text-muted-foreground">{group.subtitle}</p>
                </div>
                <span className="ml-auto rounded border hairline bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{group.items.length}</span>
              </div>
              <div className={cn("flex flex-wrap gap-1.5", group.title === "Procedures And Services" && "block space-y-1.5")}>
                {group.items.map((item) => group.title === "Procedures And Services" ? (
                  <div key={item} className="flex gap-2 rounded-md bg-surface-muted px-2.5 py-1.5 text-[12px] leading-relaxed text-foreground/85">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </div>
                ) : (
                  <span key={item} className="rounded-md border hairline bg-surface-muted px-2 py-1 text-[12px] text-foreground/85">{item}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function CapabilityTable({ rows }: { rows: ReturnType<typeof activeEvidenceRows> }) {
  return <div className="overflow-hidden rounded-md border hairline bg-surface"><table className="w-full text-[12px]"><thead className="bg-surface-muted text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Capability</th><th className="px-3 py-2 text-left font-medium">Status</th><th className="px-3 py-2 text-left font-medium">Evidence</th><th className="px-3 py-2 text-left font-medium">Source</th><th className="px-3 py-2 text-right font-medium">Confidence</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key} className="border-t hairline align-top"><td className="px-3 py-2 font-medium">{row.label}</td><td className="px-3 py-2">{row.status}</td><td className="max-w-[420px] px-3 py-2 text-foreground/80">{row.quote ? formatClinicalTerm(row.quote) : "No Quote Captured"}</td><td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{row.source || "Unknown"}</td><td className="px-3 py-2 text-right font-mono">{row.confidence}</td></tr>)}</tbody></table></div>;
}

function TrustAudit({ facility }: { facility: FacilityFull }) {
  const flags = facility.trust_report?.flags ?? [];
  if (!flags.length) return <EmptyState title="No Active Trust Flags" />;
  return <ul className="flex flex-col gap-2">{flags.map((flag) => <li key={flag.rule_id} className="rounded-md border hairline bg-surface p-3 text-[13px]"><div className="font-medium"><span className="mr-2 font-mono text-[11px] text-muted-foreground">{flag.rule_id}</span>{trustFlagTitle(flag)}</div>{flag.evidence_quotes.map((quote) => <p key={quote} className="mt-1 text-[12px] text-muted-foreground">"{quote}"</p>)}</li>)}</ul>;
}

function Validation({ validation }: { validation: ValidatorResult }) {
  return <div className="rounded-md border hairline bg-surface p-4 text-[13px]"><p>{validation.overall_assessment || validation.recommendation}</p><ul className="mt-3 flex flex-col gap-2">{validation.findings.map((finding) => <li key={finding.capability} className="border-t hairline pt-2"><strong>{finding.capability}</strong>: {finding.reasoning}</li>)}</ul></div>;
}

function TracePanel({ id, rows, flags }: { id: string; rows: number; flags: number }) {
  const items = [["facility_lookup", id], ["capability_matrix", `${rows} evidence rows`], ["trust_audit", `${flags} flags`], ["validation", "on demand"]];
  return <div className="overflow-hidden rounded-md border hairline bg-surface"><table className="w-full text-[12px]"><tbody>{items.map(([tool, result], i) => <tr key={tool} className="border-t hairline first:border-t-0"><td className="px-3 py-2 font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</td><td className="px-3 py-2 font-mono">{tool}</td><td className="px-3 py-2">{result}</td></tr>)}</tbody></table></div>;
}

function RawRecordPanel({ record }: { record: Record<string, unknown> | null }) {
  if (!record) return <div className="rounded-md border hairline bg-surface p-4 text-[13px] text-muted-foreground">Loading Source Record...</div>;
  const groups = groupRawRecord(record);
  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <div key={group.title} className="overflow-hidden rounded-md border hairline bg-surface">
          <div className="border-b hairline bg-surface-muted px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</div>
          <dl className="grid grid-cols-1 divide-y divide-hairline md:grid-cols-2 md:divide-x md:[&>*:nth-child(2n+1)]:border-l-0">
            {group.rows.map(([key, value]) => (
              <div key={key} className="min-w-0 px-3 py-2">
                <dt className="font-mono text-[10px] text-muted-foreground">{key}</dt>
                <dd className="mt-0.5 break-words text-[12px] text-foreground">{formatRawValue(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function groupRawRecord(record: Record<string, unknown>): Array<{ title: string; rows: Array<[string, unknown]> }> {
  const entries = Object.entries(record).filter(([, value]) => !isBlankRawValue(value));
  const buckets = [
    { title: "Identity And Contact", keys: ["facility_id", "name", "description", "official_phone", "email", "official_website", "phone_numbers", "websites", "facebook_link", "twitter_link", "linkedin_link", "instagram_link"] },
    { title: "Address And Geography", keys: ["address_line1", "address_line2", "address_line3", "city", "state_raw", "state_canon", "pincode", "address_country", "address_country_code", "latitude", "longitude", "geo_valid"] },
    { title: "Classification", keys: ["facility_type_id", "operator_type_id", "affiliation_type_ids"] },
    { title: "Clinical Record", keys: ["specialties", "procedures", "equipment", "capabilities"] },
    { title: "Capacity And Social Signals", keys: ["number_doctors", "capacity", "year_established", "parsed_bed_count", "parsed_doctor_count", "parsed_year_from_established", "parsed_year_from_operation", "distinct_social_media_presence_count", "affiliated_staff_presence", "custom_logo_presence", "number_of_facts", "most_recent_page_update", "most_recent_post_date", "post_count", "n_followers", "n_likes", "n_engagements"] },
    { title: "Data Quality", keys: ["data_quality_flags"] },
  ];
  const used = new Set<string>();
  const result = buckets.map((bucket) => {
    const rows = bucket.keys
      .filter((key) => key in record && !isBlankRawValue(record[key]))
      .map((key): [string, unknown] => {
        used.add(key);
        return [key, record[key]];
      });
    return { title: bucket.title, rows };
  }).filter((group) => group.rows.length > 0);
  const otherRows = entries.filter(([key]) => !used.has(key));
  if (otherRows.length) result.push({ title: "Other Ingested Fields", rows: otherRows });
  return result;
}

function isBlankRawValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "" || value.trim().toLowerCase() === "null";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function formatRawValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

function uniqueItems(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function formatClinicalTerm(value: string): string {
  const cleaned = value.replaceAll("_", " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (!cleaned.includes(" ") && /[a-z][A-Z]/.test(cleaned)) {
    return cleaned
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .split(" ")
      .map((word, index) => formatClinicalWord(word, index))
      .join(" ");
  }
  if (/^[a-z]+$/.test(cleaned)) return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned;
}

function formatClinicalWord(word: string, index: number): string {
  const lower = word.toLowerCase();
  if (index > 0 && lower === "and") return "and";
  if (lower === "pmr") return "PMR";
  if (lower === "icu") return "ICU";
  if (lower === "nicu") return "NICU";
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function clinicalTone(tone: string): string {
  if (tone === "trust") return "border-trust/25 bg-trust-soft text-trust";
  if (tone === "caution") return "border-caution/25 bg-caution-soft text-caution";
  if (tone === "primary") return "border-primary/25 bg-primary-soft text-primary";
  return "border-hairline bg-surface-muted text-muted-foreground";
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-md border hairline bg-surface p-4"><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>{children}</div>;
}

function Summary({ rows }: { rows: ReturnType<typeof activeEvidenceRows> }) {
  return <ul className="flex flex-col gap-1 text-[12px]"><li className="flex justify-between"><span className="text-muted-foreground">Total Rows</span><span className="font-mono">{rows.length}</span></li><li className="flex justify-between"><span className="text-muted-foreground">Direct</span><span className="font-mono">{rows.filter((r) => r.status === "Direct").length}</span></li><li className="flex justify-between"><span className="text-muted-foreground">Weak</span><span className="font-mono">{rows.filter((r) => r.status === "Weak").length}</span></li><li className="flex justify-between"><span className="text-muted-foreground">Contradicted</span><span className="font-mono">{rows.filter((r) => r.status === "Contradicted").length}</span></li></ul>;
}

function ContactPanel({ facility, enrichment, loading, onEnrich }: { facility: FacilityFull; enrichment: ContactEnrichment | null; loading: boolean; onEnrich: () => void }) {
  const websites = Array.from(new Set([facility.official_website, facility.website, ...(facility.websites ?? [])].filter(Boolean))) as string[];
  const socials = facility.social_links ?? [];
  const hasContact = facility.phone || facility.email || facility.address || websites.length || socials.length;
  return (
    <div className="flex flex-col gap-3 text-[12px]">
      {!hasContact && <p className="text-muted-foreground">No Contact Or Web Links Are Present In The Ingested Source Record.</p>}
      {facility.phone && <ContactLine icon={Phone} label="Phone" value={facility.phone} />}
      {facility.email && <ContactLine icon={Mail} label="Email" value={facility.email} href={`mailto:${facility.email}`} />}
      {facility.address && <ContactLine icon={MapPin} label="Address" value={facility.address} />}
      {websites.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Websites</div>
          <div className="flex flex-col gap-1">
            {websites.slice(0, 3).map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 text-primary hover:underline">
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{displayUrl(url)}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
      {socials.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Social Links</div>
          <div className="flex flex-wrap gap-1.5">
            {socials.map((link) => <SocialLink key={`${link.kind}-${link.url}`} link={link} />)}
          </div>
        </div>
      )}
      <Button type="button" size="sm" variant="outline" className="h-8 justify-start text-[12px]" disabled={loading} onClick={onEnrich}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
        Find Missing Contacts
      </Button>
      {enrichment && (
        <div className="rounded-md border hairline bg-surface-muted p-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Web Enrichment</div>
          {enrichment.found_contacts.length ? (
            <div className="flex flex-wrap gap-1.5">
              {enrichment.found_contacts.slice(0, 6).map((link) => <SocialLink key={`${link.kind}-${link.url}`} link={link} />)}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">{enrichment.snippets[0] || "No Additional Contacts Found."}</p>
          )}
        </div>
      )}
    </div>
  );
}

function ContactLine({ icon: Icon, label, value, href }: { icon: typeof Phone; label: string; value: string; href?: string }) {
  const content = (
    <span className="inline-flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="block break-words text-foreground">{value}</span>
      </span>
    </span>
  );
  return href ? <a href={href} className="hover:text-primary">{content}</a> : content;
}

function SocialLink({ link }: { link: ContactLink }) {
  const external = link.url.startsWith("http");
  return (
    <a
      href={link.url}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="inline-flex items-center gap-1 rounded-md border hairline bg-surface-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
    >
      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-background px-1 font-mono text-[9px] font-semibold">{socialMark(link.kind)}</span>
      {link.label}
    </a>
  );
}

function socialMark(kind: string): string {
  if (kind === "facebook") return "f";
  if (kind === "twitter") return "X";
  if (kind === "linkedin") return "in";
  if (kind === "instagram") return "IG";
  if (kind === "email") return "@";
  if (kind === "phone") return "tel";
  return ">";
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

async function createReview(facility: FacilityFull) {
  await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facility_id: facility.facility_id, facility_name: facility.name, reason: "Manual Facility Review Requested", severity: facility.has_contradiction ? "red" : "yellow", evidence_for: [], evidence_against: [] }) });
}

async function exportFacility(id: string) {
  const resp = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facility_ids: [id], format: "csv", include_trust_audit: true, include_capabilities: true }) });
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "truecare-facility.csv"; a.click();
  URL.revokeObjectURL(url);
}

function FacilitySkeleton({ id }: { id: string }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b hairline bg-background px-4 py-2.5">
        <div className="loading-shimmer h-4 w-56 rounded" />
      </div>
      <header className="border-b hairline bg-surface px-6 py-5">
        <div className="flex flex-wrap items-start gap-5">
          <div className="loading-shimmer h-20 w-20 rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="loading-shimmer h-6 w-2/5 rounded" />
            <div className="loading-shimmer h-3.5 w-3/5 rounded" />
            <div className="flex gap-1.5">
              <div className="loading-shimmer h-5 w-16 rounded" />
              <div className="loading-shimmer h-5 w-20 rounded" />
              <div className="loading-shimmer h-5 w-14 rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="loading-shimmer h-8 w-20 rounded-md" />)}
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="loading-shimmer h-8 w-24 rounded" />)}
        </div>
      </header>
      <div className="grid flex-1 grid-cols-1 gap-5 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="rounded-md border hairline bg-surface p-4">
            <div className="loading-shimmer mb-3 h-4 w-40 rounded" />
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="loading-shimmer mb-2 h-9 rounded" />)}
          </div>
          <div className="rounded-md border hairline bg-surface p-4">
            <div className="loading-shimmer mb-3 h-4 w-32 rounded" />
            <div className="loading-shimmer h-24 rounded" />
          </div>
        </div>
        <aside className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-md border hairline bg-surface p-4"><div className="loading-shimmer mb-3 h-3 w-28 rounded" /><div className="loading-shimmer h-20 rounded" /></div>)}
        </aside>
      </div>
      <span className="sr-only">Loading Facility {id}</span>
    </div>
  );
}
