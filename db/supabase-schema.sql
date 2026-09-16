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
  plan_code text not null default 'free' check (plan_code in ('free', 'pro', 'standard', 'full')),
  monthly_order_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.os_profiles
  add column if not exists plan_code text not null default 'free';

alter table public.os_profiles
  add column if not exists monthly_order_limit integer;

update public.os_profiles
set monthly_order_limit = case lower(trim(plan_code))
  when 'free' then 30
  when 'pro' then 80
  when 'standard' then 120
  when 'full' then null
  else 30
end
where monthly_order_limit is null
  and lower(trim(plan_code)) <> 'full';

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

create or replace function public.set_user_plan(
  target_user_id uuid,
  target_plan_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_limit integer;
begin
  if not exists (
    select 1 from public.os_profiles
    where id = auth.uid()
      and lower(trim(role)) in ('admin', 'administrador')
      and active = true
  ) then
    raise exception 'Acesso administrativo necessário';
  end if;

  next_limit := case lower(trim(target_plan_code))
    when 'free' then 30
    when 'pro' then 80
    when 'standard' then 120
    when 'full' then null
    else null
  end;

  if lower(trim(target_plan_code)) not in ('free', 'pro', 'standard', 'full') then
    raise exception 'Plano inválido';
  end if;

  update public.os_profiles
  set plan_code = lower(trim(target_plan_code)),
      monthly_order_limit = next_limit,
      updated_at = now()
  where id = target_user_id;
end;
$$;

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
  updated_at timestamptz,
  plan_code text,
  monthly_order_limit integer,
  monthly_orders_count integer
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
    d.updated_at,
    p.plan_code,
    p.monthly_order_limit,
    (
      select count(*)::integer
      from jsonb_array_elements(case when jsonb_typeof(d.data -> 'orders') = 'array' then d.data -> 'orders' else '[]'::jsonb end) order_row
      where (order_row ->> 'createdAt')::timestamptz >= date_trunc('month', now())
        and (order_row ->> 'createdAt')::timestamptz < date_trunc('month', now()) + interval '1 month'
    )
  from public.os_profiles p
  left join auth.users u on u.id = p.id
  left join public.os_app_data d on d.user_id = p.id
  where exists (
    select 1
    from public.os_profiles admin
    where admin.id = auth.uid()
      and lower(trim(admin.role)) in ('admin', 'administrador')
      and admin.active = true
  )
  order by coalesce(nullif(d.data -> 'company' ->> 'name', ''), 'Sem empresa'), p.full_name;
$$;

revoke all on function public.get_admin_overview() from public;
grant execute on function public.get_admin_overview() to authenticated;
revoke all on function public.set_user_plan(uuid, text) from public;
grant execute on function public.set_user_plan(uuid, text) to authenticated;

-- Para liberar o painel administrativo, execute com o e-mail real do responsável:
-- update public.os_profiles
-- set role = 'administrador', active = true, updated_at = now()
-- where lower(trim(email)) = lower(trim('SEU_EMAIL_DE_LOGIN'));

-- Para conferir antes de promover:
-- select email, role, active from public.os_profiles
-- where lower(trim(email)) = lower(trim('SEU_EMAIL_DE_LOGIN'));
