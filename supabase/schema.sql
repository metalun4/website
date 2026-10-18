begin;

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null check (length(name) between 1 and 150),
  rank integer check (rank between 1 and 10000000),
  participants integer check (participants between 1 and 10000000),
  pdf_url text check (pdf_url is null or (length(pdf_url) <= 2048 and pdf_url ~* '^https?://')),
  subjects jsonb not null check (jsonb_typeof(subjects) = 'array' and jsonb_array_length(subjects) = 4),
  created_at timestamptz not null default now(),
  check (rank is null or participants is null or rank <= participants)
);
create index exams_date_idx on public.exams(date, id);

create table public.viewer_pins (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(label) between 1 and 100),
  pin_hash text not null unique,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.app_sessions (
  token_hash text primary key,
  role text not null check (role in ('admin', 'viewer')),
  pin_id uuid references public.viewer_pins(id) on delete cascade,
  expires_at timestamptz not null,
  check ((role = 'admin' and pin_id is null) or (role = 'viewer' and pin_id is not null))
);
create index app_sessions_expiry_idx on public.app_sessions(expires_at);

create table public.login_attempts (
  key text primary key,
  attempts integer not null,
  window_start timestamptz not null default now()
);

-- Shared, atomic rate limiting works across Vercel instances. Includes cleanup.
create function public.consume_login_attempt(bucket text, max_attempts integer)
returns boolean language plpgsql set search_path = '' as $$
declare attempt_count integer;
begin
  delete from public.login_attempts where window_start < now() - interval '15 minutes';
  delete from public.app_sessions where expires_at <= now();
  insert into public.login_attempts as current (key, attempts, window_start)
    values (bucket, 1, now())
    on conflict (key) do update set
      attempts = case when current.window_start <= now() - interval '15 minutes' then 1 else current.attempts + 1 end,
      window_start = case when current.window_start <= now() - interval '15 minutes' then now() else current.window_start end
    returning attempts into attempt_count;
  return attempt_count <= max_attempts;
end;
$$;

-- All access goes through Next.js server authorization. No browser DB access.
alter table public.exams enable row level security;
alter table public.viewer_pins enable row level security;
alter table public.app_sessions enable row level security;
alter table public.login_attempts enable row level security;
revoke all on public.exams, public.viewer_pins, public.app_sessions, public.login_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.exams, public.viewer_pins, public.app_sessions, public.login_attempts to service_role;
revoke all on function public.consume_login_attempt(text, integer) from public, anon, authenticated;
grant execute on function public.consume_login_attempt(text, integer) to service_role;
commit;
