from pydantic import BaseModel


class PageSearchResult(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None


class PlaceSearchResult(BaseModel):
    id: str
    name: str
