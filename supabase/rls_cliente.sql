-- Execute no SQL Editor do Supabase.
-- As regras abaixo permitem CRUD apenas para usuarios autenticados pelo Supabase Auth.
-- Nao libere CPF/CNPJ publicamente usando politicas para o papel anon.

alter table public.cliente enable row level security;

grant select, insert, update, delete on table public.cliente to authenticated;

drop policy if exists "authenticated can select clientes" on public.cliente;
drop policy if exists "authenticated can insert clientes" on public.cliente;
drop policy if exists "authenticated can update clientes" on public.cliente;
drop policy if exists "authenticated can delete clientes" on public.cliente;

create policy "authenticated can select clientes"
on public.cliente for select
to authenticated
using (true);

create policy "authenticated can insert clientes"
on public.cliente for insert
to authenticated
with check (true);

create policy "authenticated can update clientes"
on public.cliente for update
to authenticated
using (true)
with check (true);

create policy "authenticated can delete clientes"
on public.cliente for delete
to authenticated
using (true);
