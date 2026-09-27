/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */

-- 0002 · Segurança: quem pode ver e alterar o quê.
--
-- Regras gerais
--   admin  → tudo da sua imobiliária
--   agent  → estoque de imóveis (leitura), imóveis de que é responsável (edição),
--            somente os seus proprietários e os leads atribuídos a ele
--   anon   → nenhuma tabela; o site usa apenas as funções de 0003_public_api.sql
--
-- RLS filtra linhas. Campos protegidos (preço, publicação, status...) são controlados
-- por trigger, porque RLS não distingue colunas.

-- ---------------------------------------------------------------------------
-- Funções de permissão (security definer: consultam agency_members sem recursão de RLS)
-- ---------------------------------------------------------------------------

create function app.member_role(p_agency uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.agency_members
   where agency_id = p_agency and user_id = auth.uid() and active
$$;

create function app.is_member(p_agency uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.member_role(p_agency) is not null
$$;

create function app.is_admin(p_agency uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(app.member_role(p_agency) = 'admin', false)
$$;

create function app.can_edit_property(p_property uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.properties p
     where p.id = p_property
       and (app.is_admin(p.agency_id) or (app.is_member(p.agency_id) and p.responsible_user_id = auth.uid()))
  )
$$;

create function app.can_manage_owner(p_owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.owners o
     where o.id = p_owner
       and (app.is_admin(o.agency_id) or (app.is_member(o.agency_id) and o.responsible_user_id = auth.uid()))
  )
$$;

-- Corretor vê um contato se o cadastrou, se é responsável por um proprietário ligado a ele
-- ou se atende um lead dele.
create function app.can_view_contact(p_contact uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contacts c
     where c.id = p_contact
       and (
         app.is_admin(c.agency_id)
         or (app.is_member(c.agency_id) and (
              c.created_by = auth.uid()
              or exists (select 1 from public.owners o where o.contact_id = c.id and o.responsible_user_id = auth.uid())
              or exists (select 1 from public.leads l where l.contact_id = c.id and l.assigned_to = auth.uid())
            ))
       )
  )
$$;

-- Para alterar, além de ver: o contato não pode ser proprietário na carteira de outro corretor.
create function app.can_edit_contact(p_contact uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contacts c
     where c.id = p_contact
       and (
         app.is_admin(c.agency_id)
         or (app.can_view_contact(c.id)
             and not exists (select 1 from public.owners o where o.contact_id = c.id and o.responsible_user_id <> auth.uid()))
       )
  )
$$;

create function app.can_access_lead(p_lead uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.leads l
     where l.id = p_lead
       and (app.is_admin(l.agency_id) or (app.is_member(l.agency_id) and l.assigned_to = auth.uid()))
  )
$$;

-- ---------------------------------------------------------------------------
-- Campos protegidos: alteração direta só por admin; corretor usa change_requests.
-- ---------------------------------------------------------------------------

-- Lista padrão. Cada imobiliária pode sobrescrever em
-- agencies.settings -> 'approval_rules' -> 'property_fields'.
create function app.protected_property_fields(p_agency uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select array(select jsonb_array_elements_text(a.settings -> 'approval_rules' -> 'property_fields'))
       from public.agencies a
      where a.id = p_agency and jsonb_typeof(a.settings -> 'approval_rules' -> 'property_fields') = 'array'),
    array['published', 'featured', 'for_sale', 'sale_price', 'for_rent', 'rent_price', 'status', 'responsible_user_id', 'code', 'archived_at']
  )
$$;

create function app.enforce_property_rules() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_field text;
begin
  if tg_op = 'UPDATE' and new.agency_id <> old.agency_id then
    raise exception 'Um imóvel não pode mudar de imobiliária.' using errcode = '42501';
  end if;

  -- Sem usuário autenticado (SQL Editor, service role, importadores): regras de negócio não se aplicam.
  -- Visitantes anônimos nunca chegam aqui, pois não têm permissão de escrita nas tabelas.
  if auth.uid() is null or app.is_admin(new.agency_id) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Imóvel cadastrado por corretor nasce como rascunho, sob sua responsabilidade.
    new.published := false;
    new.featured := false;
    new.archived_at := null;
    new.responsible_user_id := auth.uid();
    new.created_by := auth.uid();
    return new;
  end if;

  foreach v_field in array app.protected_property_fields(new.agency_id) loop
    if (to_jsonb(new) -> v_field) is distinct from (to_jsonb(old) -> v_field) then
      raise exception 'approval_required'
        using errcode = '42501',
              detail = v_field,
              hint = 'Solicite a alteração ao administrador (public.request_change).';
    end if;
  end loop;
  return new;
end $$;

create trigger enforce_property_rules before insert or update on public.properties
for each row execute function app.enforce_property_rules();

-- ---------------------------------------------------------------------------
-- Histórico automático dos leads
-- ---------------------------------------------------------------------------

create function app.log_lead_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_activities (agency_id, lead_id, user_id, type, data)
    values (new.agency_id, new.id, auth.uid(), 'created', jsonb_build_object('origin', new.origin, 'kind', new.kind));
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.lead_activities (agency_id, lead_id, user_id, type, data)
    values (new.agency_id, new.id, auth.uid(), 'status_change', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.lead_activities (agency_id, lead_id, user_id, type, data)
    values (new.agency_id, new.id, auth.uid(), 'assignment', jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to));
  end if;
  return new;
end $$;

create trigger log_lead_activity after insert or update on public.leads
for each row execute function app.log_lead_activity();

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------

-- Visitantes não acessam tabelas; usuários logados passam pelas políticas abaixo.
revoke all on public.agencies, public.agency_members, public.contacts, public.owners, public.properties,
  public.property_owners, public.property_photos, public.leads, public.lead_activities, public.change_requests
  from anon, public;

grant select, insert, update, delete on public.agencies, public.agency_members, public.contacts, public.owners,
  public.properties, public.property_owners, public.property_photos, public.leads, public.lead_activities
  to authenticated;
-- change_requests só é alterada pelas funções request/review/cancel (0003).
grant select on public.change_requests to authenticated;

grant usage on schema app to authenticated;
revoke all on all functions in schema app from public, anon;
grant execute on all functions in schema app to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas (RLS)
-- ---------------------------------------------------------------------------

alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.contacts enable row level security;
alter table public.owners enable row level security;
alter table public.properties enable row level security;
alter table public.property_owners enable row level security;
alter table public.property_photos enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.change_requests enable row level security;

-- Imobiliária: membros leem; admin altera. Criação somente pelo SQL Editor / service role.
create policy agencies_select on public.agencies for select to authenticated using (app.is_member(id));
create policy agencies_update on public.agencies for update to authenticated using (app.is_admin(id)) with check (app.is_admin(id));

-- Equipe: membros veem a equipe; admin gerencia.
create policy members_select on public.agency_members for select to authenticated using (app.is_member(agency_id));
create policy members_insert on public.agency_members for insert to authenticated with check (app.is_admin(agency_id));
create policy members_update on public.agency_members for update to authenticated using (app.is_admin(agency_id)) with check (app.is_admin(agency_id));
create policy members_delete on public.agency_members for delete to authenticated using (app.is_admin(agency_id));

-- Contatos
create policy contacts_select on public.contacts for select to authenticated using (app.can_view_contact(id));
create policy contacts_insert on public.contacts for insert to authenticated
  with check (app.is_member(agency_id) and (created_by = auth.uid() or app.is_admin(agency_id)));
create policy contacts_update on public.contacts for update to authenticated
  using (app.can_edit_contact(id)) with check (app.is_member(agency_id));
create policy contacts_delete on public.contacts for delete to authenticated using (app.is_admin(agency_id));

-- Proprietários: corretor só enxerga e altera os seus; transferir exige admin.
create policy owners_select on public.owners for select to authenticated
  using (app.is_admin(agency_id) or (app.is_member(agency_id) and responsible_user_id = auth.uid()));
create policy owners_insert on public.owners for insert to authenticated
  with check (
    (app.is_admin(agency_id) or (app.is_member(agency_id) and responsible_user_id = auth.uid()))
    and app.can_edit_contact(contact_id)
  );
create policy owners_update on public.owners for update to authenticated
  using (app.is_admin(agency_id) or (app.is_member(agency_id) and responsible_user_id = auth.uid()))
  with check (app.is_admin(agency_id) or (app.is_member(agency_id) and responsible_user_id = auth.uid()));
create policy owners_delete on public.owners for delete to authenticated using (app.is_admin(agency_id));

-- Imóvel ↔ proprietário: visível e editável apenas para quem gerencia o proprietário.
create policy property_owners_select on public.property_owners for select to authenticated
  using (app.can_manage_owner(owner_id));
create policy property_owners_insert on public.property_owners for insert to authenticated
  with check (app.can_manage_owner(owner_id) and app.can_edit_property(property_id));
create policy property_owners_update on public.property_owners for update to authenticated
  using (app.can_manage_owner(owner_id) and app.can_edit_property(property_id))
  with check (app.can_manage_owner(owner_id) and app.can_edit_property(property_id));
create policy property_owners_delete on public.property_owners for delete to authenticated
  using (app.can_manage_owner(owner_id) and app.can_edit_property(property_id));

-- Imóveis: todo o estoque é visível à equipe; edição pelo responsável ou admin.
create policy properties_select on public.properties for select to authenticated using (app.is_member(agency_id));
create policy properties_insert on public.properties for insert to authenticated with check (app.is_member(agency_id));
create policy properties_update on public.properties for update to authenticated
  using (app.is_admin(agency_id) or (app.is_member(agency_id) and responsible_user_id = auth.uid()))
  with check (app.is_admin(agency_id) or (app.is_member(agency_id) and responsible_user_id = auth.uid()));
create policy properties_delete on public.properties for delete to authenticated using (app.is_admin(agency_id));

-- Fotos
create policy photos_select on public.property_photos for select to authenticated using (app.is_member(agency_id));
create policy photos_insert on public.property_photos for insert to authenticated with check (app.can_edit_property(property_id));
create policy photos_update on public.property_photos for update to authenticated
  using (app.can_edit_property(property_id)) with check (app.can_edit_property(property_id));
create policy photos_delete on public.property_photos for delete to authenticated using (app.can_edit_property(property_id));

-- Leads: admin vê todos e distribui; corretor vê e trabalha os atribuídos a ele.
create policy leads_select on public.leads for select to authenticated
  using (app.is_admin(agency_id) or (app.is_member(agency_id) and assigned_to = auth.uid()));
create policy leads_insert on public.leads for insert to authenticated
  with check (app.is_admin(agency_id) or (app.is_member(agency_id) and assigned_to = auth.uid()));
create policy leads_update on public.leads for update to authenticated
  using (app.is_admin(agency_id) or (app.is_member(agency_id) and assigned_to = auth.uid()))
  with check (app.is_admin(agency_id) or (app.is_member(agency_id) and assigned_to = auth.uid()));
create policy leads_delete on public.leads for delete to authenticated using (app.is_admin(agency_id));

-- Histórico do lead: leitura para quem acessa o lead; manualmente só se adicionam notas.
create policy lead_activities_select on public.lead_activities for select to authenticated using (app.can_access_lead(lead_id));
create policy lead_activities_insert on public.lead_activities for insert to authenticated
  with check (app.can_access_lead(lead_id) and type = 'note' and user_id = auth.uid());
create policy lead_activities_delete on public.lead_activities for delete to authenticated using (app.is_admin(agency_id));

-- Solicitações: admin vê as da imobiliária; corretor vê as suas.
create policy change_requests_select on public.change_requests for select to authenticated
  using (app.is_admin(agency_id) or (app.is_member(agency_id) and requested_by = auth.uid()));
