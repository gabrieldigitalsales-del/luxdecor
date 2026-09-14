# Lux Decor — React/Vite + Supabase

## CORREÇÃO DA TELA BRANCA
Esta versão corrige um erro da versão anterior: o `main.jsx` usava as funções do Supabase sem importar o módulo correspondente. Isso gerava um `ReferenceError` logo na inicialização e deixava a tela branca.

Também foi adicionado um Error Boundary visível, para que um erro de renderização não resulte mais em uma página totalmente branca.

## Rodar localmente
Este é um projeto React/Vite. **Não abra o `index.html` com dois cliques.**

No PowerShell, dentro da pasta do projeto:

```powershell
npm install
npm run dev
```

Depois abra o endereço exibido pelo Vite, normalmente:

`http://localhost:5173`

## Supabase
Sem `.env`, o site abre em modo local/fallback e o catálogo continua visível.

Copie `.env.example` para `.env.local` e preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Você também pode usar `VITE_SUPABASE_ANON_KEY` por compatibilidade.

## Banco
Execute no Supabase SQL Editor:

`supabase/migrations/001_lux_decor.sql`

Depois crie o usuário em Authentication e associe-o ao Admin usando:

`supabase/BOOTSTRAP_ADMIN.sql`

## Vercel
- Framework: Vite
- Build command: `npm run build`
- Output: `dist`
- Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` em Project Settings > Environment Variables.

O arquivo `vercel.json` já está incluído.
