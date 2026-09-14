# Lux Decor — React/Vite + Supabase exclusivo + Vercel

Versão preparada para produção. O catálogo público continua abrindo com os assets locais mesmo se as variáveis do Supabase estiverem ausentes ou temporariamente indisponíveis, evitando tela branca. Quando o Supabase está configurado, produtos, configurações e uploads do Admin passam a ser persistentes e compartilhados entre todos os dispositivos.

## O que já está integrado

- React + Vite.
- Supabase Auth para login do Admin.
- Banco separado para produtos, categorias, imagens e configurações.
- Storage separado em `products` e `site-assets`.
- RLS: visitante só lê; Admin autenticado e autorizado pode gravar.
- Upload de várias imagens por produto.
- Upload permanente das imagens fixas: 4 heroes, editorial e ambientes.
- WhatsApp e Instagram persistidos em `site_settings`.
- Catálogo inicial incluído no SQL.
- Fallback seguro para não deixar o site em branco.
- `vercel.json` pronto para SPA.

## 1. Criar um projeto Supabase EXCLUSIVO

Crie um projeto novo somente para a Lux Decor. Não reutilize o banco de outro sistema.

Depois abra **SQL Editor > New query** e execute:

`supabase/migrations/001_lux_decor.sql`

Isso cria tabelas, buckets, políticas RLS e o catálogo inicial.

## 2. Criar o usuário administrador

No Supabase, abra **Authentication > Users > Add user** e crie o e-mail/senha do administrador.

Depois rode no SQL Editor, trocando o e-mail:

```sql
insert into public.admin_users (user_id)
select id
from auth.users
where email = 'SEU-EMAIL-DE-ADMIN@EMAIL.COM'
on conflict (user_id) do nothing;
```

Apenas usuários presentes em `admin_users` conseguem alterar o catálogo ou fazer upload.

## 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` durante o desenvolvimento:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxx
```

Use a **publishable key** do Supabase. Nunca coloque `service_role` no React ou no Vercel.

## 4. Rodar no PC

```powershell
npm install
npm run dev
```

## 5. Publicar no Vercel

Importe a pasta/repositório no Vercel e adicione em **Settings > Environment Variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Build command: `npm run build`

Output directory: `dist`

Depois faça um novo deploy.

## Admin

Abra o site e clique em **Admin** ou acesse `/#admin`.

O painel solicita login quando o Supabase está conectado. Nele você pode:

- cadastrar/editar/excluir produtos;
- mostrar preço ou `Sob consulta`;
- publicar/ocultar produto;
- cadastrar características;
- enviar várias imagens;
- definir capa;
- trocar WhatsApp e Instagram;
- trocar hero, editorial e imagens de ambientes.

## Estrutura do banco

- `admin_users`: usuários autorizados no painel.
- `categories`: categorias do catálogo.
- `products`: produto e informações comerciais.
- `product_images`: galeria de cada produto.
- `site_settings`: WhatsApp e Instagram.
- `site_images`: imagens institucionais editáveis.
- Storage `products`: fotos de produtos.
- Storage `site-assets`: imagens de hero/ambientes/editorial.

## Segurança

O projeto não usa `service_role` no frontend. As operações de escrita dependem de sessão autenticada **e** da presença do usuário em `admin_users`. As políticas estão no SQL da migration.
