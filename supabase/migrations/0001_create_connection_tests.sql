create table if not exists public.connection_tests (
  id bigint generated always as identity primary key,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.connection_tests enable row level security;

drop policy if exists "Allow public connection test reads"
  on public.connection_tests;

create policy "Allow public connection test reads"
  on public.connection_tests
  for select
  to anon, authenticated
  using (true);

insert into public.connection_tests (message)
select 'Cloud Supabase connection is active.'
where not exists (select 1 from public.connection_tests);
