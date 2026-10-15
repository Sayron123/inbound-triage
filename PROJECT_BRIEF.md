# inbound-triage: project brief

## Goal
Build a small, live project that gives me real answers for a job application (OnlineJobs.ph, "AI Automation Developer - Copilot, Python, Next.js, Supabase"). The application asks for:
1. Something I built in Python or TypeScript that is running today (what it does, what it connects to, where it's hosted)
2. One API or webhook integration (what talked to what, one problem, how I fixed it)
3. One real workflow using an LLM API (not a chat window)
4. One specific time Copilot produced something wrong or overbuilt, how I caught it, what I did
5. Monthly rate in USD, overlap with 9am-5pm US Eastern, earliest start date
Subject line must be exactly: FLEET BUILDER - [Your Name]. Answer only the 5 questions.

## What it does
Webhook receives a message -> FastAPI service -> LLM classifies and summarizes -> saved in Supabase -> Slack/Discord alert for high urgency -> Next.js dashboard shows messages.

## Stack and hosting
- Backend: Python 3.11+, FastAPI, Docker, hosted on Render (free tier; no Google Cloud because no card)
- Database: Supabase (Postgres, RLS on, service role key only in backend)
- Frontend: Next.js (TypeScript) in /frontend, hosted on Vercel Hobby
- LLM: Gemini or OpenRouter
- Alerts: Slack or Discord webhook
- Tests: pytest for the backend

## Repo layout
/backend
/frontend
backend/Dockerfile
backend/.dockerignore
backend/requirements.txt
.gitignore (excludes secrets and generated files)
README.md (architecture, setup, deployment, and test steps)
AI_LOG.md (Q4 notes)

## Backend requirements
- POST /webhook accepts name, email, text
- Verify a shared secret or signature on every request
- Call the LLM, get JSON: category, urgency, one-line summary
- Save message and result to Supabase
- Alert Slack/Discord when urgency is high
- Handle LLM failures and bad payloads without crashing
- GET /health
- A few pytest tests

## Database requirements
- messages table (id, name, email, text, category, urgency, summary, created_at)
- RLS enabled; only logged-in users can read
- Backend writes with the service role key

## Frontend requirements
- Supabase Auth login
- Messages table with filters by category and urgency
- Detail view per message
- Vercel env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY only. Vercel root directory = frontend.

## Never in the frontend or git
Service role key, Anthropic/OpenRouter key, webhook secret, Slack/Discord URL.

## Plan
- Day 1-2: FastAPI webhook, Supabase table + RLS, LLM call
- Day 3: Slack/Discord alert, Dockerfile
- Day 4: Deploy backend to Render
- Day 5: Next.js dashboard, deploy to Vercel
- Day 6: RUNBOOK, README, end-to-end test, then apply

## Definition of done
- A test POST triggers the full flow and shows on the dashboard
- Backend live on Render, dashboard live on Vercel
- No secrets in git
- AI_LOG.md has at least one real, specific Copilot  mistake

## Job notes to confirm before answering Q5
- Role needs 4+ hours overlap with 9am-5pm US Eastern (about 9pm-5am PH time; one hour later after Nov 1)
- Post lists pay as "8-15" with no unit; probably USD per hour, confirm

## Progress
- Backend webhook implemented in `backend/main.py` with `GET /health` and authenticated `POST /webhook`.
- OpenRouter classification, Supabase persistence, and high-urgency Discord alerts were tested locally.
- Supabase Auth dashboard implemented in `frontend/` with category and urgency filters, message details, and light/dark system theme support.
- Backend Docker deployment files added and deployed to Render; `/health` and production webhook were verified.
- Frontend deployed to Vercel; login, message list, filters, detail view, and logout were verified.
- Remaining: complete the concrete entry in `AI_LOG.md`, add backend pytest coverage, and keep deployment URLs/secrets documented only in the appropriate private configuration.