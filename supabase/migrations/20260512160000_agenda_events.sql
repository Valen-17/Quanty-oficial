-- =============================================================================
-- Quanty: agenda_events (AgendaEvent en src/domain/entities.ts).
-- scheduled_at = fecha+hora del compromiso; description = notas; location = ubicación.
-- client_id / quote_id opcionales (FK); client_name_snapshot = nombre mostrado (histórico).
-- =============================================================================

create table public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  title text not null,
  description text not null default '',
  location text not null default '',
  scheduled_at timestamptz not null,
  status text not null,
  client_name_snapshot text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint agenda_events_title_len check (char_length(trim(title)) between 2 and 80),
  constraint agenda_events_description_len check (char_length(description) <= 280),
  constraint agenda_events_location_len check (char_length(location) <= 120),
  constraint agenda_events_snapshot_len check (char_length(client_name_snapshot) <= 80),
  constraint agenda_events_status_domain check (
    status in ('pendiente', 'confirmado', 'completado', 'cancelado')
  )
);

comment on table public.agenda_events is 'Compromisos de agenda; scheduled_at combina date+time del dominio; soft delete.';
comment on column public.agenda_events.description is 'Notas (dominio AgendaEvent.notes).';
comment on column public.agenda_events.client_name_snapshot is 'Nombre cliente mostrado; congela histórico si client_id cambia.';

create index agenda_events_user_id_idx
  on public.agenda_events (user_id);

create index agenda_events_user_scheduled_desc_idx
  on public.agenda_events (user_id, scheduled_at desc);

create index agenda_events_user_client_idx
  on public.agenda_events (user_id, client_id)
  where client_id is not null;

create index agenda_events_user_quote_idx
  on public.agenda_events (user_id, quote_id)
  where quote_id is not null;

create trigger agenda_events_set_updated_at
before update on public.agenda_events
for each row execute function public.set_updated_at();

-- FK opcionales: misma org (mismo user_id) que la fila padre
create or replace function public.enforce_agenda_event_fks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is not null then
    if not exists (
      select 1 from public.clients c
      where c.id = new.client_id
        and c.user_id = new.user_id
        and c.deleted_at is null
    ) then
      raise exception 'agenda_events.client_id must reference an active client of the same user';
    end if;
  end if;

  if new.quote_id is not null then
    if not exists (
      select 1 from public.quotes q
      where q.id = new.quote_id
        and q.user_id = new.user_id
        and q.deleted_at is null
    ) then
      raise exception 'agenda_events.quote_id must reference an active quote of the same user';
    end if;
  end if;

  return new;
end;
$$;

create trigger agenda_events_enforce_fks
before insert or update of client_id, quote_id, user_id on public.agenda_events
for each row execute function public.enforce_agenda_event_fks();

alter table public.agenda_events enable row level security;

create policy "agenda_events_select_own"
  on public.agenda_events for select to authenticated
  using (user_id = auth.uid());

create policy "agenda_events_insert_own"
  on public.agenda_events for insert to authenticated
  with check (user_id = auth.uid());

create policy "agenda_events_update_own"
  on public.agenda_events for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "agenda_events_delete_own"
  on public.agenda_events for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.agenda_events to authenticated;
