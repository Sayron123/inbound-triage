# CLAUDE.md - inbound-triage

## What this project is
A message triage service. Messages come in, an LLM classifies them, results are saved to Supabase, urgent ones alert Discord, and a Next.js dashboard shows them.

Flow:
POST /webhook -> verify X-Webhook-Secret -> classify with OpenRouter -> insert into Supabase `messages` -> Discord alert if urgency is high

Source of truth for scope: `PROJECT_BRIEF.md`. Deploy and troubleshooting: `RUNBOOK.md`.

## Stack and layout
- `backend/`: Python, FastAPI, Pydantic, Docker. Hosted on Render (root directory `backend`).
- `frontend/`: Next.js (TypeScript), Supabase Auth. Hosted on Vercel (root directory `frontend`).
- Database: Supabase Postgres with RLS on `messages`.
- LLM: OpenRouter (free models).
- Alerts: Discord webhook.

## Commands
- Run backend locally (from repo root): `python -m uvicorn backend.main:app --reload`
- Backend tests (from `backend/`): `python -m pytest`
- Frontend checks (from `frontend/`): `npm run lint`, `npm run build`

## Environment variables (names only, never values)
Backend (Render, `backend/.env`): SUPABASE_URL, SUPABASE_KEY (service role, backend only), OPENROUTER_API_KEY, OPENROUTER_MODEL, WEBHOOK_SECRET, DISCORD_WEBHOOK_URL
Frontend (Vercel, `frontend/.env.local`): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

## Rules
- Never read, print, log, or commit secrets or `.env` files.
- SUPABASE_KEY and any OAuth tokens stay in the backend. Nothing secret goes in `frontend/`.
- Every write endpoint must check a secret or auth. Compare secrets with `hmac.compare_digest`.
- Categories are a fixed list: billing, technical, sales, support, other. Validate LLM output with Pydantic.
- Keep it simple. Don't add libraries, layers, or abstractions the brief doesn't need. Ask before adding a dependency.
- Don't rewrite working code just to restyle it.
- Run the backend tests after backend changes, and lint and build after frontend changes.

## How to work with me
- I'm learning while I build. Explain the plan first, then make changes in small steps.
- After each change, tell me what it does in a few lines so I can explain it in an interview.
- If you're unsure about an API or library, say so instead of guessing.
- Flag security problems even if I didn't ask.

## AI log
`AI_LOG.md` records mistakes the AI coding tool made, how I caught them, and what I changed. Early entries are from GitHub Copilot; new entries are from Claude Code. Each entry has a "Tool:" line.

## Gmail source (done, lives outside the backend)
- A Google Apps Script (`apps-script/Code.gs`) runs on a time trigger every 10-15 minutes in my Gmail account.
- It only reads emails sent to `sayrondpabilando+triage@gmail.com`, so the rest of the inbox is never touched.
- It POSTs each email to the existing `/webhook` with the `X-Webhook-Secret` header. The secret is stored in Apps Script's Script Properties, never in the code.
- After a 2xx response, it adds the Gmail label `triaged` so the email isn't sent twice. Failed sends stay unlabeled and retry on the next run.
- The backend needed no changes for this. Don't add Gmail API, OAuth, or a polling endpoint to the backend.

## Next task
- Add an optional `source` field (`webhook` or `gmail`) to the webhook payload and the `messages` table, defaulting to `webhook`, so existing Postman tests still work.
- Have the Apps Script send `source: "gmail"`.
- Show the source as a small badge on the dashboard and add it as a filter.