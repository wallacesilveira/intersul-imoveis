# Banco de dados (Supabase)

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `migrations/0001_core.sql` | Tabelas, relacionamentos, código sequencial dos imóveis |
| `migrations/0002_security.sql` | Permissões (RLS), campos protegidos, histórico de leads |
| `migrations/0003_public_api.sql` | Funções do site (busca, imóvel, leads) e de aprovação |
| `migrations/0004_storage.sql` | Bucket de fotos e permissões de envio |
| `migrations/0005_contact_visibility_fix.sql` | Correção: contato recém-cadastrado pode ser lido por quem o criou |
| `migrations/0006_team_management.sql` | Equipe: lista com e-mail, vínculo por e-mail, transferência de carteira, proteção do último admin |
| `seed.sql` | Imobiliária Intersul + imóveis fictícios (`source = 'demo'`) |
| `tests/security_tests.sql` | Testes de permissões e regras de negócio |

## Instalação em um projeto novo

1. No painel do Supabase, abra **SQL Editor → New query**.
2. Cole e execute, **nesta ordem**, cada arquivo: `0001_core.sql`, `0002_security.sql`, `0003_public_api.sql`, `0004_storage.sql`, `0005_contact_visibility_fix.sql`, `0006_team_management.sql`, `seed.sql`.
3. Execute `tests/security_tests.sql`. Ele termina **de propósito** com uma mensagem de erro contendo o relatório (`RESULTADO: N de N testes passaram`). Esse erro desfaz os dados criados pelo teste.
4. Em **Authentication → Sign In / Providers**, desative **Allow new users to sign up**. Os usuários são criados pelo administrador.

## Primeiro administrador

1. **Authentication → Users → Add user**: informe e-mail e senha.
2. No SQL Editor, vincule o usuário à imobiliária (só para o primeiro admin; os demais são adicionados pelo painel, em **Equipe**):

```sql
insert into public.agency_members (agency_id, user_id, role, full_name)
select a.id, u.id, 'admin', 'Seu nome'
  from public.agencies a, auth.users u
 where a.slug = 'intersul' and u.email = 'seu@email.com';
```

## E-mails (convites e recuperação de senha)

O envio padrão do Supabase só entrega para membros da conta Supabase. A plataforma usa SMTP próprio:

1. **Authentication → Emails → SMTP Settings**: ative o SMTP e informe servidor, porta, usuário e senha do e-mail remetente. Com Gmail: `smtp.gmail.com`, porta `465` e uma **senha de app** (16 letras, sem espaços), que exige verificação em duas etapas na conta Google.
2. **Authentication → Emails → Templates**: cole os modelos em português de `email-templates/`:
   - **Reset Password** ← `recuperar-senha.html`
   - **Invite user** ← `convite.html`

   O assunto sugerido está no comentário no topo de cada arquivo.
3. **Authentication → URL Configuration**: *Site URL* com o endereço do painel publicado (`.../admin/`) e, em *Redirect URLs*, os endereços locais de desenvolvimento (ex.: `http://127.0.0.1:5500/**`).

Os links enviados valem por tempo limitado (padrão: 1 hora) e só podem ser usados uma vez.

## Remover os imóveis fictícios

Antes do uso real:

```sql
delete from public.properties where source = 'demo';
```
