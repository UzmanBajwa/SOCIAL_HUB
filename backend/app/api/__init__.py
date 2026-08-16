from fastapi import APIRouter

from app.api import accounts, ai, auth, dashboard, facebook, media, posts, youtube

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(auth.me_router)
api_router.include_router(accounts.router)
api_router.include_router(posts.router)
api_router.include_router(ai.router)
api_router.include_router(facebook.router)
api_router.include_router(media.router)
api_router.include_router(youtube.router)
api_router.include_router(dashboard.router)
