/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */

-- 0003 · Funções chamadas pelo site e pelo painel.
--
-- Site (anônimo):  search_properties, get_property, list_featured_properties, submit_lead
-- Painel:          request_change, review_change_request, cancel_change_request
--
-- As funções do site devolvem apenas campos públicos. Endereço, proprietários e dados
-- internos nunca saem por aqui.

-- ---------------------------------------------------------------------------
-- Apoio
-- ---------------------------------------------------------------------------

create function app.agency_id_by_slug(p_slug text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.agencies where slug = lower(btrim(p_slug))
$$;

create function app.is_publicly_visible(p public.properties) returns boolean
language sql stable set search_path = '' as $$
  select p.published and p.status in ('available', 'reserved') and p.archived_at is null
$$;

create function app.public_property(p public.properties) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'code', p.code, 'title', p.title, 'description', p.description, 'type', p.type,
    'for_sale', p.for_sale, 'sale_price', p.sale_price, 'for_rent', p.for_rent, 'rent_price', p.rent_price,
    'condo_fee', p.condo_fee, 'iptu_monthly', p.iptu_monthly,
    'neighborhood', p.neighborhood, 'city', p.city, 'condominium', p.condominium,
    'bedrooms', p.bedrooms, 'suites', p.suites, 'bathrooms', p.bathrooms, 'parking', p.parking,
    'area_m2', p.area_m2, 'land_area_m2', p.land_area_m2,
    'status', p.status, 'featured', p.featured,
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', ph.storage_path, 'url', ph.external_url, 'position', ph.position)
                       order by ph.position, ph.created_at)
        from public.property_photos ph
       where ph.property_id = p.id
    ), '[]'::jsonb)
  )
$$;

-- Filtros aceitos:
--   purpose    'sale' | 'rent' | ausente (todos)
--   text       código, título, condomínio, bairro ou cidade (sem diferenciar acentos)
--   types      array de tipos (ex.: ["casa","sobrado"])
--   price      { "purpose": "sale"|"rent", "min": n, "max": n }
create function app.public_matches(p_agency uuid, p_filters jsonb) returns setof public.properties
language plpgsql stable security definer set search_path = '' as $$
declare
  v_purpose text := nullif(p_filters ->> 'purpose', '');
  v_text text := nullif(btrim(coalesce(p_filters ->> 'text', '')), '');
  v_types text[] := case when jsonb_typeof(p_filters -> 'types') = 'array'
                          and jsonb_array_length(p_filters -> 'types') > 0
                         then array(select jsonb_array_elements_text(p_filters -> 'types')) end;
  v_price_purpose text := nullif(p_filters -> 'price' ->> 'purpose', '');
  v_min numeric := nullif(p_filters -> 'price' ->> 'min', '')::numeric;
  v_max numeric := nullif(p_filters -> 'price' ->> 'max', '')::numeric;
  v_pattern text;
begin
  if v_text is not null then
    v_pattern := '%' || replace(replace(replace(extensions.unaccent(lower(v_text)), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  return query
    select p.*
      from public.properties p
     where p.agency_id = p_agency
       and app.is_publicly_visible(p)
       and (v_purpose is null or (v_purpose = 'sale' and p.for_sale) or (v_purpose = 'rent' and p.for_rent))
       and (v_types is null or p.type = any (v_types))
       and (v_pattern is null
            or extensions.unaccent(lower(concat_ws(' ', p.code, p.title, p.condominium, p.neighborhood, p.city))) like v_pattern)
       and (v_price_purpose is null or (
             case when v_price_purpose = 'rent'
                  then p.for_rent and p.rent_price is not null
                       and (v_min is null or p.rent_price >= v_min) and (v_max is null or p.rent_price <= v_max)
                  else p.for_sale and p.sale_price is not null
                       and (v_min is null or p.sale_price >= v_min) and (v_max is null or p.sale_price <= v_max)
             end));
end $$;

-- ---------------------------------------------------------------------------
-- Site: imóveis
-- ---------------------------------------------------------------------------

create function public.search_properties(p_agency_slug text, p_filters jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_agency uuid := app.agency_id_by_slug(p_agency_slug);
  v_page integer := greatest(coalesce(nullif(p_filters ->> 'page', '')::integer, 1), 1);
  v_size integer := least(greatest(coalesce(nullif(p_filters ->> 'page_size', '')::integer, 24), 1), 48);
  v_total integer;
  v_items jsonb;
begin
  select count(*) into v_total from app.public_matches(v_agency, p_filters);
  select coalesce(jsonb_agg(app.public_property(m) order by m.created_at desc, m.code), '[]'::jsonb)
    into v_items
    from (select * from app.public_matches(v_agency, p_filters) p
           order by p.created_at desc, p.code
           limit v_size offset (v_page - 1) * v_size) m;
  return jsonb_build_object('items', v_items, 'total', v_total, 'page', v_page, 'pageSize', v_size,
                            'hasNextPage', v_page * v_size < v_total);
end $$;

create function public.get_property(p_agency_slug text, p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select app.public_property(p)
    from public.properties p
   where p.agency_id = app.agency_id_by_slug(p_agency_slug)
     and upper(p.code) = upper(btrim(p_code))
     and app.is_publicly_visible(p)
$$;

create function public.list_featured_properties(p_agency_slug text, p_limit integer default 9) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(app.public_property(f) order by f.created_at desc, f.code), '[]'::jsonb)
    from (select p.* from public.properties p
           where p.agency_id = app.agency_id_by_slug(p_agency_slug)
             and p.featured and app.is_publicly_visible(p)
           order by p.created_at desc, p.code
           limit least(greatest(coalesce(p_limit, 9), 1), 24)) f
$$;

-- ---------------------------------------------------------------------------
-- Site: leads
-- ---------------------------------------------------------------------------

-- payload: { kind, name, phone, email?, message?, property_code?, details?, consent, website }
--   website  → campo-armadilha (honeypot): se vier preenchido, é robô; responde ok e descarta.
--   details  → dados do formulário de captação (lista fechada de chaves, textos curtos).
-- Erros devolvidos pelo campo "message" da exceção: invalid_kind, invalid_name, invalid_phone,
-- invalid_email, consent_required, rate_limited, unknown_agency.
create function public.submit_lead(p_agency_slug text, p_payload jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_agency uuid := app.agency_id_by_slug(p_agency_slug);
  v_kind text := coalesce(nullif(p_payload ->> 'kind', ''), 'general');
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_phone text := regexp_replace(coalesce(p_payload ->> 'phone', ''), '\D', '', 'g');
  v_email text := nullif(lower(btrim(coalesce(p_payload ->> 'email', ''))), '');
  v_message text := nullif(btrim(coalesce(p_payload ->> 'message', '')), '');
  v_property uuid;
  v_details jsonb := '{}'::jsonb;
  v_contact uuid;
begin
  if coalesce(btrim(p_payload ->> 'website'), '') <> '' then
    return jsonb_build_object('ok', true);
  end if;
  if v_agency is null then raise exception 'unknown_agency'; end if;
  if v_kind not in ('property_interest', 'owner_listing', 'general') then raise exception 'invalid_kind'; end if;
  if length(v_name) not between 2 and 120 then raise exception 'invalid_name'; end if;
  if length(v_phone) not between 10 and 13 then raise exception 'invalid_phone'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if coalesce((p_payload ->> 'consent')::boolean, false) is not true then raise exception 'consent_required'; end if;

  if (select count(*) from public.leads l join public.contacts c on c.id = l.contact_id
       where c.agency_id = v_agency and c.phone = v_phone and l.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;

  if nullif(p_payload ->> 'property_code', '') is not null then
    select p.id into v_property from public.properties p
     where p.agency_id = v_agency and upper(p.code) = upper(btrim(p_payload ->> 'property_code'))
       and app.is_publicly_visible(p);
  end if;

  if jsonb_typeof(p_payload -> 'details') = 'object' then
    select coalesce(jsonb_object_agg(key, left(value, 200)), '{}'::jsonb) into v_details
      from jsonb_each_text(p_payload -> 'details')
     where key in ('purpose', 'property_type', 'city', 'zip_code', 'address', 'address_number', 'address_complement');
  end if;
  if v_property is null and nullif(p_payload ->> 'property_code', '') is not null then
    v_details := v_details || jsonb_build_object('property_code', left(p_payload ->> 'property_code', 30));
  end if;

  -- Contato existente é reaproveitado; nome e e-mail já cadastrados não são sobrescritos pelo site.
  insert into public.contacts (agency_id, name, phone, email, created_by)
  values (v_agency, left(v_name, 120), v_phone, v_email, null)
  on conflict (agency_id, phone) where phone is not null
  do update set email = coalesce(public.contacts.email, excluded.email)
  returning id into v_contact;

  insert into public.leads (agency_id, contact_id, property_id, kind, origin, message, details, consent_at, created_by)
  values (v_agency, v_contact, v_property, v_kind, 'site', left(v_message, 2000), v_details, now(), null);

  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- Painel: alterações pendentes de aprovação
-- ---------------------------------------------------------------------------

-- Corretor pede uma alteração protegida.
--   property · update  payload com campos protegidos (published, sale_price, status...)
--   property · archive | delete
--   owner    · update  payload { responsible_user_id } (transferência) e/ou { status }
--   owner    · delete
create function public.request_change(p_entity text, p_entity_id uuid, p_action text,
                                      p_payload jsonb default '{}'::jsonb, p_reason text default null) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_agency uuid;
  v_allowed text[];
  v_invalid text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;

  if p_entity = 'property' then
    select agency_id into v_agency from public.properties where id = p_entity_id;
    if v_agency is null or not app.can_edit_property(p_entity_id) then raise exception 'forbidden' using errcode = '42501'; end if;
    if p_action not in ('update', 'archive', 'delete') then raise exception 'invalid_action'; end if;
    v_allowed := array['published', 'featured', 'for_sale', 'sale_price', 'for_rent', 'rent_price', 'status', 'responsible_user_id', 'code'];
  elsif p_entity = 'owner' then
    select agency_id into v_agency from public.owners where id = p_entity_id;
    if v_agency is null or not app.can_manage_owner(p_entity_id) then raise exception 'forbidden' using errcode = '42501'; end if;
    if p_action not in ('update', 'delete') then raise exception 'invalid_action'; end if;
    v_allowed := array['responsible_user_id', 'status'];
  else
    raise exception 'invalid_entity';
  end if;

  p_payload := coalesce(p_payload, '{}'::jsonb);
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid_payload'; end if;
  if p_action = 'update' then
    if p_payload = '{}'::jsonb then raise exception 'empty_payload'; end if;
    select key into v_invalid from jsonb_object_keys(p_payload) key where key <> all (v_allowed) limit 1;
    if v_invalid is not null then raise exception 'invalid_field' using detail = v_invalid; end if;
  elsif p_payload <> '{}'::jsonb then
    raise exception 'invalid_payload';
  end if;

  insert into public.change_requests (agency_id, entity, entity_id, action, payload, reason, requested_by)
  values (v_agency, p_entity, p_entity_id, p_action, p_payload, left(p_reason, 1000), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Admin aprova ou rejeita. Na aprovação a alteração é aplicada com o usuário do admin,
-- portanto passa pelas mesmas regras (constraints e trigger) de uma edição direta dele.
create function public.review_change_request(p_id uuid, p_approve boolean, p_note text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_request public.change_requests;
  v_payload jsonb;
  v_found boolean;
begin
  select * into v_request from public.change_requests where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if not app.is_admin(v_request.agency_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_request.status <> 'pending' then raise exception 'not_pending'; end if;

  if p_approve then
    v_payload := v_request.payload;
    if v_request.entity = 'property' and v_request.action = 'update' then
      update public.properties set
        published           = case when v_payload ? 'published' then (v_payload ->> 'published')::boolean else published end,
        featured            = case when v_payload ? 'featured' then (v_payload ->> 'featured')::boolean else featured end,
        for_sale            = case when v_payload ? 'for_sale' then (v_payload ->> 'for_sale')::boolean else for_sale end,
        sale_price          = case when v_payload ? 'sale_price' then (v_payload ->> 'sale_price')::numeric else sale_price end,
        for_rent            = case when v_payload ? 'for_rent' then (v_payload ->> 'for_rent')::boolean else for_rent end,
        rent_price          = case when v_payload ? 'rent_price' then (v_payload ->> 'rent_price')::numeric else rent_price end,
        status              = case when v_payload ? 'status' then v_payload ->> 'status' else status end,
        responsible_user_id = case when v_payload ? 'responsible_user_id' then (v_payload ->> 'responsible_user_id')::uuid else responsible_user_id end,
        code                = case when v_payload ? 'code' then upper(btrim(v_payload ->> 'code')) else code end
       where id = v_request.entity_id;
    elsif v_request.entity = 'property' and v_request.action = 'archive' then
      update public.properties set archived_at = now(), published = false where id = v_request.entity_id;
    elsif v_request.entity = 'property' and v_request.action = 'delete' then
      delete from public.properties where id = v_request.entity_id;
    elsif v_request.entity = 'owner' and v_request.action = 'update' then
      update public.owners set
        responsible_user_id = case when v_payload ? 'responsible_user_id' then (v_payload ->> 'responsible_user_id')::uuid else responsible_user_id end,
        status              = case when v_payload ? 'status' then v_payload ->> 'status' else status end
       where id = v_request.entity_id;
    elsif v_request.entity = 'owner' and v_request.action = 'delete' then
      delete from public.owners where id = v_request.entity_id;
    end if;
    v_found := found;
    if not v_found then raise exception 'entity_not_found'; end if;
  end if;

  update public.change_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(p_note, 1000)
   where id = p_id;

  return jsonb_build_object('id', p_id, 'status', case when p_approve then 'approved' else 'rejected' end);
end $$;

create function public.cancel_change_request(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.change_requests set status = 'cancelled'
   where id = p_id and status = 'pending' and requested_by = auth.uid();
  if not found then raise exception 'not_found_or_not_pending'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------

revoke all on all functions in schema app from public, anon;
grant execute on all functions in schema app to authenticated;

revoke all on function public.search_properties(text, jsonb), public.get_property(text, text),
  public.list_featured_properties(text, integer), public.submit_lead(text, jsonb),
  public.request_change(text, uuid, text, jsonb, text), public.review_change_request(uuid, boolean, text),
  public.cancel_change_request(uuid)
  from public, anon, authenticated;

grant execute on function public.search_properties(text, jsonb), public.get_property(text, text),
  public.list_featured_properties(text, integer), public.submit_lead(text, jsonb)
  to anon, authenticated;

grant execute on function public.request_change(text, uuid, text, jsonb, text),
  public.review_change_request(uuid, boolean, text), public.cancel_change_request(uuid)
  to authenticated;
