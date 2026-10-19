# COPILOT (for Q4)

For each mistake, write: what it produced, how I caught it, what I changed.

## Entry 1

- What it produced: lack of information in code implementation,
- How I caught it: i check the docs and the implement side by side is different.
- What I changed: since its possible lack of parameter. every time i put the modern structure of code i ask it to just help me build the right structure.so it can still know the flow of the code.

## Entry 2 

- What it produced: Copilot said `"Authorization": f"Bearer {api_key}"` was wrong and told me to use `"Authorization": f"Bearer {api_key}"`, the exact same line. It also claimed the line sent literal text.
- How I caught it: The "wrong" and "correct" lines were identical, so I checked the actual line in main.py. It was already correct.
- What I changed: i use ("Bearer" + api_key) instead of (f"Bearer {api_key}")

## Entry 3 

- What it produced: Repetitive asking it to Read the md(Markdown) yet it's still do the same mistake.
- How I caught it: The fix my code instead of Guiding me thru process.
- What I changed: i just tell it to guide me base on the current status.

## Entry 4

- Tool: Claude Code
- What it produced: For the Gmail feature, it planned and pushed an automatic timer on GitHub that would knock on a "check Gmail" door on my backend every 10 minutes. That door did not exist yet, and my plan was to add Gmail checking into the backend itself, which is more work and more risk (extra passwords stored on the server).
- How I caught it: I decided on a simpler design, a small Google script inside my Gmail that sends each new email to the backend I already have, and I updated my project instructions to say so. Compared with that, the timer it built was pointing at nothing and would have failed every time with "not found".
- What I changed: I had it delete the timer and drop the backend Gmail plan. Gmail now sends emails through the existing webhook with a small "source" tag, so the dashboard can show which messages came from email and which came from the webhook.