create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  key_prefix text not null,
  key_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint api_keys_name_len check (char_length(name) <= 60),
  constraint api_keys_prefix_len check (char_length(key_prefix) between 4 and 16),
  constraint api_keys_hash_format check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint api_keys_hash_unique unique (key_hash)
);

create index api_keys_user_id_idx on public.api_keys (user_id);

alter table public.api_keys enable row level security;

create policy "api_keys_select_own"
  on public.api_keys for select to authenticated
  using (user_id = (select auth.uid()));

create policy "api_keys_insert_own"
  on public.api_keys for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "api_keys_delete_own"
  on public.api_keys for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.api_keys from anon, authenticated;
grant select (id, user_id, name, key_prefix, created_at, last_used_at) on public.api_keys to authenticated;
grant insert (user_id, name, key_prefix, key_hash) on public.api_keys to authenticated;
grant delete on public.api_keys to authenticated;

create or replace function public.enforce_api_keys_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.api_keys where user_id = new.user_id) >= 10 then
    raise exception 'API_KEYS_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_api_keys_limit() from public, anon, authenticated;

create trigger api_keys_enforce_limit
before insert on public.api_keys
for each row execute function public.enforce_api_keys_limit();

alter table public.products
  add column if not exists external_source text,
  add column if not exists external_id text;

alter table public.products
  add constraint products_external_ref_pair check ((external_source is null) = (external_id is null)),
  add constraint products_external_ref_len check (
    external_source is null
    or (char_length(external_source) between 1 and 40 and char_length(external_id) between 1 and 64)
  );

create unique index products_external_ref_unique
  on public.products (user_id, external_source, external_id)
  where external_id is not null and deleted_at is null;

alter table public.clients
  add column if not exists external_source text,
  add column if not exists external_id text;

alter table public.clients
  add constraint clients_external_ref_pair check ((external_source is null) = (external_id is null)),
  add constraint clients_external_ref_len check (
    external_source is null
    or (char_length(external_source) between 1 and 40 and char_length(external_id) between 1 and 64)
  );

create unique index clients_external_ref_unique
  on public.clients (user_id, external_source, external_id)
  where external_id is not null and deleted_at is null;
