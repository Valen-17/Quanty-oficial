ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_employees boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS employee_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_employee_count_nonneg CHECK (employee_count >= 0);

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS labor_workers integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_hours numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_rate numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_employee_amount numeric(14, 2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    business_name,
    phone,
    email,
    has_employees,
    employee_count
  )
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'business_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.email, ''),
    coalesce((new.raw_user_meta_data ->> 'has_employees')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'employee_count')::integer, 0)
  )
  ON CONFLICT (id) DO UPDATE SET
    has_employees = coalesce((new.raw_user_meta_data ->> 'has_employees')::boolean, false),
    employee_count = coalesce((new.raw_user_meta_data ->> 'employee_count')::integer, 0);
  RETURN new;
END;
$$;
