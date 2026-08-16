from typing import Literal

from pydantic import BaseModel

AIAction = Literal[
    "improve_writing", "generate_caption", "rewrite", "translate", "generate_hashtags", "change_tone"
]


class AIAssistRequest(BaseModel):
    action: AIAction
    text: str = ""
    options: dict = {}


class AIAssistResponse(BaseModel):
    text: str
    is_mock: bool
