import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import MediaType


class MediaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    file_name: str
    file_url: str
    type: MediaType
    size: int
    created_at: datetime
