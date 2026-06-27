from __future__ import annotations

from fastapi import APIRouter, Depends

from ...db_models import UserRow
from ..deps import get_current_user
from ..schemas_auth import UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def me(user: UserRow = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)
