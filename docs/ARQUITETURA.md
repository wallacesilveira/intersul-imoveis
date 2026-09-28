# Arquitetura da plataforma Intersul (V1)

Documento de referência para a evolução do novo site da Intersul em uma plataforma: **site público + painel administrativo + banco de dados (Supabase)**.

## Contexto

- **Intersul Imóveis** é a imobiliária real que será usuária da plataforma.
- Este repositório é o **novo site da Intersul**, publicado para demonstração em `wallacesilveira.github.io/intersul-imoveis`. Ele não tem relação com o site oficial atual, que é gerido pelo sistema que a imobiliária usa hoje.
- Os imóveis que o site mostra hoje são **fictícios** (códigos `DEMO-xx`). Eles existem só para desenvolvimento, **não são requisitos da imobiliária** e serão removidos antes do uso real.
- A plataforma nasce preparada para atender várias imobiliárias (`agency_id` em todas as entidades), mesmo que a V1 tenha só uma.

## Visão geral

```text
 Site público (index.html + app.js)        Painel (/admin)
   propertyRepository  leadRepository        login obrigatório
            │               │                      │
            ▼               ▼                      ▼
   funções públicas (RPC)                   tabelas sob RLS
   search_properties / get_property         (acesso direto, filtrado
   submit_lead                               por agência e papel)
            └───────────────┬──────────────────────┘
                            ▼
              Supabase: Postgres + Auth + Storage
```

- O site **nunca lê tabelas diretamente**: ele usa funções que devolvem só os campos públicos.
- O painel lê e grava nas tabelas, e as regras de acesso (RLS + triggers) são aplicadas **pelo banco**, não pelo frontend.
- Frontend em HTML/CSS/JS puro com ES modules, sem build. A hospedagem é estática (GitHub Pages).

## Estrutura de pastas

```text
Intersul/
├── index.html, app.js            site público
├── styles.css, overrides.css, brand-update.css, mockup-home.css
├── config.js                     agencySlug, URL e chave publicável do Supabase
├── shared/                       código comum a site e painel
│   ├── format.js                 escapeHtml, moeda, área, telefone, normalização
│   ├── property-model.js         tipos, status, conversão banco → objeto público
│   ├── supabase-rest.js          chamadas às funções públicas (RPC)
│   └── repositories/
│       ├── property-repository.js
│       ├── lead-repository.js            (Etapa 4)
│       └── adapters/
│           └── supabase-adapter.js
├── admin/                        painel: index.html, admin.js (rotas e sessão), pages/, repositories/, lib/
├── supabase/migrations/, seed.sql (Etapa 2)
└── docs/ARQUITETURA.md
```

## Entidades

Todas as tabelas de negócio têm `agency_id NOT NULL`. As relações entre tabelas usam chave composta `(id, agency_id)`, o que impede no banco que um registro de uma agência aponte para outro de outra agência.

| Entidade | Papel |
|---|---|
| `agencies` | Imobiliária (slug, nome, prefixo de código, `settings` jsonb com contatos e regras de aprovação) |
| `agency_members` | Vínculo usuário ↔ agência, com `role` (`admin` \| `agent`) |
| `contacts` | **Pessoa** (nome, telefone, WhatsApp, e-mail, documento, observações). Base única para proprietários, interessados e outros papéis futuros |
| `owners` | **Papel de proprietário** de um contato: `contact_id`, `responsible_user_id`, status, observações. Recebe no futuro dados bancários, documentos e repasses |
| `property_owners` | Imóvel ↔ proprietário (N:N, com `share_percent` opcional para coproprietários) |
| `properties` | Imóvel, com `responsible_user_id` |
| `property_photos` | Fotos ordenadas (a capa é `position = 0`) |
| `leads` | Interesse ou captação vindo do site ou lançado à mão, com `assigned_to` |
| `lead_activities` | Linha do tempo do lead (criação, notas, mudanças de status, atribuição) |
| `change_requests` | Alterações de corretor pendentes de aprovação do administrador |

### Contato × proprietário × interessado

Uma mesma **pessoa** (`contacts`) pode ser:
- **proprietária** de um ou vários imóveis → registro em `owners` + vínculos em `property_owners`;
- **interessada** em outro imóvel → registros em `leads`;
- no futuro, inquilina, fiadora etc. → novas tabelas de papel ligadas ao mesmo contato.

```text
Contato João ──► owners (responsável: Wallace) ──► property_owners ──► imóveis A, B, C
             └─► leads  (atribuído a: Carlos)  ──► imóvel X
```

### Responsáveis

| Registro | Campo | Significado |
|---|---|---|
| `owners` | `responsible_user_id` | Corretor que cuida do relacionamento com o proprietário |
| `properties` | `responsible_user_id` | Corretor responsável pelo imóvel (sugerido a partir do proprietário) |
| `leads` | `assigned_to` | Corretor que atende o lead (distribuído pelo admin) |
| `contacts` | `created_by` | Quem cadastrou a pessoa |

Transferir a responsabilidade é uma ação exclusiva do administrador, ou precisa passar por aprovação.

### Imóvel: campos principais

`code` (único por agência, editável), `title`, `description`, `type`, `for_sale` + `sale_price`, `for_rent` + `rent_price`, `condo_fee`, `iptu_monthly`, `neighborhood`, `city`, `state`, `condominium`, endereço privado (`zip_code`, `address`, `address_number`, `address_complement`), `bedrooms`, `suites`, `bathrooms`, `parking`, `area_m2`, `land_area_m2`, `status` (`available|reserved|sold|rented|inactive`), `published`, `featured`, `source` + `external_id` + `external_synced_at`, `responsible_user_id`, `created_by`, `created_at`, `updated_at`, `archived_at`.

**Venda e aluguel:** usam flags + dois preços (preço vazio = "sob consulta"). O site aparece se `published AND status IN (available, reserved) AND archived_at IS NULL`. Se no futuro cada oferta precisar de ciclo de vida próprio, dá para migrar para uma tabela `property_offers` sem mudar o contrato das funções públicas.

## Permissões

### Papéis na V1

- **admin**: vê e altera tudo da agência, aprova solicitações, gerencia usuários e responsáveis.
- **agent (corretor)**: trabalha na própria carteira, com as regras da tabela abaixo.

### Regras (aplicadas pelo banco)

| Tabela | Corretor lê | Corretor altera |
|---|---|---|
| `properties` | todos da agência (o estoque é vendido por todos) | só aqueles de que é responsável; campos protegidos exigem aprovação |
| `owners` | **só os seus** (`responsible_user_id = auth.uid()`) | só os seus; trocar o responsável exige admin |
| `property_owners` | só vínculos de proprietários seus | só vínculos de proprietários seus |
| `contacts` | os que cadastrou, os de proprietários seus e os de leads atribuídos a ele | os que cadastrou ou de proprietários seus |
| `leads`, `lead_activities` | os atribuídos a ele | os atribuídos a ele |
| `change_requests` | as suas | cria e cancela as suas, sempre pelas funções `request_change` e `cancel_change_request` |

A visibilidade de contatos é resolvida por uma função `app.can_access_contact(contact_id)` (security definer). Os dados de um proprietário de outro corretor nunca chegam ao corretor: nem pela tabela `owners`, nem pelos vínculos `property_owners`.

Contatos são deduplicados pelo telefone dentro da agência. Quando um corretor tenta cadastrar um telefone que já pertence à carteira de outro, a função de cadastro devolve "contato já existe; solicite ao administrador", sem expor os dados.

### Alterações pendentes de aprovação

1. **Campos e ações protegidos** ficam em `agencies.settings.approval_rules`, configuráveis por agência. O padrão é:
   - publicar e despublicar;
   - alterar `sale_price` e `rent_price`;
   - mudar o status para `sold` ou `rented`;
   - arquivar e excluir;
   - trocar o responsável.
2. **Um trigger `BEFORE UPDATE`** em `properties` (e em `owners`) rejeita a alteração quando quem executa não é admin e algum campo protegido muda. Imóvel criado por corretor sempre nasce com `published = false`.
   - RLS filtra linhas, não colunas. Por isso a proteção de campos fica em trigger.
3. **O corretor registra a intenção** em `change_requests`: entidade, ação, `payload` só com os campos propostos, e status `pending`.
4. **O admin aprova ou rejeita** pela função `review_change_request(id, approve, note)`. A função confere se quem chama é admin e aplica o `payload` pelos campos permitidos. Como quem executa é um admin, o próprio trigger aceita a alteração, sem nenhum "modo bypass" que um corretor pudesse acionar.
5. **Histórico:** `change_requests` guarda quem pediu, quem aprovou, quando e o motivo.

Alterações não protegidas (descrição, características, fotos) são gravadas direto pelo corretor responsável.

## Autenticação

- **Supabase Auth com e-mail e senha**, com cadastro público desativado.
- **Usuários criados pelo admin.** Na V1 isso é feito pelo painel do Supabase. Convite pelo painel da plataforma virá com uma Edge Function.
- **Ao entrar, o painel carrega `agency_members`** e define a agência atual.
- **O frontend só conhece a anon key.** A service key nunca sai do servidor.

## Site público → banco

Visitantes anônimos não têm acesso a nenhuma tabela. Eles só executam:

| Função | Uso |
|---|---|
| `search_properties(agency_slug, filters)` | Listagens e busca → `{ items, total, page, pageSize, hasNextPage }` |
| `get_property(agency_slug, code)` | Página do imóvel |
| `submit_lead(agency_slug, payload)` | Formulários do site |

As funções devolvem só campos públicos: nunca endereço completo, notas internas ou proprietário. Elas são também o contrato estável para um futuro frontend (por exemplo, Next.js para SEO).

`propertyRepository` (em `shared/repositories/`) é a única porta do site para os dados; o adaptador do Supabase converte as respostas das funções no objeto usado pelas páginas.

## Leads

1. O formulário do site chama `leadRepository.submit()`, que chama a RPC `submit_lead`.
2. A RPC faz as validações e checagens:
   - honeypot;
   - validação de nome e telefone;
   - limite de envios por telefone;
   - confere se o imóvel é da agência e está publicado.
3. A RPC grava:
   - busca ou cria o contato pelo telefone;
   - cria o lead com status `new`;
   - registra a atividade `created`.
4. O site confirma o envio e mostra o botão "Continuar no WhatsApp", com o código do imóvel.
5. No painel, o admin vê o lead novo e o atribui a um corretor.

Tipos de lead: `property_interest` (página do imóvel), `owner_listing` (formulários Vender e Cadastre seu imóvel, com os dados em `details` jsonb) e `general`. Um lead de captação pode ser convertido em proprietário (`owners`) com responsável definido.

## Fotos (Storage)

- **Bucket `property-photos`** com leitura pública. O caminho é `{agency_id}/{property_id}/{uuid}.webp`.
- **Escrita e exclusão** só para membros da agência (primeiro segmento do caminho) com permissão de editar o imóvel.
- **Redimensionamento no navegador** antes do envio: até 1920px, WebP.

## Fonte externa de imóveis (futuro)

- Uma fonte externa (o sistema atual da imobiliária, por exemplo) será **importada para o banco**, e não consultada ao vivo pelo site.
- O importador faz upsert por `(agency_id, source, external_id)`.
- Site, painel e leads continuam funcionando sem mudança.

## Fora da V1

Agenda, tarefas, funil de vendas, contratos, documentos, gestão de locação, financeiro, comissões, feed para portais, integração com WhatsApp API, permissões finas além de admin/corretor, relatórios e SEO com renderização no servidor.

## Etapas de implementação

| # | Etapa | Estado |
|---|---|---|
| 1 | Refatoração sem backend (módulos, repositório, modelo, filtros, escape de HTML) | concluída |
| 2 | Supabase: schema, RLS, triggers de aprovação, funções públicas, storage, seed demo ([supabase/](../supabase/README.md)) | concluída |
| 3 | Site lendo do Supabase; remoção do adaptador mock | concluída |
| 4 | Leads dos formulários do site | concluída |
| 5 | Painel: login e contatos/proprietários | concluída |
| 6 | Painel: imóveis (com proprietários e aprovação) | |
| 7 | Fotos | |
| 8 | Leads no painel | |
| 9 | Dashboard de pendências | |
| 10 | Usuários e aviso de lead por e-mail | |
