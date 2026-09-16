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

create table if not exists public.os_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_code text not null,
  ean text not null,
  ncm_sh text not null default '',
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item_code),
  unique (user_id, ean),
  unique (user_id, name)
);

-- Compatibilidade caso voce ja tenha criado a versao anterior da tabela.
alter table public.os_app_data
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.os_app_data
  add column if not exists user_email text;

alter table public.os_items enable row level security;

alter table public.os_items
  add column if not exists ncm_sh text not null default '';

create unique index if not exists os_app_data_user_id_key
on public.os_app_data(user_id);

alter table public.os_profiles enable row level security;
alter table public.os_app_data enable row level security;

revoke all on table public.os_profiles from anon;
revoke all on table public.os_profiles from authenticated;
revoke all on table public.os_app_data from anon;
revoke all on table public.os_app_data from authenticated;
revoke all on table public.os_items from anon;
revoke all on table public.os_items from authenticated;

grant select, insert on table public.os_profiles to authenticated;
grant select, insert, update on table public.os_app_data to authenticated;
grant select, insert, delete on table public.os_items to authenticated;

drop policy if exists "os_profiles_select_own" on public.os_profiles;
drop policy if exists "os_profiles_insert_own" on public.os_profiles;
drop policy if exists "os_profiles_update_own" on public.os_profiles;
drop policy if exists "os_app_data_select_own" on public.os_app_data;
drop policy if exists "os_app_data_insert_own" on public.os_app_data;
drop policy if exists "os_app_data_update_own" on public.os_app_data;
drop policy if exists "os_items_select_own" on public.os_items;
drop policy if exists "os_items_insert_own" on public.os_items;
drop policy if exists "os_items_delete_own" on public.os_items;

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

create policy "os_items_select_own"
on public.os_items
for select
to authenticated
using (auth.uid() = user_id);

create policy "os_items_insert_own"
on public.os_items
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "os_items_delete_own"
on public.os_items
for delete
to authenticated
using (auth.uid() = user_id);

-- Visão administrativa: não expõe os dados operacionais completos, apenas
-- indicadores por perfil. O usuário precisa ser promovido manualmente para
-- role = 'administrador' por um responsável pelo projeto.
create or replace function public.get_admin_overview()
returns table (
  user_id uuid,
  email text,
  username text,
  full_name text,
  role text,
  active boolean,
  company_name text,
  orders_count integer,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.email,
    coalesce(nullif(u.raw_user_meta_data ->> 'username', ''), split_part(p.email, '@', 1)),
    p.full_name,
    p.role,
    p.active,
    coalesce(nullif(d.data -> 'company' ->> 'name', ''), 'Sem empresa'),
    jsonb_array_length(case when jsonb_typeof(d.data -> 'orders') = 'array' then d.data -> 'orders' else '[]'::jsonb end),
    d.updated_at
  from public.os_profiles p
  left join auth.users u on u.id = p.id
  left join public.os_app_data d on d.user_id = p.id
  where exists (
    select 1
    from public.os_profiles admin
    where admin.id = auth.uid()
      and lower(admin.role) in ('admin', 'administrador')
      and admin.active = true
  )
  order by coalesce(nullif(d.data -> 'company' ->> 'name', ''), 'Sem empresa'), p.full_name;
$$;

revoke all on function public.get_admin_overview() from public;
grant execute on function public.get_admin_overview() to authenticated;

-- Depois de criar a conta do responsável, promova-a uma única vez:
-- update public.os_profiles
-- set role = 'administrador', updated_at = now()
-- where email = 'responsavel@gerador-os.local';
