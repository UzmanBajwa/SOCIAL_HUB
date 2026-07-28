from fastapi import APIRouter

from app.api import accounts, auth, dashboard, media, posts

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(auth.me_router)
api_router.include_router(accounts.router)
api_router.include_router(posts.router)
api_router.include_router(media.router)
api_router.include_router(dashboard.router)
