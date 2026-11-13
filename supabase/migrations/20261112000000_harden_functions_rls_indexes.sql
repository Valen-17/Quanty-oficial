revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_quote_client_same_user() from public, anon, authenticated;
revoke execute on function public.enforce_quote_line_product_same_user() from public, anon, authenticated;
revoke execute on function public.enforce_inventory_movement_refs() from public, anon, authenticated;
revoke execute on function public.enforce_agenda_event_fks() from public, anon, authenticated;
revoke execute on function public.approve_quote(uuid) from public, anon;
grant execute on function public.approve_quote(uuid) to authenticated;

alter policy "Profiles are viewable by owner" on public.profiles using ((select auth.uid()) = id);
alter policy "Users can insert their own profile" on public.profiles with check ((select auth.uid()) = id);
alter policy "Users can update their own profile" on public.profiles using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

alter policy "clients_select_own" on public.clients using (user_id = (select auth.uid()));
alter policy "clients_insert_own" on public.clients with check (user_id = (select auth.uid()));
alter policy "clients_update_own" on public.clients using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "clients_delete_own" on public.clients using (user_id = (select auth.uid()));

alter policy "products_select_own" on public.products using (user_id = (select auth.uid()));
alter policy "products_insert_own" on public.products with check (user_id = (select auth.uid()));
alter policy "products_update_own" on public.products using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "products_delete_own" on public.products using (user_id = (select auth.uid()));

alter policy "quotes_select_own" on public.quotes using (user_id = (select auth.uid()));
alter policy "quotes_insert_own" on public.quotes with check (user_id = (select auth.uid()));
alter policy "quotes_update_own" on public.quotes using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "quotes_delete_own" on public.quotes using (user_id = (select auth.uid()));

alter policy "inventory_movements_select_own" on public.inventory_movements using (user_id = (select auth.uid()));
alter policy "inventory_movements_insert_own" on public.inventory_movements with check (user_id = (select auth.uid()));
alter policy "inventory_movements_update_own" on public.inventory_movements using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "inventory_movements_delete_own" on public.inventory_movements using (user_id = (select auth.uid()));

alter policy "expenses_select_own" on public.expenses using (user_id = (select auth.uid()));
alter policy "expenses_insert_own" on public.expenses with check (user_id = (select auth.uid()));
alter policy "expenses_update_own" on public.expenses using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "expenses_delete_own" on public.expenses using (user_id = (select auth.uid()));

alter policy "agenda_events_select_own" on public.agenda_events using (user_id = (select auth.uid()));
alter policy "agenda_events_insert_own" on public.agenda_events with check (user_id = (select auth.uid()));
alter policy "agenda_events_update_own" on public.agenda_events using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "agenda_events_delete_own" on public.agenda_events using (user_id = (select auth.uid()));

alter policy "quote_line_items_select_own" on public.quote_line_items using (exists (select 1 from public.quotes q where q.id = quote_line_items.quote_id and q.user_id = (select auth.uid())));
alter policy "quote_line_items_insert_own" on public.quote_line_items with check (exists (select 1 from public.quotes q where q.id = quote_line_items.quote_id and q.user_id = (select auth.uid())));
alter policy "quote_line_items_update_own" on public.quote_line_items using (exists (select 1 from public.quotes q where q.id = quote_line_items.quote_id and q.user_id = (select auth.uid()))) with check (exists (select 1 from public.quotes q where q.id = quote_line_items.quote_id and q.user_id = (select auth.uid())));
alter policy "quote_line_items_delete_own" on public.quote_line_items using (exists (select 1 from public.quotes q where q.id = quote_line_items.quote_id and q.user_id = (select auth.uid())));

create index if not exists quotes_client_id_idx on public.quotes (client_id) where client_id is not null;
create index if not exists agenda_events_client_id_idx on public.agenda_events (client_id) where client_id is not null;
create index if not exists agenda_events_quote_id_idx on public.agenda_events (quote_id) where quote_id is not null;
