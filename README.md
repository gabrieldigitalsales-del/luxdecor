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

## Painel Admin V2
Esta versão inclui um fluxo mais simples para cadastro e manutenção do catálogo:
- lista visual com busca, filtros e status;
- criação/edição em painel lateral com etapas Informações, Fotos e Detalhes;
- upload direto por clique ou arrastar e soltar;
- múltiplas imagens, escolha de capa e remoção individual;
- exclusão de produto com confirmação;
- sugestão visual opcional de categoria/nome/descrição a partir da primeira foto.

## IA LOCAL grátis com Ollama

A identificação automática das fotos agora é **100% local e opcional**. O site no Vercel e o catálogo no Supabase continuam funcionando mesmo quando o Ollama estiver desligado.

### 1. Instale e abra o Ollama no PC

O painel tenta acessar por padrão:

```text
http://localhost:11434
```

### 2. Instale um modelo multimodal

Recomendado para começar:

```bash
ollama pull gemma3:4b
```

Também podem ser usados outros modelos com visão, como variantes de Qwen VL, LLaVA ou MiniCPM-V, desde que estejam instalados no Ollama.

### 3. Liberar o domínio do Vercel no Ollama

Como o Admin está hospedado no Vercel e o Ollama está no seu computador, o navegador precisa ter permissão para chamar o serviço local.

No Windows, feche o Ollama e configure a origem do seu site. Exemplo no PowerShell:

```powershell
setx OLLAMA_ORIGINS "https://SEU-DOMINIO.vercel.app,http://localhost:5173"
```

Depois **feche e abra o Ollama novamente**. Se você usa domínio próprio, coloque também esse domínio na lista.

> Não exponha a porta 11434 diretamente na internet. O painel foi feito para conversar com o Ollama no próprio PC.

### 4. Testar no Admin

Entre no Admin → **Configurações → IA local · Ollama** e clique em **Testar conexão**.

Você verá:

- `IA LOCAL: OK` quando o Ollama estiver acessível;
- `IA LOCAL: OFF` quando estiver desligado ou bloqueado.

Ao cadastrar um produto, envie a foto e use **Analisar primeira foto**. A IA pode sugerir categoria, nome, selo, descrição e características visuais. Ela não deve inventar preço, medida ou especificações técnicas.

Nenhuma `OPENAI_API_KEY` é necessária nesta versão.

