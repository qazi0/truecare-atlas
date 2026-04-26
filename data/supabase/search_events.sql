create table if not exists public.search_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  query text not null,
  intent text,
  summary text,
  response_facilities jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists search_events_created_at_idx on public.search_events (created_at desc);
create index if not exists search_events_event_type_idx on public.search_events (event_type);
create index if not exists search_events_intent_idx on public.search_events (intent);

alter table public.search_events enable row level security;
