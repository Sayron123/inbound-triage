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