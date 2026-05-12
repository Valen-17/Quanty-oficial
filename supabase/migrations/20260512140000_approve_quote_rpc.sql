-- RPC transaccional: aprobar cotización, descontar stock, registrar inventory_movements (idempotente si ya aprobada).
-- SECURITY INVOKER: RLS y auth.uid() aplican al rol que llama.

create or replace function public.approve_quote(p_quote_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  r_quote public.quotes%rowtype;
  r_line public.quote_line_items%rowtype;
  r_prod public.products%rowtype;
  v_needed bigint;
  v_rc int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into r_quote
  from public.quotes
  where id = p_quote_id
    and user_id = v_uid
    and deleted_at is null
  for update;

  if not found then
    raise exception 'QUOTE_NOT_FOUND_OR_FORBIDDEN';
  end if;

  if r_quote.status = 'aprobada'::public.quote_status then
    return jsonb_build_object(
      'ok', true,
      'already_approved', true,
      'quote_id', p_quote_id
    );
  end if;

  if r_quote.status = 'rechazada'::public.quote_status then
    raise exception 'QUOTE_REJECTED';
  end if;

  if not exists (
    select 1 from public.quote_line_items qli where qli.quote_id = p_quote_id
  ) then
    raise exception 'QUOTE_HAS_NO_LINES';
  end if;

  if exists (
    select 1
    from public.quote_line_items qli
    where qli.quote_id = p_quote_id
      and qli.quantity > 0
      and qli.product_id is null
  ) then
    raise exception 'QUOTE_LINE_MISSING_PRODUCT';
  end if;

  if exists (
    select 1
    from public.quote_line_items qli
    where qli.quote_id = p_quote_id
      and qli.product_id is not null
      and not exists (
        select 1
        from public.products p
        where p.id = qli.product_id
          and p.user_id = v_uid
          and p.deleted_at is null
      )
  ) then
    raise exception 'PRODUCT_NOT_AVAILABLE';
  end if;

  for r_prod in
    select p.*
    from public.products p
    where p.id in (
      select distinct qli.product_id
      from public.quote_line_items qli
      where qli.quote_id = p_quote_id
        and qli.product_id is not null
    )
      and p.user_id = v_uid
      and p.deleted_at is null
    order by p.id
    for update
  loop
    select coalesce(sum(qli.quantity), 0)::bigint into v_needed
    from public.quote_line_items qli
    where qli.quote_id = p_quote_id
      and qli.product_id = r_prod.id;

    if r_prod.units < v_needed then
      raise exception 'INSUFFICIENT_STOCK' using message =
        format('producto %s: requiere %s unidades, hay %s', r_prod.id, v_needed, r_prod.units);
    end if;
  end loop;

  for r_line in
    select *
    from public.quote_line_items
    where quote_id = p_quote_id
    order by line_no
  loop
    if r_line.product_id is null then
      continue;
    end if;

    if exists (
      select 1
      from public.inventory_movements im
      where im.quote_line_item_id = r_line.id
        and im.reason = 'quote_approval'::public.inventory_movement_reason
    ) then
      continue;
    end if;

    update public.products
    set
      units = units - r_line.quantity,
      updated_at = v_now
    where id = r_line.product_id
      and user_id = v_uid
      and deleted_at is null;

    get diagnostics v_rc = ROW_COUNT;
    if v_rc <> 1 then
      raise exception 'PRODUCT_UPDATE_FAILED';
    end if;

    insert into public.inventory_movements (
      user_id,
      product_id,
      delta,
      reason,
      quote_id,
      quote_line_item_id,
      created_at
    )
    values (
      v_uid,
      r_line.product_id,
      -r_line.quantity,
      'quote_approval'::public.inventory_movement_reason,
      p_quote_id,
      r_line.id,
      v_now
    );
  end loop;

  update public.quotes
  set
    status = 'aprobada'::public.quote_status,
    approved_at = v_now,
    updated_at = v_now
  where id = p_quote_id;

  return jsonb_build_object(
    'ok', true,
    'already_approved', false,
    'quote_id', p_quote_id
  );
end;
$$;

comment on function public.approve_quote(uuid) is
  'Aprueba cotización en una transacción: bloqueo FOR UPDATE, validación de stock, movimientos quote_approval, idempotente si ya aprobada.';

revoke all on function public.approve_quote(uuid) from public;
grant execute on function public.approve_quote(uuid) to authenticated;
