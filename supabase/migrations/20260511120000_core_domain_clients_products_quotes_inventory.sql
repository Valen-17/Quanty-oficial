-- =============================================================================
-- Quanty: core domain (profiles extension, clients, products, quotes,
-- quote_line_items, inventory_movements) + RLS + updated_at triggers.
-- Aligns with src/domain/entities.ts (UUID PKs in DB; app may map legacy ids later).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Extend profiles (Profile in domain: email, currency, language)
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text not null default '';

alter table public.profiles
  add column if not exists currency text not null default 'COP';

alter table public.profiles
  add column if not exists language text not null default 'es';

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'profiles' and c.conname = 'profiles_currency_len'
  ) then
    alter table public.profiles
      add constraint profiles_currency_len
      check (char_length(trim(currency)) between 3 and 5);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'profiles' and c.conname = 'profiles_language_check'
  ) then
    alter table public.profiles
      add constraint profiles_language_check
      check (language in ('es', 'en'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'profiles' and c.conname = 'profiles_email_len'
  ) then
    alter table public.profiles
      add constraint profiles_email_len
      check (char_length(email) <= 120);
  end if;
end $$;

comment on column public.profiles.email is 'Negocio / contacto (puede diferir del email de auth); vacío permitido.';
comment on column public.profiles.currency is 'Código ISO o convención app (3–5 chars), ej. COP.';
comment on column public.profiles.language is 'Preferencia UI: es | en.';

-- -----------------------------------------------------------------------------
-- 2) Enum types (alineados a quoteStatusSchema e inventario)
-- -----------------------------------------------------------------------------
create type public.quote_status as enum (
  'borrador',
  'enviada',
  'aprobada',
  'rechazada'
);

create type public.inventory_movement_reason as enum (
  'quote_approval',
  'adjustment',
  'reversal',
  'manual'
);

-- -----------------------------------------------------------------------------
-- 3) clients (clientSchema / clientInputSchema)
-- -----------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  company text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint clients_name_len check (char_length(trim(name)) between 2 and 80),
  constraint clients_email_len check (char_length(email) <= 120),
  constraint clients_phone_len check (char_length(phone) <= 30),
  constraint clients_company_len check (char_length(company) <= 80),
  constraint clients_notes_len check (char_length(notes) <= 280)
);

create index clients_user_id_created_at_idx
  on public.clients (user_id, created_at desc);

create index clients_user_id_active_idx
  on public.clients (user_id)
  where deleted_at is null;

comment on table public.clients is 'Directorio de clientes por usuario; soft delete con deleted_at.';
comment on column public.clients.deleted_at is 'Soft delete; filas conservadas para integridad referencial futura.';

-- -----------------------------------------------------------------------------
-- 4) products (productSchema / productInputSchema)
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(15, 4) not null,
  units integer not null default 0,
  threshold integer not null,
  image_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint products_name_len check (char_length(trim(name)) between 2 and 80),
  constraint products_description_len check (char_length(description) <= 240),
  constraint products_image_url_len check (char_length(image_url) <= 2000000),
  constraint products_price_positive check (price > 0),
  constraint products_units_range check (units >= 0 and units <= 999999),
  constraint products_threshold_range check (threshold >= 1 and threshold <= 9999)
);

create index products_user_id_created_at_idx
  on public.products (user_id, created_at desc);

create index products_user_id_active_idx
  on public.products (user_id)
  where deleted_at is null;

comment on table public.products is 'Inventario por usuario; stock en units; alertas con threshold.';
comment on column public.products.deleted_at is 'Soft delete; evita borrar filas referenciadas por snapshots.';

-- -----------------------------------------------------------------------------
-- 5) quotes (quoteSchema)
-- -----------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  folio text not null,
  status public.quote_status not null default 'borrador',
  client_name text not null,
  client_name_snapshot text not null,
  notes text not null default '',
  labor_percent numeric(5, 2) not null,
  subtotal numeric(18, 4) not null,
  labor_amount numeric(18, 4) not null,
  total numeric(18, 4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  constraint quotes_folio_len check (char_length(trim(folio)) >= 1),
  constraint quotes_client_name_len check (char_length(trim(client_name)) between 2 and 80),
  constraint quotes_client_name_snapshot_len check (char_length(trim(client_name_snapshot)) between 2 and 80),
  constraint quotes_notes_len check (char_length(notes) <= 280),
  constraint quotes_labor_percent_range check (labor_percent >= 0 and labor_percent <= 100),
  constraint quotes_amounts_nonnegative check (
    subtotal >= 0 and labor_amount >= 0 and total >= 0
  ),
  constraint quotes_approved_at_when_approved check (
    status <> 'aprobada' or approved_at is not null
  ),
  constraint quotes_unique_folio_per_user unique (user_id, folio)
);

create index quotes_user_id_status_created_idx
  on public.quotes (user_id, status, created_at desc);

create index quotes_user_id_client_id_idx
  on public.quotes (user_id, client_id)
  where client_id is not null;

comment on table public.quotes is 'Cotizaciones; client_name_snapshot congela histórico; approved_at obligatorio si aprobada.';
comment on column public.quotes.client_name is 'Nombre de cliente en UI/edición (dominio clientName).';
comment on column public.quotes.client_name_snapshot is 'Snapshot al crear/guardar cotización (dominio clientNameSnapshot).';

-- -----------------------------------------------------------------------------
-- 6) quote_line_items (QuoteItem + snapshots)
-- -----------------------------------------------------------------------------
create table public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  line_no smallint not null,
  product_id uuid references public.products (id) on delete set null,
  item_name text not null,
  unit_price numeric(18, 4) not null,
  product_name_snapshot text not null,
  unit_price_snapshot numeric(15, 4) not null,
  quantity integer not null,
  line_subtotal numeric(18, 4) generated always as (
    (quantity::numeric) * unit_price_snapshot
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_line_items_line_no_nonneg check (line_no >= 0),
  constraint quote_line_items_item_name_len check (char_length(item_name) >= 1),
  constraint quote_line_items_snapshots_nonneg check (
    unit_price >= 0 and unit_price_snapshot >= 0
  ),
  constraint quote_line_items_quantity_range check (quantity >= 1),
  constraint quote_line_items_unique_line_per_quote unique (quote_id, line_no)
);

create index quote_line_items_quote_id_idx
  on public.quote_line_items (quote_id);

create index quote_line_items_product_id_idx
  on public.quote_line_items (product_id)
  where product_id is not null;

comment on table public.quote_line_items is 'Líneas de cotización; line_subtotal generado; snapshots para histórico.';
comment on column public.quote_line_items.item_name is 'Nombre en línea (dominio QuoteItem.name).';
comment on column public.quote_line_items.unit_price is 'Precio de referencia en línea (dominio unitPrice).';
comment on column public.quote_line_items.product_name_snapshot is 'Snapshot de nombre de producto (histórico).';
comment on column public.quote_line_items.unit_price_snapshot is 'Snapshot de precio unitario (histórico).';

-- -----------------------------------------------------------------------------
-- 7) inventory_movements (auditoría + idempotencia por línea aprobada)
-- -----------------------------------------------------------------------------
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  delta integer not null,
  reason public.inventory_movement_reason not null,
  quote_id uuid references public.quotes (id) on delete set null,
  quote_line_item_id uuid references public.quote_line_items (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventory_movements_quote_approval_requires_refs check (
    reason <> 'quote_approval'
    or (
      quote_id is not null
      and quote_line_item_id is not null
    )
  )
);

create index inventory_movements_user_created_idx
  on public.inventory_movements (user_id, created_at desc);

create index inventory_movements_product_created_idx
  on public.inventory_movements (product_id, created_at desc);

create index inventory_movements_quote_idx
  on public.inventory_movements (quote_id)
  where quote_id is not null;

-- Idempotencia: a lo sumo un movimiento de tipo quote_approval por línea de cotización.
create unique index inventory_movements_quote_line_approval_unique
  on public.inventory_movements (quote_line_item_id)
  where reason = 'quote_approval';

comment on table public.inventory_movements is 'Movimientos de stock; quote_approval deduplicado por quote_line_item_id.';
comment on column public.inventory_movements.delta is 'Negativo reduce stock (ej. aprobación), positivo repone.';

-- -----------------------------------------------------------------------------
-- 7b) Integridad cross-table (mismo user_id; RLS no valida relaciones internas)
-- -----------------------------------------------------------------------------
create or replace function public.enforce_quote_client_same_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.clients c
    where c.id = new.client_id
      and c.user_id = new.user_id
  ) then
    raise exception 'quotes.client_id must reference a client owned by the same user';
  end if;
  return new;
end;
$$;

create trigger quotes_enforce_client_same_user
before insert or update of client_id, user_id on public.quotes
for each row execute function public.enforce_quote_client_same_user();

create or replace function public.enforce_quote_line_product_same_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q_user uuid;
  p_user uuid;
begin
  select q.user_id into q_user from public.quotes q where q.id = new.quote_id;
  if new.product_id is null then
    return new;
  end if;
  select p.user_id into p_user from public.products p where p.id = new.product_id;
  if q_user is null then
    raise exception 'quote_line_items.quote_id not found';
  end if;
  if p_user is null then
    raise exception 'quote_line_items.product_id not found';
  end if;
  if q_user <> p_user then
    raise exception 'quote line product must belong to the same user as the quote';
  end if;
  return new;
end;
$$;

create trigger quote_line_items_enforce_product_same_user
before insert or update of quote_id, product_id on public.quote_line_items
for each row execute function public.enforce_quote_line_product_same_user();

create or replace function public.enforce_inventory_movement_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p_user uuid;
  q_user uuid;
  li_quote uuid;
  li_user uuid;
begin
  select pr.user_id into p_user from public.products pr where pr.id = new.product_id;
  if p_user is null or p_user <> new.user_id then
    raise exception 'inventory_movements.product_id must belong to user_id';
  end if;

  if new.quote_id is not null then
    select qu.user_id into q_user from public.quotes qu where qu.id = new.quote_id;
    if q_user is null or q_user <> new.user_id then
      raise exception 'inventory_movements.quote_id must belong to user_id';
    end if;
  end if;

  if new.quote_line_item_id is not null then
    select li.quote_id into li_quote from public.quote_line_items li where li.id = new.quote_line_item_id;
    if li_quote is null then
      raise exception 'inventory_movements.quote_line_item_id not found';
    end if;
    select qu.user_id into li_user from public.quotes qu where qu.id = li_quote;
    if li_user <> new.user_id then
      raise exception 'inventory_movements.quote_line_item_id must belong to user_id';
    end if;
    if new.quote_id is not null and new.quote_id <> li_quote then
      raise exception 'inventory_movements.quote_id must match line item quote';
    end if;
  end if;

  return new;
end;
$$;

create trigger inventory_movements_enforce_refs
before insert or update on public.inventory_movements
for each row execute function public.enforce_inventory_movement_refs();

-- -----------------------------------------------------------------------------
-- 8) Triggers updated_at (reusa public.set_updated_at)
-- -----------------------------------------------------------------------------
create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger quotes_set_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

create trigger quote_line_items_set_updated_at
before update on public.quote_line_items
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 9) Row Level Security
-- -----------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.products enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;
alter table public.inventory_movements enable row level security;

-- clients
create policy "clients_select_own"
  on public.clients for select to authenticated
  using (user_id = auth.uid());

create policy "clients_insert_own"
  on public.clients for insert to authenticated
  with check (user_id = auth.uid());

create policy "clients_update_own"
  on public.clients for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "clients_delete_own"
  on public.clients for delete to authenticated
  using (user_id = auth.uid());

-- products
create policy "products_select_own"
  on public.products for select to authenticated
  using (user_id = auth.uid());

create policy "products_insert_own"
  on public.products for insert to authenticated
  with check (user_id = auth.uid());

create policy "products_update_own"
  on public.products for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "products_delete_own"
  on public.products for delete to authenticated
  using (user_id = auth.uid());

-- quotes
create policy "quotes_select_own"
  on public.quotes for select to authenticated
  using (user_id = auth.uid());

create policy "quotes_insert_own"
  on public.quotes for insert to authenticated
  with check (user_id = auth.uid());

create policy "quotes_update_own"
  on public.quotes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "quotes_delete_own"
  on public.quotes for delete to authenticated
  using (user_id = auth.uid());

-- quote_line_items (propiedad vía quote)
create policy "quote_line_items_select_own"
  on public.quote_line_items for select to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_line_items.quote_id
        and q.user_id = auth.uid()
    )
  );

create policy "quote_line_items_insert_own"
  on public.quote_line_items for insert to authenticated
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_line_items.quote_id
        and q.user_id = auth.uid()
    )
  );

create policy "quote_line_items_update_own"
  on public.quote_line_items for update to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_line_items.quote_id
        and q.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_line_items.quote_id
        and q.user_id = auth.uid()
    )
  );

create policy "quote_line_items_delete_own"
  on public.quote_line_items for delete to authenticated
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_line_items.quote_id
        and q.user_id = auth.uid()
    )
  );

-- inventory_movements
create policy "inventory_movements_select_own"
  on public.inventory_movements for select to authenticated
  using (user_id = auth.uid());

create policy "inventory_movements_insert_own"
  on public.inventory_movements for insert to authenticated
  with check (user_id = auth.uid());

create policy "inventory_movements_update_own"
  on public.inventory_movements for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "inventory_movements_delete_own"
  on public.inventory_movements for delete to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 10) Grants (API PostgREST)
-- -----------------------------------------------------------------------------
grant usage on type public.quote_status to authenticated;
grant usage on type public.inventory_movement_reason to authenticated;

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.quotes to authenticated;
grant select, insert, update, delete on public.quote_line_items to authenticated;
grant select, insert, update, delete on public.inventory_movements to authenticated;
