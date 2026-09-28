# Intersul Imóveis

Novo site da Intersul Imóveis, em evolução para uma plataforma com site público, painel administrativo e banco de dados.

## Executar

O site usa ES modules, então precisa ser servido por HTTP. Abrir o `index.html` direto no navegador (`file://`) não funciona.

- **VS Code:** extensão Live Server → "Open with Live Server" no `index.html`.
- **Node:** `npx serve .` na pasta do projeto.

Não há build nem dependências.

## Estrutura

- `index.html`: shell semântico, header, footer e ponto de montagem.
- `app.js`: roteamento por hash, páginas, formulários e interações do site.
- `gallery.js`: galeria de fotos da página do imóvel, com ampliação em tela cheia.
- `config.js`: endereço e chave pública do Supabase, identificação da imobiliária.
- `shared/`: código comum ao site e ao futuro painel.
  - `format.js`: escape de HTML, formatação de preço, área e telefone.
  - `property-model.js`: tipos, status e conversão dos dados do banco para o site.
  - `supabase-rest.js`: chamadas às funções públicas do banco.
  - `repositories/property-repository.js`: único ponto de acesso do site aos imóveis.
- Estilos: `styles.css`, `overrides.css`, `brand-update.css`, `mockup-home.css`.
- `admin/`: painel administrativo (login, imóveis, contatos, proprietários, aprovações), acessado em `/admin/`.
- `supabase/`: estrutura do banco, permissões e testes ([guia](supabase/README.md)).

A arquitetura completa e as etapas estão em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Dados

Os imóveis vêm do Supabase. Os que existem hoje são **fictícios** (códigos `DEMO-xx`, `source = 'demo'`), cadastrados pelo `supabase/seed.sql` só para desenvolvimento.
