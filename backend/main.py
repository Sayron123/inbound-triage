import hmac
import httpx
import logging
import os ,json
from dotenv import load_dotenv
from fastapi import FastAPI ,Header , HTTPException
from pydantic import BaseModel
from typing import Annotated
from supabase import create_client, Client
from typing import Literal

app = FastAPI()
load_dotenv()
logger = logging.getLogger("inbound-triage")

Category = Literal[
    "billing",
    "technical",
    "sales",
    "support",
    "other",
]

Urgency = Literal[
    "low",
    "medium",
    "high"
]
Source = Literal[
    "webhook",
    "gmail",
]

class Messages(BaseModel):
    name: str
    email: str
    text: str
    source: Source = "webhook"  # optional, so existing callers (Postman) keep working

class Classification(BaseModel):
    category: Category
    urgency: Urgency
    summary: str


@app.get("/health")
def health():
    return {"status": "ok"}
    

@app.post("/webhook") 
async def webhook(
        body: Messages,
        webhook_secret: Annotated [ str | None, Header(alias="X-Webhook-Secret")] = None #add None to tell the FastApi its optional
    ): 
    expected_secret = os.getenv("WEBHOOK_SECRET")
    api_key = os.getenv("OPENROUTER_API_KEY")
    m  = os.getenv("OPENROUTER_MODEL")

    #Authentication 
    if (
        expected_secret is None
        or webhook_secret is None 
        or not hmac.compare_digest(webhook_secret, expected_secret) #to check the Whole Secret instead of line by line 
    ): 
        raise HTTPException(
            status_code=401,
            detail="Invalid webhook secret",
        )
    discord_url = os.getenv("DISCORD_WEBHOOK_URL")
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_KEY")
    supabase: Client = create_client(url, key)
    async with httpx.AsyncClient() as client:
        try:
            r  = await client.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": "Bearer " + api_key,          
                },
                json=({
                    "model": m,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "Classify the inbound message. Return only valid JSON with these "
                                "fields: category, urgency, summary. "
                                "urgency must be low, medium, or high. "
                                "summary must be one concise sentence."
                                "The category must be exactly one of: billing, technical, sales, support, other"
                            ) 
                        },
                        {
                            "role" : "user",
                            "content": body.text 
                        },
                    ]
                })
            )
            r.raise_for_status()
            response_data = r.json()
            ai_content = response_data["choices"][0]["message"]["content"]

            classification = Classification.model_validate_json(ai_content)
        except (httpx.HTTPError, KeyError, ValueError):
            raise HTTPException(status_code=502, detail="Classification failed")

        category = classification.category
        urgency  = classification.urgency
        summary  = classification.summary

        supabase.table("messages").insert({
            "name": body.name,
            "email": body.email,
            "text": body.text,
            "category": category,
            "urgency": urgency,
            "summary": summary,
            "source": body.source,
        }).execute()

        # The message is already saved, so a Discord failure must not fail the
        # request. Returning an error would make the sender retry and duplicate the row.
        if urgency == "high" and discord_url:
            try:
                discord_response = await client.post(
                    discord_url,
                    json={
                        "content": f"High urgency message from {body.name}: {summary}",
                        # name and summary come from outside senders; never let them ping anyone
                        "allowed_mentions": {"parse": []},
                    }
                )
                discord_response.raise_for_status()
            except httpx.HTTPError:
                logger.warning("Discord alert failed")
    return {
        "received": True,
        "has_secret": webhook_secret is not None
    }