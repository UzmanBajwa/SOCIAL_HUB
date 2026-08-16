import asyncpg
import httpx
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import get_settings
from app.database.session import Base, get_db
from app.models import SocialAccount, User
from app.models.enums import Platform

TEST_DB_NAME = "socialhub_test"


async def _test_database_url() -> str:
    url = make_url(get_settings().database_url)
    test_url = url.set(database=TEST_DB_NAME)
    conn = await asyncpg.connect(
        host=url.host,
        port=url.port,
        user=url.username,
        password=url.password,
        database=url.database or "postgres",
    )
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", TEST_DB_NAME)
        if not exists:
            await conn.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')
    finally:
        await conn.close()
    return str(test_url)


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    test_url = await _test_database_url()
    engine = create_async_engine(test_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    factory = async_sessionmaker(bind=db_engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    async with db_engine.begin() as conn:
        await conn.execute(
            text("TRUNCATE TABLE users, social_accounts, posts, post_platforms, media CASCADE")
        )


@pytest_asyncio.fixture
async def user(db_session):
    u = User(
        name="Test User",
        email="test@example.com",
        password_hash="hashed",
        is_active=True,
    )
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture
async def instagram_account(user, db_session):
    acc = SocialAccount(
        user_id=user.id,
        platform=Platform.instagram,
        account_name="Test Instagram",
        account_username="@test_ig",
        platform_account_id="ig-test-1",
        access_token="encrypted-placeholder",
        scopes=["instagram_business_basic"],
    )
    db_session.add(acc)
    await db_session.commit()
    await db_session.refresh(acc)
    return acc


@pytest_asyncio.fixture
async def api_client(db_engine, user):
    from app.auth.deps import get_current_user
    from app.main import app

    factory = async_sessionmaker(bind=db_engine, expire_on_commit=False)

    async def override_get_db():
        async with factory() as session:
            yield session

    async def override_get_current_user():
        return user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
