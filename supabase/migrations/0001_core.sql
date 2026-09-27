/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */

-- 0001 · Estrutura principal: tabelas, relacionamentos e triggers de dados.
--
-- Toda tabela de negócio tem agency_id. As chaves estrangeiras entre tabelas de negócio
-- usam (id, agency_id), o que impede no banco que um registro aponte para outro de
-- outra imobiliária.

create schema if not exists app;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Imobiliárias e usuários
-- ---------------------------------------------------------------------------

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  code_prefix text not null default 'IM' check (code_prefix ~ '^[A-Z0-9]{1,6}$'),
  next_property_number integer not null default 1,
  -- contatos públicos, regras de aprovação e outras preferências da imobiliária
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agency_members (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'agent')),
  full_name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);
create index agency_members_user_idx on public.agency_members (user_id);

-- ---------------------------------------------------------------------------
-- Pessoas e papéis
-- ---------------------------------------------------------------------------

-- Contato = a pessoa. Proprietário, interessado etc. são papéis ligados a ela.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id),
  name text not null check (length(btrim(name)) between 2 and 200),
  phone text check (phone ~ '^[0-9]{10,13}$'),
  whatsapp text check (whatsapp ~ '^[0-9]{10,13}$'),
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  document text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  foreign key (agency_id, created_by) references public.agency_members (agency_id, user_id)
);
-- um telefone identifica uma pessoa dentro da imobiliária
create unique index contacts_agency_phone_key on public.contacts (agency_id, phone) where phone is not null;

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id),
  contact_id uuid not null,
  responsible_user_id uuid not null default auth.uid(),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  unique (agency_id, contact_id),
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id),
  foreign key (agency_id, responsible_user_id) references public.agency_members (agency_id, user_id),
  foreign key (agency_id, created_by) references public.agency_members (agency_id, user_id)
);
create index owners_responsible_idx on public.owners (agency_id, responsible_user_id);

-- ---------------------------------------------------------------------------
-- Imóveis
-- ---------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id),
  code text not null check (code ~ '^[A-Za-z0-9-]{2,30}$'),
  title text not null check (length(btrim(title)) between 3 and 200),
  description text,
  type text not null check (type in ('apartamento', 'casa', 'sobrado', 'casa_condominio', 'cobertura', 'terreno', 'sala_comercial', 'loja', 'galpao')),
  -- venda e locação: flags + preços; preço nulo = "sob consulta"
  for_sale boolean not null default false,
  sale_price numeric(14, 2) check (sale_price >= 0),
  for_rent boolean not null default false,
  rent_price numeric(12, 2) check (rent_price >= 0),
  condo_fee numeric(12, 2) check (condo_fee >= 0),
  iptu_monthly numeric(12, 2) check (iptu_monthly >= 0),
  neighborhood text not null,
  city text not null default 'São Paulo',
  state char(2) not null default 'SP',
  condominium text,
  -- endereço completo: uso interno, nunca exposto pelo site
  zip_code text,
  address text,
  address_number text,
  address_complement text,
  bedrooms smallint check (bedrooms >= 0),
  suites smallint check (suites >= 0),
  bathrooms smallint check (bathrooms >= 0),
  parking smallint check (parking >= 0),
  area_m2 numeric(10, 2) check (area_m2 > 0),
  land_area_m2 numeric(12, 2) check (land_area_m2 > 0),
  status text not null default 'available' check (status in ('available', 'reserved', 'sold', 'rented', 'inactive')),
  published boolean not null default false,
  featured boolean not null default false,
  responsible_user_id uuid default auth.uid(),
  -- origem do cadastro: 'manual', 'demo' ou um sistema externo importado
  source text not null default 'manual' check (source ~ '^[a-z0-9_]{2,30}$'),
  external_id text,
  external_synced_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint properties_offer_check check (for_sale or for_rent),
  unique (id, agency_id),
  unique (agency_id, code),
  unique (agency_id, source, external_id),
  foreign key (agency_id, responsible_user_id) references public.agency_members (agency_id, user_id),
  foreign key (agency_id, created_by) references public.agency_members (agency_id, user_id)
);
create index properties_public_idx on public.properties (agency_id, published, status) where archived_at is null;
create index properties_responsible_idx on public.properties (agency_id, responsible_user_id);

create table public.property_owners (
  agency_id uuid not null,
  property_id uuid not null,
  owner_id uuid not null,
  share_percent numeric(5, 2) check (share_percent > 0 and share_percent <= 100),
  created_at timestamptz not null default now(),
  primary key (property_id, owner_id),
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete cascade,
  foreign key (owner_id, agency_id) references public.owners (id, agency_id) on delete cascade
);
create index property_owners_owner_idx on public.property_owners (owner_id);

-- Foto no Storage (storage_path) ou em endereço externo (external_url: demos e importações).
create table public.property_photos (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  property_id uuid not null,
  storage_path text unique,
  external_url text check (external_url ~ '^https://'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint property_photos_source_check check ((storage_path is null) <> (external_url is null)),
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete cascade
);
create index property_photos_property_idx on public.property_photos (property_id, position);

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id),
  contact_id uuid not null,
  property_id uuid,
  kind text not null check (kind in ('property_interest', 'owner_listing', 'general')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'won', 'lost')),
  origin text not null default 'manual' check (origin in ('site', 'manual', 'whatsapp', 'import')),
  message text check (length(message) <= 2000),
  -- dados específicos do formulário (ex.: captação: objetivo, tipo, endereço)
  details jsonb not null default '{}'::jsonb,
  consent_at timestamptz,
  assigned_to uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  foreign key (contact_id, agency_id) references public.contacts (id, agency_id),
  foreign key (property_id, agency_id) references public.properties (id, agency_id) on delete set null (property_id),
  foreign key (agency_id, assigned_to) references public.agency_members (agency_id, user_id),
  foreign key (agency_id, created_by) references public.agency_members (agency_id, user_id)
);
create index leads_agency_status_idx on public.leads (agency_id, status, created_at desc);
create index leads_assigned_idx on public.leads (agency_id, assigned_to);
create index leads_contact_idx on public.leads (contact_id);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  lead_id uuid not null,
  user_id uuid default auth.uid(),
  type text not null check (type in ('created', 'note', 'status_change', 'assignment')),
  body text check (length(body) <= 5000),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (lead_id, agency_id) references public.leads (id, agency_id) on delete cascade,
  foreign key (agency_id, user_id) references public.agency_members (agency_id, user_id)
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at);

-- ---------------------------------------------------------------------------
-- Alterações pendentes de aprovação
-- ---------------------------------------------------------------------------

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id),
  entity text not null check (entity in ('property', 'owner')),
  entity_id uuid not null,
  action text not null check (action in ('update', 'archive', 'delete')),
  payload jsonb not null default '{}'::jsonb,
  reason text check (length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by uuid not null default auth.uid(),
  requested_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text check (length(review_note) <= 1000),
  foreign key (agency_id, requested_by) references public.agency_members (agency_id, user_id),
  foreign key (agency_id, reviewed_by) references public.agency_members (agency_id, user_id)
);
create index change_requests_pending_idx on public.change_requests (agency_id, status, requested_at);

-- ---------------------------------------------------------------------------
-- Triggers de dados
-- ---------------------------------------------------------------------------

create function app.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger set_updated_at before update on public.agencies for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.agency_members for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.contacts for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.owners for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.properties for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.leads for each row execute function app.set_updated_at();

-- Telefones guardados só com dígitos, para deduplicar contatos.
create function app.normalize_contact() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.name := btrim(new.name);
  new.phone := nullif(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), '');
  new.whatsapp := nullif(regexp_replace(coalesce(new.whatsapp, ''), '\D', '', 'g'), '');
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  return new;
end $$;

create trigger normalize_contact before insert or update on public.contacts for each row execute function app.normalize_contact();

-- Código sequencial por imobiliária (ex.: IS-0001) quando não informado.
-- security definer: precisa atualizar o contador em agencies, que corretores não podem alterar.
create function app.assign_property_code() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_prefix text;
  v_number integer;
begin
  if new.code is not null and btrim(new.code) <> '' then
    new.code := upper(btrim(new.code));
    return new;
  end if;
  update public.agencies
     set next_property_number = next_property_number + 1
   where id = new.agency_id
  returning code_prefix, next_property_number - 1 into v_prefix, v_number;
  new.code := v_prefix || '-' || lpad(v_number::text, 4, '0');
  return new;
end $$;

create trigger assign_property_code before insert on public.properties for each row execute function app.assign_property_code();
