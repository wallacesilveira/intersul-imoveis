/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */

-- 0005 · Correção: contato recém-cadastrado não podia ser lido de volta.
--
-- A política de leitura de contacts procurava o próprio contato na tabela pelo id.
-- Durante o INSERT ... RETURNING o registro novo ainda não é visível para essa consulta,
-- então o banco recusava devolvê-lo e o cadastro falhava com "violates row-level security".
-- A nova versão usa os valores da própria linha (agency_id, created_by) e só consulta
-- outras tabelas (owners, leads) para os demais casos.

create or replace function app.can_view_contact_row(p_agency uuid, p_contact uuid, p_created_by uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_admin(p_agency)
      or (app.is_member(p_agency) and (
            p_created_by = auth.uid()
            or exists (select 1 from public.owners o where o.contact_id = p_contact and o.responsible_user_id = auth.uid())
            or exists (select 1 from public.leads l where l.contact_id = p_contact and l.assigned_to = auth.uid())
          ))
$$;

revoke all on function app.can_view_contact_row(uuid, uuid, uuid) from public, anon;
grant execute on function app.can_view_contact_row(uuid, uuid, uuid) to authenticated;

drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts for select to authenticated
  using (app.can_view_contact_row(agency_id, id, created_by));
