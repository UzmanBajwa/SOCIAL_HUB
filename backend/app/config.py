from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Core
    environment: str = "development"
    debug: bool = True
    secret_key: str = "dev-secret-key-change-me"
    encryption_key: str = ""
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14
    jwt_algorithm: str = "HS256"

    # Database
    database_url: str = "postgresql+asyncpg://socialhub:socialhub@localhost:5432/socialhub"

    # Deployment URLs. Every OAuth redirect URI and CORS origin is derived from these two
    # values, so moving from dev -> staging -> prod is an env var change, not a code change.
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"

    # Extra CORS origins beyond frontend_url (comma-separated) -- useful for a temporary
    # ngrok tunnel in development. frontend_url is always allowed automatically.
    cors_extra_origins: str = ""

    # Which platforms users are allowed to connect in this deployment. Services and models
    # for disabled platforms stay fully intact -- this is purely a product on/off switch
    # enforced at the API layer (see app/api/accounts.py).
    enabled_platforms: str = "facebook,instagram"

    # Storage
    storage_backend: str = "local"
    local_upload_dir: str = "uploads"

    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "socialhub-media"
    r2_public_url: str = ""

    # Sandbox: true in development, false in production. See .env.production.example.
    platform_sandbox_mode: bool = True

    # Facebook (Meta Graph API, Facebook Login product)
    facebook_app_id: str = ""
    facebook_app_secret: str = ""
    facebook_graph_version: str = "v21.0"

    # Instagram -- uses its OWN Meta app ("Instagram API with Instagram Login"), separate
    # from the Facebook app above. No Facebook Page is required with this flow.
    instagram_app_id: str = ""
    instagram_app_secret: str = ""
    instagram_graph_version: str = "v21.0"

    # LinkedIn (kept intact for a future release; not in enabled_platforms by default)
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""

    # YouTube (kept intact for a future release; not in enabled_platforms by default)
    youtube_client_id: str = ""
    youtube_client_secret: str = ""

    # Scheduler
    scheduler_poll_seconds: int = 60

    @property
    def cors_origin_list(self) -> list[str]:
        extra = [origin.strip() for origin in self.cors_extra_origins.split(",") if origin.strip()]
        origins = [self.frontend_url.rstrip("/"), *extra]
        # dedupe while preserving order
        return list(dict.fromkeys(origins))

    @property
    def enabled_platform_list(self) -> list[str]:
        return [p.strip().lower() for p in self.enabled_platforms.split(",") if p.strip()]

    def redirect_uri(self, platform: str) -> str:
        return f"{self.frontend_url.rstrip('/')}/accounts/callback/{platform}"

    def is_platform_enabled(self, platform: str) -> bool:
        return platform.lower() in self.enabled_platform_list


@lru_cache
def get_settings() -> Settings:
    return Settings()
