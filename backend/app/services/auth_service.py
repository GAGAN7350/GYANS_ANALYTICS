from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.auth import SignupRequest, TokenResponse
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token

async def create_user(db: AsyncSession, data: SignupRequest) -> User:
    result = await db.execute(select(User).filter(User.email == data.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        full_name=data.full_name
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    return user

async def generate_tokens(user: User) -> TokenResponse:
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=user)
