-- Soft delete en cotizaciones (listados remotos excluyen deleted_at).
alter table public.quotes add column if not exists deleted_at timestamptz;

create index if not exists quotes_user_id_active_idx
  on public.quotes (user_id, created_at desc)
  where deleted_at is null;

comment on column public.quotes.deleted_at is 'Archivado lógico; líneas se conservan por FK hasta limpieza explícita.';
