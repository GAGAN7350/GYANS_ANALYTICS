from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserResponse
from app.services.auth_service import authenticate_user, create_user, generate_tokens
from app.models.user import User

router = APIRouter()

@router.post("/signup")
async def signup(data: SignupRequest, db: AsyncSession = Depends(get_db)):
    user = await create_user(db, data)
    token_resp = await generate_tokens(user)
    return JSONResponse(content=token_resp.model_dump(by_alias=True, mode='json'))

@router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.email, data.password)
    token_resp = await generate_tokens(user)
    return JSONResponse(content=token_resp.model_dump(by_alias=True, mode='json'))

@router.post("/refresh")
async def refresh():
    pass

@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    resp = UserResponse.model_validate(user)
    return JSONResponse(content=resp.model_dump(by_alias=True, mode='json'))

@router.put("/me")
async def update_me(user: User = Depends(get_current_user)):
    resp = UserResponse.model_validate(user)
    return JSONResponse(content=resp.model_dump(by_alias=True, mode='json'))

