# Lux Decor — React/Vite + Supabase + Vercel

Versão final com catálogo público e painel administrativo por **senha apenas**.

## 1. Supabase
No SQL Editor rode inteiro:

`supabase/migrations/001_lux_decor.sql`

Não precisa criar usuário no Supabase Auth.

## 2. Variáveis no Vercel
Project > Settings > Environment Variables:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
ADMIN_PASSWORD=luxdecor1001
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ADMIN_SESSION_SECRET=uma-chave-grande-e-aleatoria
```

`ADMIN_SESSION_SECRET` é recomendada, mas opcional.

### Onde pegar as chaves
- URL + Publishable Key: Supabase > Project Settings > API
- Service Role: Supabase > Project Settings > API > Secret / service_role

**Nunca** coloque `SUPABASE_SERVICE_ROLE_KEY` com prefixo `VITE_`.

## 3. Deploy
Depois de criar/alterar as variáveis no Vercel, faça **Redeploy**.

## 4. Admin
Abra o site e clique em `Admin` ou use `/#admin`.

Senha:

`luxdecor1001`

O painel permite:
- produtos e valores
- várias imagens por produto
- capa do produto
- imagens fixas do hero e ambientes
- WhatsApp e Instagram
- publicação/ocultação de produto

## 5. Local
```bash
npm install
npm run dev
```

As rotas `/api/admin` são funções serverless do Vercel. Para testar o painel completo localmente, use `vercel dev` ou publique no Vercel.


## Isolamento de banco Lux Decor

Esta versão usa **somente nomes exclusivos da Lux Decor** no Supabase:

- `luxdecor_categories`
- `luxdecor_products`
- `luxdecor_product_images`
- `luxdecor_site_settings`
- `luxdecor_site_images`
- bucket `luxdecor-products`
- bucket `luxdecor-site-assets`

Ela não lê nem grava nas tabelas genéricas `products`, `categories`, `product_images`, `site_settings` ou `site_images`.
