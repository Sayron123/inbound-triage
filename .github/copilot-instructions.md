# Copilot instructions for `inbound-triage`

## Current repository state

This repository is an early scaffold. `PROJECT_BRIEF.md` is the source of truth for the intended application, while the actual backend and frontend implementation has not been added yet. `README.md` is currently only a placeholder, and there are no package manifests, Dockerfiles, test configuration, or lint configuration to invoke.

## Build, test, and lint commands

No build, test, or lint commands are currently implemented in this checkout. Do not invent a passing command by assuming a framework configuration exists.

The intended backend test runner is `pytest`; once the backend is implemented, run it from the repository root or backend directory according to the eventual project configuration. To run one test, use pytest's standard node selection, for example:

```text
pytest path\to\test_file.py::test_name
```

The intended frontend is Next.js with TypeScript, but no `package.json` exists yet. Add and document the actual package-manager scripts when the frontend is created rather than documenting commands that are not available.

## Architecture

The target system is an inbound-message triage pipeline:

1. An external webhook sends `name`, `email`, and `text` to a Python 3.11+ FastAPI service.
2. The backend authenticates every webhook request with a shared secret or request signature, validates the payload, and calls a Gemini or OpenRouter LLM.
3. The LLM result is structured as `category`, `urgency`, and a one-line `summary`.
4. The backend writes the original message and classification to Supabase Postgres.
5. High-urgency messages trigger a Slack or Discord webhook alert.
6. A Next.js/TypeScript dashboard in `frontend/` uses Supabase Auth and the browser-safe Supabase credentials to list, filter, and inspect messages.

The intended deployment split is a Dockerized FastAPI backend on Render and the Next.js frontend on Vercel Hobby. Vercel's root directory should be `frontend`. Supabase is the shared data and authentication layer: RLS remains enabled, logged-in users can read messages, and only the backend uses the Supabase service-role key for writes.

The expected database record is a `messages` row containing `id`, `name`, `email`, `text`, `category`, `urgency`, `summary`, and `created_at`.

## Repository-specific conventions

- Keep all privileged integrations in the backend. Never expose the Supabase service-role key, LLM key, webhook secret, or Slack/Discord URL to the frontend or commit them to git.
- The frontend may only receive `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as Vercel environment variables.
- Treat malformed webhook payloads and LLM failures as handled request errors; they must not crash the service or produce a success-shaped record with missing classification data.
- Preserve the webhook flow order: authenticate and validate, classify and summarize, persist, then alert only when urgency is high.
- Keep the backend's external contract centered on `POST /webhook` and `GET /health`.
- Keep Supabase RLS enabled and design frontend reads around authenticated users; do not bypass RLS from browser code.
- Record a concrete Copilot mistake in `AI_LOG.md` using the existing fields: what it produced, how it was caught, and what was changed.
- Update `PROJECT_BRIEF.md` when implementation progress changes the planned architecture or definition of done. Expand `README.md` with real setup, deployment, and test commands as those pieces are implemented.

## Rules
- PROJECT_BRIEF.md is the source of truth. Keep scope to the brief.
- Never commit secrets. Never read or print .env values in code or logs.
- Verify the webhook secret on every POST /webhook request.
- The Supabase service role key is backend only, never in /frontend.
- Keep it simple. Don't add libraries or abstractions the brief doesn't need.
- Explain security-relevant choices briefly (auth, RLS, secrets).