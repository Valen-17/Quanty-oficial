-- =============================================================================
-- Quanty: expenses (Expense en src/domain/entities.ts; fijo | variable).
-- Convenciones: mismas que clients/products (RLS por user_id, updated_at, grants).
-- =============================================================================

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  concept text not null,
  amount numeric(18, 4) not null,
  type text not null,
  category text not null default '',
  expense_date timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint expenses_amount_positive check (amount > 0),
  constraint expenses_type_domain check (type in ('fijo', 'variable')),
  constraint expenses_concept_len check (char_length(trim(concept)) between 2 and 80),
  constraint expenses_category_len check (char_length(category) <= 40)
);

comment on table public.expenses is 'Gastos por usuario; type alinea expenseTypeSchema (fijo|variable); expense_date mapea Expense.date.';
comment on column public.expenses.type is 'fijo | variable (mismo literal que el dominio Zod y selectExpenseTotals).';
comment on column public.expenses.expense_date is 'Fecha del gasto; selectFinanceSeries agrupa por mes vía expense_date.';
comment on column public.expenses.deleted_at is 'Soft delete; totales en UI pueden filtrar deleted_at is null al sincronizar.';

create index expenses_user_id_idx
  on public.expenses (user_id);

create index expenses_user_id_expense_date_desc_idx
  on public.expenses (user_id, expense_date desc);

create index expenses_user_id_category_idx
  on public.expenses (user_id, category);

create index expenses_user_id_type_idx
  on public.expenses (user_id, type);

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;

create policy "expenses_select_own"
  on public.expenses for select to authenticated
  using (user_id = auth.uid());

create policy "expenses_insert_own"
  on public.expenses for insert to authenticated
  with check (user_id = auth.uid());

create policy "expenses_update_own"
  on public.expenses for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "expenses_delete_own"
  on public.expenses for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.expenses to authenticated;
