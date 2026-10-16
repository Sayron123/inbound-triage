# Inbound Triage Runbook

## What it does

Inbound Triage receives an authenticated message webhook, classifies the message with OpenRouter, stores the original message and classification in Supabase, and sends a Discord alert when the urgency is high.

The Next.js dashboard uses Supabase Auth to let authenticated users read and filter stored messages. Message rows link to a detail page at `/messages/[id]`.

The backend flow is:

```text
POST /webhook
  -> verify X-Webhook-Secret
  -> classify with OpenRouter
  -> insert into Supabase messages
  -> alert Discord when urgency is high
```

## Where it runs

- Backend: Dockerized FastAPI service on Render.
- Frontend: Next.js application in `frontend/`, deployed on Vercel.
- Database and authentication: Supabase.
- Classification: OpenRouter.
- High-urgency notifications: Discord webhook.

The backend Docker service uses `backend/Dockerfile` and starts:

```text
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Render is configured with `backend` as the root directory and Docker as the runtime. Vercel is configured with `frontend` as the root directory.

## Environment variables

### Render backend

Configure these names in the Render service environment settings. Do not commit their values:

```text
SUPABASE_URL
SUPABASE_KEY
OPENROUTER_API_KEY
OPENROUTER_MODEL
WEBHOOK_SECRET
DISCORD_WEBHOOK_URL
```

`SUPABASE_KEY` is backend-only. It must never be placed in the frontend or exposed to the browser.
It must contain the Supabase **service-role key**, not the browser anon key.

### Vercel frontend

Configure only these names in Vercel:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

The frontend uses the anon key with the authenticated Supabase session. Keep Row Level Security enabled on the `messages` table.

### Local development

Backend values belong in `backend\.env`. Frontend values belong in `frontend\.env.local`. Both files are ignored by Git and must stay local.

## Deploying the backend

1. Push the backend deployment files and code to the repository:
   - `backend/Dockerfile`
   - `backend/.dockerignore`
   - `backend/requirements.txt`
   - `backend/main.py`
2. In Render, select the repository and choose `backend` as the root directory.
3. Select Docker as the runtime.
4. Add the six backend environment variable names listed above with their current rotated values.
5. Deploy the service.
6. Check `GET /health`.

Expected health response:

```json
{"status":"ok"}
```

## Deploying the frontend

1. In Vercel, select the repository.
2. Set the root directory to `frontend`.
3. Add only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy the Next.js application.
5. Verify login, the messages table, category and urgency filters, message detail pages, and logout.

## Health and smoke checks

Run the local backend from the repository root:

```powershell
python -m uvicorn backend.main:app --reload
```

Check the local health endpoint:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

For a webhook smoke test, send a `POST` request to `/webhook` with:

- `Content-Type: application/json`
- `X-Webhook-Secret`
- JSON fields `name`, `email`, and `text`

Example body:

```json
{
  "name": "Production Test",
  "email": "test@example.com",
  "text": "I need urgent help with my billing account."
}
```

The deployed webhook must be tested with the Render service address. A browser `GET` request to `/webhook` is expected to return `405 Method Not Allowed`; use `POST` instead.

The classifier accepts these fixed categories:

```text
billing, technical, sales, support, other
```

If OpenRouter returns a different category, backend validation fails and the webhook returns `502 Classification failed`; there is no fallback category or fallback model in the backend.

Run the frontend checks from `frontend`:

```powershell
npm run lint
npm run build
```

Run backend tests from `backend`:

```powershell
python -m pytest
```

## Common problems

### `/webhook` returns `405 Method Not Allowed`

The endpoint accepts `POST`, not `GET`. Use Postman or another HTTP client with the required JSON body and `X-Webhook-Secret` header.

### The first Render request is slow or times out

The Render free tier sleeps when idle. The first request after inactivity can be slow or time out; wait 30 to 60 seconds and retry before treating the service as broken.

### `/webhook` returns `401 Invalid webhook secret`

The header is missing, does not match `WEBHOOK_SECRET`, or the Render environment variable is missing. Check the secret in the Render service settings without printing it to logs.

### `/webhook` returns `422`

The JSON body does not contain valid `name`, `email`, and `text` fields. Check the request body and `Content-Type`.

### `/webhook` returns `502 Classification failed`

The OpenRouter request failed or returned an unusable classification. The configured free model may be rate limited and return `429`, or it may have been removed or become unavailable. Check `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, the Render deployment logs, and the OpenRouter service status. If the model is unavailable or rate limited, switch `OPENROUTER_MODEL` to an available model in Render and redeploy or restart the service. The backend has no fallback model. Do not log or paste the API key.

### The dashboard shows a Supabase error

Check that:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured in Vercel.
- The user is signed in.
- The `messages` table exists with the expected columns.
- RLS is enabled and authenticated users have the intended read policy.

### The dashboard shows no messages

Check the selected category and urgency filters, then clear them. If the table is still empty, confirm that a successful webhook inserted a row into Supabase and that the signed-in user is allowed to read it.

### High-urgency messages do not alert Discord

Confirm that the classifier returned `high`, `DISCORD_WEBHOOK_URL` is configured in Render, and the Discord webhook is still active. The alert is attempted after the Supabase insert.

### The frontend cannot find Supabase variables locally

Put the two `NEXT_PUBLIC_*` variables in `frontend\.env.local`, start the dev server from `frontend`, and restart it after changing the file. Do not use backend variable names in the frontend.

## Rotating a leaked key or secret

If any credential may have been exposed:

1. Identify which secret was exposed:
   - `OPENROUTER_API_KEY`
   - `DISCORD_WEBHOOK_URL`
   - `WEBHOOK_SECRET`
   - `SUPABASE_KEY` (the Supabase service-role key)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` if it was incorrectly handled
2. Revoke, delete, regenerate, or rotate it in the provider that issued it:
   - OpenRouter for `OPENROUTER_API_KEY`
   - Discord for `DISCORD_WEBHOOK_URL`
   - Supabase for `SUPABASE_KEY` or the anon key
   - Generate a new random value for `WEBHOOK_SECRET`, set it on Render, and update it wherever requests are sent from, such as Postman
3. Replace the value in the appropriate deployment environment:
   - Render for backend secrets
   - Vercel only for the two `NEXT_PUBLIC_*` values
   - `backend\.env` or `frontend\.env.local` for local development
   - For `WEBHOOK_SECRET`, also update every webhook sender, such as Postman
4. Redeploy or restart the affected service so it loads the new value.
5. Test `GET /health`, then run a webhook smoke test with the new `X-Webhook-Secret`.
6. Search Git history and the current worktree for the leaked value without printing it. If it was committed, treat it as compromised even after deleting the file.
7. Confirm the old credential no longer works and keep the new value out of Git, logs, screenshots, and issue comments.

Never place `SUPABASE_KEY`, `OPENROUTER_API_KEY`, `WEBHOOK_SECRET`, or `DISCORD_WEBHOOK_URL` in `frontend` or commit them.


## Render , Vercel and Supabase (Links)
   - `RENDER` https://inbound-triage.onrender.com
   - `VERCEL` https://inbound-triage-eight.vercel.app/
   - `SUPABASE` https://gndeoatmxykvxjumhadj.supabase.co