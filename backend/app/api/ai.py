from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.deps import get_current_user
from app.models.user import User
from app.schemas.ai import AIAssistRequest, AIAssistResponse
from app.services import ai_service

router = APIRouter(prefix="/posts", tags=["ai"])


@router.post("/ai-assist", response_model=AIAssistResponse)
async def ai_assist(
    payload: AIAssistRequest, current_user: User = Depends(get_current_user)
) -> AIAssistResponse:
    try:
        result = await ai_service.run_ai_action(payload.action, payload.text, payload.options)
    except ai_service.UnsupportedAIActionError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return AIAssistResponse(text=result.text, is_mock=result.is_mock)
