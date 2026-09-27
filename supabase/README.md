# Banco de dados (Supabase)

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `migrations/0001_core.sql` | Tabelas, relacionamentos, código sequencial dos imóveis |
| `migrations/0002_security.sql` | Permissões (RLS), campos protegidos, histórico de leads |
| `migrations/0003_public_api.sql` | Funções do site (busca, imóvel, leads) e de aprovação |
| `migrations/0004_storage.sql` | Bucket de fotos e permissões de envio |
| `seed.sql` | Imobiliária Intersul + imóveis fictícios (`source = 'demo'`) |
| `tests/security_tests.sql` | Testes de permissões e regras de negócio |

## Instalação em um projeto novo

1. No painel do Supabase, abra **SQL Editor → New query**.
2. Cole e execute, **nesta ordem**, cada arquivo: `0001_core.sql`, `0002_security.sql`, `0003_public_api.sql`, `0004_storage.sql`, `seed.sql`.
3. Execute `tests/security_tests.sql`. Ele termina **de propósito** com uma mensagem de erro contendo o relatório (`RESULTADO: N de N testes passaram`). Esse erro desfaz os dados criados pelo teste.
4. Em **Authentication → Sign In / Providers**, desative **Allow new users to sign up**. Os usuários são criados pelo administrador.

## Primeiro administrador

1. **Authentication → Users → Add user**: informe e-mail e senha.
2. No SQL Editor, vincule o usuário à imobiliária:

```sql
insert into public.agency_members (agency_id, user_id, role, full_name)
select a.id, u.id, 'admin', 'Seu nome'
  from public.agencies a, auth.users u
 where a.slug = 'intersul' and u.email = 'seu@email.com';
```

## Remover os imóveis fictícios

Antes do uso real:

```sql
delete from public.properties where source = 'demo';
```
