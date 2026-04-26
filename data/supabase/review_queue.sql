create table if not exists public.review_tasks (
  id text primary key,
  facility_id text not null,
  facility_name text,
  capability text,
  claim text,
  reason text not null,
  severity text not null check (severity in ('red', 'yellow', 'green')),
  evidence_for jsonb not null default '[]'::jsonb,
  evidence_against jsonb not null default '[]'::jsonb,
  source text not null default 'manual',
  status text not null default 'pending' check (status in ('pending', 'phone_verification', 'accepted', 'rejected')),
  owner text,
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_tasks_status_idx on public.review_tasks (status);
create index if not exists review_tasks_facility_id_idx on public.review_tasks (facility_id);
create index if not exists review_tasks_updated_at_idx on public.review_tasks (updated_at desc);

alter table public.review_tasks enable row level security;
