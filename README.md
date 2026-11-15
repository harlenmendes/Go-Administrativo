# Go Administrativo — Go Fisioterapia

Portal unificado de gestão clínica e financeira da **Go Fisioterapia**, reunindo:
- **Acompanhamento de Pacientes** (originado do `Avaliacao-Go`, schema `public` no Supabase)
- **Fechamento de Atendimentos** (originado do `Go-Fechamento`, schema `go_fechamento` no Supabase + Google Calendar & Google Sheets via Vercel Serverless)
- **Identidade Visual** baseada no site oficial (`Go-Fisioterapia`: `#1B3A4B`, `#7BA393`, `#F5F7F6`, `Cormorant Garamond` + `Outfit`)

## Autenticação & Integrações
- **Login principal:** Supabase Auth (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
- **Google OAuth2 (exclusivo para Agenda & Planilhas):** Conectado dentro do módulo **Fechamento** ou em **Configurações**, utilizando os escopos `calendar.readonly` e `spreadsheets` via Serverless Function (`api/index.js`).

## Desenvolvimento Local

1. Copie `.env.example` para `.env.local` e preencha as variáveis do Supabase e Google OAuth.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Para rodar o frontend + API Serverless localmente em paralelo:
   - Terminal 1 (API local na porta `3001`): `npm run dev:api`
   - Terminal 2 (Frontend Vite): `npm run dev`

## Deploy na Vercel
- Configure as variáveis de ambiente do `.env.example` no painel da Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SCHEMA=go_fechamento`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`).
- No Google Cloud Console, adicione a URI de redirecionamento autorizada:
  `https://<seu-dominio-vercel>/login/oauth2/code/google`

