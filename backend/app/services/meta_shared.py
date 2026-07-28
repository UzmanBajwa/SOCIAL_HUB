"""Shared helpers for the Meta Graph API, used by both facebook_service and
instagram_service since Instagram Business publishing rides on the same Facebook
Login flow and Page infrastructure."""
from __future__ import annotations

import httpx


async def exchange_code_for_user_token(
    client: httpx.AsyncClient, graph_base_url: str, app_id: str, app_secret: str, redirect_uri: str, code: str
) -> str:
    resp = await client.get(
        f"{graph_base_url}/oauth/access_token",
        params={
            "client_id": app_id,
            "client_secret": app_secret,
            "redirect_uri": redirect_uri,
            "code": code,
        },
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


async def exchange_for_long_lived_token(
    client: httpx.AsyncClient, graph_base_url: str, app_id: str, app_secret: str, short_lived_token: str
) -> str:
    """A user token from the initial code exchange is short-lived (~1-2 hours), which
    means Page tokens derived from it would also expire quickly. Exchanging it for a
    long-lived user token (~60 days) first means the resulting Page tokens effectively
    never expire, which is what makes unattended scheduled publishing viable."""
    resp = await client.get(
        f"{graph_base_url}/oauth/access_token",
        params={
            "grant_type": "fb_exchange_token",
            "client_id": app_id,
            "client_secret": app_secret,
            "fb_exchange_token": short_lived_token,
        },
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


async def fetch_pages(client: httpx.AsyncClient, graph_base_url: str, long_lived_user_token: str) -> list[dict]:
    resp = await client.get(
        f"{graph_base_url}/me/accounts",
        params={
            "access_token": long_lived_user_token,
            "fields": "id,name,access_token,category,picture,tasks",
        },
    )
    resp.raise_for_status()
    return resp.json().get("data", [])
