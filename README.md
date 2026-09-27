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
- `config.js`: fonte de dados (`mock` ou `supabase`) e identificação da imobiliária.
- `shared/`: código comum ao site e ao futuro painel.
  - `format.js`: escape de HTML, formatação de preço, área e telefone.
  - `property-model.js`: tipos, status e conversão dos dados do banco para o site.
  - `repositories/property-repository.js`: único ponto de acesso do site aos imóveis.
- Estilos: `styles.css`, `overrides.css`, `brand-update.css`, `mockup-home.css`.

A arquitetura completa e as etapas estão em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Dados

Os imóveis exibidos hoje são **fictícios** (códigos `DEMO-xx`) e servem só para desenvolvimento. Eles ficam em `shared/repositories/adapters/mock-adapter.js` até o site passar a ler do banco.
