/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */

-- 0006 · Gestão da equipe pelo painel (somente administradores).
--
--   list_team            equipe com e-mail, último acesso e tamanho da carteira
--   add_member_by_email  vincula à imobiliária um usuário que já tem login
--   transfer_portfolio   passa proprietários, imóveis e leads abertos de um corretor para outro
--   + trigger que impede a imobiliária de ficar sem administrador ativo
--
-- Pode ser executado mais de uma vez.

create or replace function app.ensure_active_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.agency_members
                  where agency_id = old.agency_id and role = 'admin' and active) then
    raise exception 'last_admin' using errcode = '42501', hint = 'A imobiliária precisa de pelo menos um administrador ativo.';
  end if;
  return null;
end $$;

drop trigger if exists ensure_active_admin on public.agency_members;
create trigger ensure_active_admin after update or delete on public.agency_members
for each row execute function app.ensure_active_admin();

create or replace function public.list_team(p_agency uuid)
returns table (user_id uuid, full_name text, phone text, role text, active boolean, email text,
               last_sign_in_at timestamptz, created_at timestamptz, owners integer, properties integer, open_leads integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_admin(p_agency) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select m.user_id, m.full_name, m.phone, m.role, m.active, u.email::text, u.last_sign_in_at, m.created_at,
           (select count(*)::int from public.owners o where o.agency_id = p_agency and o.responsible_user_id = m.user_id),
           (select count(*)::int from public.properties p where p.agency_id = p_agency and p.responsible_user_id = m.user_id and p.archived_at is null),
           (select count(*)::int from public.leads l where l.agency_id = p_agency and l.assigned_to = m.user_id and l.status in ('new', 'in_progress'))
      from public.agency_members m
      join auth.users u on u.id = m.user_id
     where m.agency_id = p_agency
     order by m.active desc, m.full_name;
end $$;

create or replace function public.add_member_by_email(p_agency uuid, p_email text, p_full_name text, p_role text default 'agent')
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  if not app.is_admin(p_agency) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role not in ('admin', 'agent') then raise exception 'invalid_role'; end if;
  if length(btrim(coalesce(p_full_name, ''))) < 2 then raise exception 'invalid_name'; end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then raise exception 'user_not_found'; end if;
  if exists (select 1 from public.agency_members where agency_id = p_agency and user_id = v_user) then
    raise exception 'already_member';
  end if;
  insert into public.agency_members (agency_id, user_id, role, full_name) values (p_agency, v_user, p_role, btrim(p_full_name));
  return v_user;
end $$;

create or replace function public.transfer_portfolio(p_agency uuid, p_from uuid, p_to uuid)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_owners integer;
  v_properties integer;
  v_leads integer;
begin
  if not app.is_admin(p_agency) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from = p_to then raise exception 'same_member'; end if;
  if not exists (select 1 from public.agency_members where agency_id = p_agency and user_id = p_to and active) then
    raise exception 'target_not_active';
  end if;
  update public.owners set responsible_user_id = p_to where agency_id = p_agency and responsible_user_id = p_from;
  get diagnostics v_owners = row_count;
  update public.properties set responsible_user_id = p_to where agency_id = p_agency and responsible_user_id = p_from and archived_at is null;
  get diagnostics v_properties = row_count;
  update public.leads set assigned_to = p_to where agency_id = p_agency and assigned_to = p_from and status in ('new', 'in_progress');
  get diagnostics v_leads = row_count;
  return jsonb_build_object('owners', v_owners, 'properties', v_properties, 'leads', v_leads);
end $$;

revoke all on function public.list_team(uuid), public.add_member_by_email(uuid, text, text, text),
  public.transfer_portfolio(uuid, uuid, uuid) from public, anon;
grant execute on function public.list_team(uuid), public.add_member_by_email(uuid, text, text, text),
  public.transfer_portfolio(uuid, uuid, uuid) to authenticated;
revoke all on function app.ensure_active_admin() from public, anon;
