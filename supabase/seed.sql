/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */

-- Dados iniciais: a imobiliária Intersul e os imóveis FICTÍCIOS de desenvolvimento.
--
-- Os imóveis abaixo não pertencem à Intersul. Estão marcados com source = 'demo' e
-- podem ser removidos de uma vez antes do uso real:
--   delete from public.properties where source = 'demo';

insert into public.agencies (slug, name, code_prefix, settings)
values ('intersul', 'Intersul Imóveis', 'IS', jsonb_build_object(
  'creci', '19.777-J',
  'phone', '1155217444',
  'whatsapp', '5511936233799',
  'email', 'recepção@intersulimoveis.com.br',
  'address', 'Av. Atlântica, 1893 - Interlagos, São Paulo - SP, 04772-003'
))
on conflict (slug) do nothing;

with agency as (select id from public.agencies where slug = 'intersul'),
demo (n, code, title, type, for_sale, sale_price, for_rent, rent_price, neighborhood, bedrooms, suites, parking, area_m2, land_area_m2, photo) as (
  values
    (1, 'DEMO-01', 'Casa contemporânea junto ao verde de Interlagos', 'casa', true, 2800000, false, null, 'Interlagos', 4, 2, 4, 471, null, 'photo-1600607687920-4e2a09cf159d'),
    (2, 'DEMO-02', 'Casa térrea com jardim em Veleiros', 'casa', true, 1200000, false, null, 'Veleiros', 3, 1, 3, 125, null, 'photo-1600585154340-be6161a56a0c'),
    (3, 'DEMO-03', 'Apartamento iluminado no eixo de Santo Amaro', 'apartamento', false, null, true, 4200, 'Santo Amaro', 2, 1, 2, 92, null, 'photo-1600607688969-a5bfcd646154'),
    (4, 'DEMO-04', 'Terreno para projeto em Interlagos', 'terreno', true, 8500000, false, null, 'Interlagos', null, null, null, null, 2072, 'photo-1500382017468-9049fed747ef'),
    (5, 'DEMO-05', 'Sobrado contemporâneo no Bolsão', 'sobrado', true, 2450000, false, null, 'Bolsão de Interlagos', 3, 2, 3, 310, null, 'photo-1600566753086-00f18fb6b3ea'),
    (6, 'DEMO-06', 'Apartamento com varanda em Marajoara', 'apartamento', false, null, true, 3800, 'Marajoara', 2, 1, 1, 88, null, 'photo-1600607687920-4e2a09cf159d'),
    (7, 'DEMO-07', 'Sala comercial próxima a Santo Amaro', 'sala_comercial', false, null, true, 2900, 'Santo Amaro', null, null, 2, 64, null, 'photo-1497366754035-f200968a6e72'),
    (8, 'DEMO-08', 'Casa com quintal no Jardim Suzana', 'casa', true, 1780000, false, null, 'Jardim Suzana', 3, 1, 3, 210, null, 'photo-1600047509807-ba8f99d2cdde'),
    (9, 'DEMO-09', 'Loja para locação em Socorro', 'loja', false, null, true, 7000, 'Socorro', null, null, 4, 140, null, 'photo-1497366811353-6870744d04b2')
),
inserted as (
  insert into public.properties (
    agency_id, code, title, description, type, for_sale, sale_price, for_rent, rent_price,
    neighborhood, bedrooms, suites, parking, area_m2, land_area_m2,
    status, published, featured, source, external_id, created_at
  )
  select agency.id, d.code, d.title, '[DESCRIÇÃO COMPLETA DO IMÓVEL A CONFIRMAR]', d.type, d.for_sale, d.sale_price, d.for_rent, d.rent_price,
         d.neighborhood, d.bedrooms, d.suites, d.parking, d.area_m2, d.land_area_m2,
         'available', true, true, 'demo', d.code,
         -- DEMO-01 é o mais recente, para manter a ordem atual do site
         now() - make_interval(mins => d.n)
    from demo d cross join agency
  on conflict (agency_id, code) do nothing
  returning id, agency_id, code
)
insert into public.property_photos (agency_id, property_id, external_url, position)
select i.agency_id, i.id, 'https://images.unsplash.com/' || d.photo || '?auto=format&fit=crop&w=1200&q=80', 0
  from inserted i join demo d on d.code = i.code;
