const CRON_SECRET =
  process.env.HEALTH_CRON_SECRET;

const SUPABASE_URL =
  process.env.TM_SUPABASE_URL ??
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.TM_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;

async function fetchJson(url: string, init?: RequestInit) {
  try {
    const resp = await fetch(url, { ...init, cache: "no-store" });
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, data };
  } catch (error) {
    return {
      ok: false,
      status: null,
      data: { error: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!CRON_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      { error: "Health cron is not configured" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return unauthorized();
  }

  const origin = new URL(request.url).origin;

  const health = await fetchJson(`${origin}/api/health`);
  const dataHealth = await fetchJson(`${origin}/api/data-health`);
  const clinics = await fetchJson(`${origin}/api/clinics?limit=1`);
  const intent = await fetchJson(`${origin}/api/intent-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "NICU near Patna", mode: "fast" }),
  });
  const mapAggregates = await fetchJson(
    `${origin}/api/map/aggregates/ci?capability=has_nicu&level=state`,
  );

  const facilityId = clinics.ok
    ? (clinics.data?.items?.[0]?.facility_id as string | undefined)
    : undefined;
  const facilityLookup = facilityId
    ? await fetchJson(`${origin}/api/facility?id=${encodeURIComponent(facilityId)}`)
    : { ok: false, status: null, data: { error: "No facility sample" } };

  const checks = (health.data?.checks ?? {}) as Record<string, { ok?: boolean }>;

  const payload = {
    status:
      health.ok &&
      dataHealth.ok &&
      clinics.ok &&
      intent.ok &&
      mapAggregates.ok &&
      facilityLookup.ok
        ? "ok"
        : "degraded",
    sql_ok: Boolean(checks.sql?.ok),
    vector_search_ok: Boolean(checks.vector_search?.ok),
    metrics_ok: dataHealth.ok && dataHealth.data?.status === "ok",
    clinics_ok: clinics.ok,
    facility_lookup_ok: facilityLookup.ok,
    map_aggregates_ok: mapAggregates.ok,
    supabase_ok: true,
    details: {
      generated_at: new Date().toISOString(),
      health: { ok: health.ok, status: health.status, data: health.data },
      data_health: { ok: dataHealth.ok, status: dataHealth.status, data: dataHealth.data },
      clinics: { ok: clinics.ok, status: clinics.status },
      intent_search: { ok: intent.ok, status: intent.status },
      map_aggregates: { ok: mapAggregates.ok, status: mapAggregates.status },
      facility_lookup: { ok: facilityLookup.ok, status: facilityLookup.status, facility_id: facilityId ?? null },
    },
    created_at: new Date().toISOString(),
  };

  const supabaseResp = await fetch(`${SUPABASE_URL}/rest/v1/health_checks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const supabaseData = await supabaseResp.text();
  if (!supabaseResp.ok) {
    return Response.json(
      {
        error: "Failed to write health row",
        supabase_status: supabaseResp.status,
        supabase_body: supabaseData,
        payload,
      },
      { status: 502 },
    );
  }

  return Response.json({
    ok: true,
    payload,
  });
}
