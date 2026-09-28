/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */

-- Testes de permissões e regras de negócio.
--
-- Rode no SQL Editor depois das migrations. O script cria uma imobiliária de teste
-- (admin, corretor A, corretor B), executa cada verificação como aquele usuário e,
-- no final, gera um erro proposital com o relatório: isso desfaz todos os dados de teste.
-- Resultado esperado: "RESULTADO: N de N testes passaram".

do $test$
declare
  agency constant uuid := '11111111-0000-4000-8000-000000000001';
  admin_id constant uuid := '11111111-0000-4000-8000-0000000000a1';
  agent_a constant uuid := '11111111-0000-4000-8000-0000000000b1';
  agent_b constant uuid := '11111111-0000-4000-8000-0000000000c1';
  joao constant uuid := '11111111-0000-4000-8000-000000000101';
  maria constant uuid := '11111111-0000-4000-8000-000000000102';
  owner_joao constant uuid := '11111111-0000-4000-8000-000000000201';
  owner_maria constant uuid := '11111111-0000-4000-8000-000000000202';
  prop_a constant uuid := '11111111-0000-4000-8000-000000000301';
  prop_b constant uuid := '11111111-0000-4000-8000-000000000302';
  prop_draft constant uuid := '11111111-0000-4000-8000-000000000303';
  r text[] := '{}';
  n integer;
  j jsonb;
  err text;
  req uuid;
  new_prop record;
  code_a text;
begin
  -- -------------------------------------------------------------------------
  -- Cenário (como postgres)
  -- -------------------------------------------------------------------------
  insert into auth.users (id, email) values
    (admin_id, 'admin@teste.local'), (agent_a, 'wallace@teste.local'), (agent_b, 'carlos@teste.local');
  insert into public.agencies (id, slug, name, code_prefix) values (agency, 'rls-test', 'Imobiliária Teste', 'TS');
  insert into public.agency_members (agency_id, user_id, role, full_name) values
    (agency, admin_id, 'admin', 'Admin'), (agency, agent_a, 'agent', 'Wallace'), (agency, agent_b, 'agent', 'Carlos');
  insert into public.contacts (id, agency_id, name, phone, created_by) values
    (joao, agency, 'João Proprietário', '(11) 91111-1111', agent_a),
    (maria, agency, 'Maria Proprietária', '11922222222', agent_b);
  insert into public.owners (id, agency_id, contact_id, responsible_user_id, created_by) values
    (owner_joao, agency, joao, agent_a, agent_a), (owner_maria, agency, maria, agent_b, agent_b);
  insert into public.properties (id, agency_id, title, type, for_sale, sale_price, neighborhood, address, published, responsible_user_id) values
    (prop_a, agency, 'Casa do João em Interlagos', 'casa', true, 1500000, 'Interlagos', 'Rua Secreta, 10', true, agent_a),
    (prop_b, agency, 'Apartamento da Maria', 'apartamento', true, 700000, 'Bolsão de Interlagos', 'Rua Privada, 20', true, agent_b),
    (prop_draft, agency, 'Rascunho não publicado', 'terreno', true, 300000, 'Socorro', null, false, agent_a);
  insert into public.property_owners (agency_id, property_id, owner_id) values
    (agency, prop_a, owner_joao), (agency, prop_b, owner_maria);
  -- Maria (proprietária do Carlos) também é interessada em outro imóvel; o lead está com o Wallace.
  insert into public.leads (agency_id, contact_id, property_id, kind, origin, assigned_to)
  values (agency, maria, prop_a, 'property_interest', 'manual', agent_a);

  select code into code_a from public.properties where id = prop_a;
  select count(*) into n from public.properties where agency_id = agency and code like 'TS-%';
  r := r || (case when n = 3 then '✔ ' else '✘ ' end || 'Código sequencial gerado (TS-0001...)');
  select count(*) into n from public.contacts where id = joao and phone = '11911111111';
  r := r || (case when n = 1 then '✔ ' else '✘ ' end || 'Telefone do contato normalizado para dígitos');

  -- -------------------------------------------------------------------------
  -- Corretor A (Wallace)
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', agent_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.owners;
  r := r || (case when n = 1 then '✔ ' else '✘ ' end || 'A vê só o próprio proprietário (João)');
  select count(*) into n from public.owners where id = owner_maria;
  r := r || (case when n = 0 then '✔ ' else '✘ ' end || 'A não vê a proprietária do B (Maria)');
  select count(*) into n from public.property_owners;
  r := r || (case when n = 1 then '✔ ' else '✘ ' end || 'A só vê vínculos imóvel↔proprietário dos seus proprietários');
  select count(*) into n from public.contacts where id = maria;
  r := r || (case when n = 1 then '✔ ' else '✘ ' end || 'A vê o contato da Maria porque atende o lead dela');
  update public.contacts set notes = 'alterado por A' where id = maria;
  get diagnostics n = row_count;
  r := r || (case when n = 0 then '✔ ' else '✘ ' end || 'A não altera contato que é proprietário do B');
  update public.owners set notes = 'x' where id = owner_maria;
  get diagnostics n = row_count;
  r := r || (case when n = 0 then '✔ ' else '✘ ' end || 'A não altera proprietária do B');

  err := null;
  begin
    insert into public.owners (agency_id, contact_id, responsible_user_id) values (agency, maria, agent_b);
  exception when others then err := sqlerrm; end;
  r := r || (case when err is not null then '✔ ' else '✘ ' end || 'A não cadastra proprietário em nome de outro corretor');

  err := null;
  begin
    update public.owners set responsible_user_id = agent_b where id = owner_joao;
  exception when others then err := sqlerrm; end;
  r := r || (case when err is not null then '✔ ' else '✘ ' end || 'A não transfere o próprio proprietário sem aprovação');

  select count(*) into n from public.properties where agency_id = agency;
  r := r || (case when n = 3 then '✔ ' else '✘ ' end || 'Estoque de imóveis visível para toda a equipe');

  err := null;
  begin
    insert into public.contacts (agency_id, name, phone) values (agency, 'Cliente do Wallace', '11977777777') returning id into req;
  exception when others then err := sqlerrm; end;
  r := r || (case when err is null and req is not null then '✔ ' else '✘ ' end || 'A cadastra contato e o recebe de volta');
  req := null;

  update public.properties set description = 'Nova descrição' where id = prop_a;
  get diagnostics n = row_count;
  r := r || (case when n = 1 then '✔ ' else '✘ ' end || 'A edita campos livres do próprio imóvel');

  err := null;
  begin
    update public.properties set sale_price = 999000 where id = prop_a;
  exception when others then err := sqlerrm; end;
  r := r || (case when err = 'approval_required' then '✔ ' else '✘ ' end || 'A não altera preço sem aprovação');

  err := null;
  begin
    update public.properties set published = false where id = prop_a;
  exception when others then err := sqlerrm; end;
  r := r || (case when err = 'approval_required' then '✔ ' else '✘ ' end || 'A não despublica sem aprovação');

  update public.properties set title = 'Invadido' where id = prop_b;
  get diagnostics n = row_count;
  r := r || (case when n = 0 then '✔ ' else '✘ ' end || 'A não edita imóvel do B');

  delete from public.properties where id = prop_a;
  get diagnostics n = row_count;
  r := r || (case when n = 0 then '✔ ' else '✘ ' end || 'A não exclui imóvel (somente admin)');

  insert into public.properties (agency_id, title, type, for_rent, rent_price, neighborhood, published, featured, responsible_user_id)
  values (agency, 'Cadastro do corretor', 'apartamento', true, 3000, 'Interlagos', true, true, agent_b)
  returning published, featured, responsible_user_id into new_prop;
  r := r || (case when not new_prop.published and not new_prop.featured and new_prop.responsible_user_id = agent_a then '✔ ' else '✘ ' end
             || 'Imóvel do corretor nasce não publicado e sob sua responsabilidade');

  req := public.request_change('property', prop_a, 'update', '{"sale_price": 999000}'::jsonb, 'Proprietário baixou o preço');
  r := r || (case when req is not null then '✔ ' else '✘ ' end || 'A solicita alteração de preço');

  err := null;
  begin
    perform public.request_change('property', prop_b, 'update', '{"published": false}'::jsonb);
  exception when others then err := sqlerrm; end;
  r := r || (case when err = 'forbidden' then '✔ ' else '✘ ' end || 'A não solicita alteração em imóvel do B');

  err := null;
  begin
    perform public.request_change('property', prop_a, 'update', '{"description": "x"}'::jsonb);
  exception when others then err := sqlerrm; end;
  r := r || (case when err = 'invalid_field' then '✔ ' else '✘ ' end || 'Solicitação só aceita campos protegidos');

  err := null;
  begin
    perform public.review_change_request(req, true);
  exception when others then err := sqlerrm; end;
  r := r || (case when err = 'forbidden' then '✔ ' else '✘ ' end || 'A não aprova a própria solicitação');

  err := null;
  begin
    insert into public.change_requests (agency_id, entity, entity_id, action) values (agency, 'property', prop_a, 'delete');
  exception when others then err := sqlerrm; end;
  r := r || (case when err is not null then '✔ ' else '✘ ' end || 'Solicitações não são gravadas diretamente na tabela');

  select count(*) into n from public.leads;
  r := r || (case when n = 1 then '✔ ' else '✘ ' end || 'A vê só os leads atribuídos a ele');

  r := r || (case when app.can_edit_property_path(agency || '/' || prop_a || '/foto.webp') then '✔ ' else '✘ ' end || 'A pode enviar fotos do próprio imóvel');
  r := r || (case when not app.can_edit_property_path(agency || '/' || prop_b || '/foto.webp') then '✔ ' else '✘ ' end || 'A não envia fotos para imóvel do B');
  r := r || (case when not app.can_edit_property_path('../' || prop_a || '/foto.webp') then '✔ ' else '✘ ' end || 'Caminho de foto inválido é recusado');

  err := null;
  begin
    perform * from public.list_team(agency);
  exception when others then err := sqlerrm; end;
  r := r || (case when err = 'forbidden' then '✔ ' else '✘ ' end || 'Corretor não vê a lista da equipe');

  err := null;
  begin
    perform public.transfer_portfolio(agency, agent_b, agent_a);
  exception when others then err := sqlerrm; end;
  r := r || (case when err = 'forbidden' then '✔ ' else '✘ ' end || 'Corretor não transfere carteira');

  reset role;

  -- -------------------------------------------------------------------------
  -- Corretor B (Carlos)
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', agent_b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.owners where id = owner_joao;
  r := r || (case when n = 0 then '✔ ' else '✘ ' end || 'B não vê o proprietário do A (João)');
  select count(*) into n from public.contacts where id = joao;
  r := r || (case when n = 0 then '✔ ' else '✘ ' end || 'B não vê o contato do João');
  select count(*) into n from public.change_requests;
  r := r || (case when n = 0 then '✔ ' else '✘ ' end || 'B não vê solicitações do A');
  select count(*) into n from public.leads;
  r := r || (case when n = 0 then '✔ ' else '✘ ' end || 'B não vê leads de outros corretores');

  reset role;

  -- -------------------------------------------------------------------------
  -- Admin
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.owners;
  r := r || (case when n = 2 then '✔ ' else '✘ ' end || 'Admin vê todos os proprietários');
  select count(*) into n from public.change_requests where status = 'pending';
  r := r || (case when n = 1 then '✔ ' else '✘ ' end || 'Admin vê a solicitação pendente');

  j := public.review_change_request(req, true, 'ok');
  select count(*) into n from public.properties where id = prop_a and sale_price = 999000;
  r := r || (case when n = 1 and j ->> 'status' = 'approved' then '✔ ' else '✘ ' end || 'Aprovação aplica o novo preço');

  err := null;
  begin
    perform public.review_change_request(req, true);
  exception when others then err := sqlerrm; end;
  r := r || (case when err = 'not_pending' then '✔ ' else '✘ ' end || 'Solicitação não é aprovada duas vezes');

  update public.properties set rent_price = null, for_rent = false, featured = true where id = prop_b;
  get diagnostics n = row_count;
  r := r || (case when n = 1 then '✔ ' else '✘ ' end || 'Admin altera campos protegidos diretamente');

  update public.owners set responsible_user_id = agent_a where id = owner_maria;
  get diagnostics n = row_count;
  r := r || (case when n = 1 then '✔ ' else '✘ ' end || 'Admin transfere proprietário entre corretores');
  update public.owners set responsible_user_id = agent_b where id = owner_maria;

  select count(*) into n from public.lead_activities where type = 'created';
  r := r || (case when n >= 1 then '✔ ' else '✘ ' end || 'Criação de lead registrada no histórico');

  select count(*) into n from public.list_team(agency) t where t.email is not null;
  r := r || (case when n = 3 then '✔ ' else '✘ ' end || 'Admin lista a equipe com e-mail');

  err := null;
  begin
    update public.agency_members set role = 'agent' where agency_id = agency and user_id = admin_id;
  exception when others then err := sqlerrm; end;
  r := r || (case when err = 'last_admin' then '✔ ' else '✘ ' end || 'Imobiliária não fica sem administrador ativo');

  err := null;
  begin
    perform public.add_member_by_email(agency, 'nao-existe@teste.local', 'Fulano', 'agent');
  exception when others then err := sqlerrm; end;
  r := r || (case when err = 'user_not_found' then '✔ ' else '✘ ' end || 'Vincular e-mail sem login é recusado');

  err := null;
  begin
    perform public.add_member_by_email(agency, 'carlos@teste.local', 'Carlos', 'agent');
  exception when others then err := sqlerrm; end;
  r := r || (case when err = 'already_member' then '✔ ' else '✘ ' end || 'Membro não é vinculado duas vezes');

  j := public.transfer_portfolio(agency, agent_a, agent_b);
  select count(*) into n from public.owners where agency_id = agency and responsible_user_id = agent_a;
  r := r || (case when n = 0 and (j ->> 'owners')::int >= 1 and (j ->> 'properties')::int >= 1 then '✔ ' else '✘ ' end || 'Transferência de carteira move proprietários e imóveis');

  reset role;

  -- -------------------------------------------------------------------------
  -- Visitante anônimo (site)
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  set local role anon;

  err := null;
  begin
    perform count(*) from public.properties;
  exception when others then err := sqlerrm; end;
  r := r || (case when err is not null then '✔ ' else '✘ ' end || 'Visitante não lê tabelas diretamente');

  j := public.search_properties('rls-test', '{}'::jsonb);
  r := r || (case when (j ->> 'total')::int = 2 then '✔ ' else '✘ ' end || 'Busca pública mostra só imóveis publicados');

  j := public.search_properties('rls-test', '{"text": "bolsao"}'::jsonb);
  r := r || (case when (j ->> 'total')::int = 1 then '✔ ' else '✘ ' end || 'Busca ignora acentos');

  j := public.search_properties('rls-test', '{"purpose": "sale", "price": {"purpose": "sale", "min": 800000, "max": 1000000}}'::jsonb);
  r := r || (case when (j ->> 'total')::int = 1 then '✔ ' else '✘ ' end || 'Filtro de faixa de preço');

  j := public.search_properties('rls-test', '{"types": ["casa", "sobrado"]}'::jsonb);
  r := r || (case when (j ->> 'total')::int = 1 then '✔ ' else '✘ ' end || 'Filtro por tipos');

  j := public.get_property('rls-test', code_a);
  r := r || (case when j is not null and not (j ? 'address') and not (j ? 'responsible_user_id') then '✔ ' else '✘ ' end
             || 'Imóvel público não expõe endereço nem responsável');

  j := public.get_property('rls-test', 'TS-0003');
  r := r || (case when j is null then '✔ ' else '✘ ' end || 'Rascunho não aparece no site');

  j := public.submit_lead('rls-test', '{"kind": "property_interest", "name": "Visitante", "phone": "(11) 93333-3333", "property_code": "TS-0001", "consent": true}'::jsonb);
  r := r || (case when (j ->> 'ok')::boolean then '✔ ' else '✘ ' end || 'Site envia lead');

  j := public.submit_lead('rls-test', '{"name": "Robô", "phone": "11944444444", "consent": true, "website": "spam.com"}'::jsonb);

  err := null;
  begin
    perform public.submit_lead('rls-test', '{"name": "Sem consentimento", "phone": "11955555555"}'::jsonb);
  exception when others then err := sqlerrm; end;
  r := r || (case when err = 'consent_required' then '✔ ' else '✘ ' end || 'Lead exige consentimento (LGPD)');

  err := null;
  begin
    perform public.submit_lead('rls-test', '{"name": "X", "phone": "123", "consent": true}'::jsonb);
  exception when others then err := sqlerrm; end;
  r := r || (case when err is not null then '✔ ' else '✘ ' end || 'Lead com dados inválidos é recusado');

  err := null;
  for n in 1..6 loop
    begin
      perform public.submit_lead('rls-test', '{"name": "Repetido", "phone": "11966666666", "consent": true}'::jsonb);
    exception when others then err := sqlerrm; end;
  end loop;
  r := r || (case when err = 'rate_limited' then '✔ ' else '✘ ' end || 'Limite de envios por telefone');

  err := null;
  begin
    perform public.request_change('property', prop_a, 'delete');
  exception when others then err := sqlerrm; end;
  r := r || (case when err is not null then '✔ ' else '✘ ' end || 'Visitante não usa funções do painel');

  reset role;

  -- -------------------------------------------------------------------------
  -- Conferência final (como postgres)
  -- -------------------------------------------------------------------------
  select count(*) into n from public.leads l join public.contacts c on c.id = l.contact_id
   where l.agency_id = agency and c.phone = '11933333333' and l.property_id = prop_a and l.origin = 'site' and l.consent_at is not null;
  r := r || (case when n = 1 then '✔ ' else '✘ ' end || 'Lead do site ligado ao imóvel e ao contato');
  select count(*) into n from public.contacts where agency_id = agency and phone = '11944444444';
  r := r || (case when n = 0 then '✔ ' else '✘ ' end || 'Envio de robô (honeypot) é descartado');
  select count(*) into n from public.leads l join public.contacts c on c.id = l.contact_id where c.phone = '11966666666';
  r := r || (case when n = 5 then '✔ ' else '✘ ' end || 'Contato repetido é reaproveitado (1 contato, vários leads)');

  select count(*) into n from unnest(r) line where line like '✘%';
  raise exception E'RESULTADO: % de % testes passaram. Os dados de teste foram desfeitos.\n%',
    cardinality(r) - n, cardinality(r), array_to_string(r, E'\n');
end
$test$;
