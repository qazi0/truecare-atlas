create table if not exists public.health_checks (
  id bigint generated always as identity primary key,
  status text not null,
  sql_ok boolean not null,
  vector_search_ok boolean not null,
  metrics_ok boolean not null,
  clinics_ok boolean not null,
  facility_lookup_ok boolean not null,
  map_aggregates_ok boolean not null,
  supabase_ok boolean not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists health_checks_created_at_idx
  on public.health_checks (created_at desc);

alter table public.health_checks enable row level security;
