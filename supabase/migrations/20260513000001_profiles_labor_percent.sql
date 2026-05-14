alter table public.profiles
  add column if not exists labor_percent numeric not null default 20
    check (labor_percent >= 0 and labor_percent <= 100);
