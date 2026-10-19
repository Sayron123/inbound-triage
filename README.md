# inbound-triage

Inbound message triage pipeline built with FastAPI, OpenRouter, Supabase, Discord, and Next.js. Messages arrive from a webhook or from Gmail, are classified by an LLM, saved, and shown on a dashboard.

## What it does

```text
External sender                    Gmail (triage address)
    |                                  |
    |                                  | Google Apps Script, every 10 minutes
    |                                  | adds "source": "gmail"
    | POST /webhook + X-Webhook-Secret |
    +----------------+-----------------+
                     v
FastAPI backend on Render
    |
    | classify and summarize
    v
OpenRouter
    |
    | save original message and classification
    v
Supabase messages table
    |
    | authenticated browser read through anon key
    v
Next.js dashboard on Vercel
```

High-urgency messages also trigger a Discord webhook after the Supabase insert succeeds. If Discord fails, the failure is logged and the request still succeeds, because the message is already saved. Discord mentions are disabled in alerts, since the text comes from outside senders.

## Repository layout

- `backend/` - FastAPI service, Dockerfile, and Python dependencies
- `frontend/` - Next.js TypeScript dashboard
- `apps-script/` - Google Apps Script that forwards triage emails from Gmail to `/webhook`
- `supabase/` - SQL migrations, run by hand in the Supabase SQL Editor
- `PROJECT_BRIEF.md` - scope and definition of done
- `AI_LOG.md` - log of mistakes made by AI coding tools (Copilot and Claude Code)

## Backend setup

Requirements: Python 3.11+.

Create and activate a virtual environment, then install dependencies:

```powershell
py -3.11 -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

Create `backend\.env` locally. Do not commit it. It must contain:

```text
SUPABASE_URL=...
SUPABASE_KEY=...
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...
WEBHOOK_SECRET=...
DISCORD_WEBHOOK_URL=...
```

Start the backend from the repository root:

```powershell
python -m uvicorn backend.main:app --reload
```

Check the health endpoint:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

## Webhook test

The webhook accepts only `POST` requests. Use Postman or PowerShell:

```powershell
$body = @{
  name = "Production Test"
  email = "test@example.com"
  text = "I need urgent help with my billing account."
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/webhook" `
  -Method Post `
  -Headers @{ "X-Webhook-Secret" = "your-webhook-secret" } `
  -ContentType "application/json" `
  -Body $body
```

The same request can target the deployed Render URL. `/health` supports `GET`; `/webhook` requires `POST`.

## Gmail source

Emails sent to the triage address reach the backend through a Google Apps Script, not through the Gmail API. The script (`apps-script/Code.gs`) runs on a time trigger, POSTs each new email to `/webhook` with `"source": "gmail"`, and then labels the thread `triaged` so it is not sent again. The backend has no Gmail code. Setup steps are in `RUNBOOK.md`.

## Frontend setup

Requirements: Node.js and npm.

Install dependencies:

```powershell
Set-Location frontend
npm install
```

Create `frontend\.env.local` with only the browser-safe Supabase values:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Start the development server:

```powershell
npm run dev
```

Available frontend checks:

```powershell
npm run lint
npm run build
```

Create the user for local login in Supabase Authentication, then sign in through the dashboard. The dashboard reads `messages` with the anon key and the authenticated session; RLS must remain enabled.

## Deployment

### Backend on Render

The backend uses `backend/Dockerfile` and `backend/.dockerignore`.

Configure the Render service with:

```text
Root directory: backend
Runtime: Docker
```

Add these environment variables in Render only:

```text
SUPABASE_URL
SUPABASE_KEY
OPENROUTER_API_KEY
OPENROUTER_MODEL
WEBHOOK_SECRET
DISCORD_WEBHOOK_URL
```

Render should expose:

```text
GET /health
POST /webhook
```

### Frontend on Vercel

Set the Vercel root directory to `frontend` and add only:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Never put the Supabase service-role key, OpenRouter key, webhook secret, or Discord URL in the frontend or in Git.

## Supabase requirements

The `messages` table contains:

```text
id, name, email, text, category, urgency, summary, source, created_at
```

`source` is `webhook` or `gmail` and defaults to `webhook`. Add it to an existing table with `supabase/add_message_source.sql`.

Keep Row Level Security enabled. Authenticated users may read messages through the frontend; the backend uses its server-side key for inserts.

## Verification status

The local webhook flow was tested with Postman. The deployed Render health endpoint and production webhook were also verified, and the Vercel dashboard was tested for login, message listing, filtering, detail view, and logout.

Remaining project work is to add backend pytest coverage and complete the concrete Copilot mistake entry in `AI_LOG.md`.
