# Intersul Imóveis

Primeira implementação navegável da nova experiência digital da Intersul Imóveis.

## Executar

A aplicação é estática e pode ser aberta diretamente em `index.html` ou servida por qualquer servidor HTTP local. O ambiente atual não possui Node/npm instalado, por isso a fundação foi mantida sem dependências.

## Arquitetura

- `index.html`: shell semântico, header, footer e ponto de montagem.
- `styles.css`: design system e responsividade.
- `app.js`: roteamento por hash, páginas, formulários e interações.
- `data.js`: camada de repositório com mock demonstrativo. O adaptador pode ser substituído futuramente por uma integração oficial com IMOBZI, sem acoplar a interface a endpoints não confirmados.

Os imóveis são explicitamente dados de demonstração. Nenhum ID, descrição ou imagem deve ser tratado como inventário oficial até a integração com a fonte real.
