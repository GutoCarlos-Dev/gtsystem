-- Execute este SQL no Supabase SQL Editor.
-- Esta versao usa Supabase Auth: o usuario entra por link de e-mail,
-- o app valida a sessao, carrega/cria o perfil em os_profiles e salva
-- os dados somente para o auth.uid() autenticado.

create table if not exists public.os_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'operador',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.os_app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  user_email text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibilidade caso voce ja tenha criado a versao anterior da tabela.
alter table public.os_app_data
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.os_app_data
  add column if not exists user_email text;

create unique index if not exists os_app_data_user_id_key
on public.os_app_data(user_id);

alter table public.os_profiles enable row level security;
alter table public.os_app_data enable row level security;

revoke all on table public.os_profiles from anon;
revoke all on table public.os_profiles from authenticated;
revoke all on table public.os_app_data from anon;
revoke all on table public.os_app_data from authenticated;

grant select, insert on table public.os_profiles to authenticated;
grant select, insert, update on table public.os_app_data to authenticated;

drop policy if exists "os_profiles_select_own" on public.os_profiles;
drop policy if exists "os_profiles_insert_own" on public.os_profiles;
drop policy if exists "os_profiles_update_own" on public.os_profiles;
drop policy if exists "os_app_data_select_own" on public.os_app_data;
drop policy if exists "os_app_data_insert_own" on public.os_app_data;
drop policy if exists "os_app_data_update_own" on public.os_app_data;

create policy "os_profiles_select_own"
on public.os_profiles
for select
to authenticated
using (auth.uid() = id);

create policy "os_profiles_insert_own"
on public.os_profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "os_app_data_select_own"
on public.os_app_data
for select
to authenticated
using (auth.uid() = user_id);

create policy "os_app_data_insert_own"
on public.os_app_data
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "os_app_data_update_own"
on public.os_app_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
