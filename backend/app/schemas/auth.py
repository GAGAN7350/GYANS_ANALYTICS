from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=None,
    )

    # Accept both camelCase (from frontend) and snake_case
    def __init__(self, **data):
        # Map camelCase fullName -> snake_case full_name
        if "fullName" in data and "full_name" not in data:
            data["full_name"] = data.pop("fullName")
        super().__init__(**data)


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = Field(None, serialization_alias="fullName")
    role: str = "viewer"
    is_active: bool = Field(True, serialization_alias="isActive")
    avatar_url: Optional[str] = Field(None, serialization_alias="avatarUrl")
    created_at: Optional[datetime] = Field(None, serialization_alias="createdAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TokenResponse(BaseModel):
    access_token: str = Field(..., serialization_alias="accessToken")
    refresh_token: str = Field(..., serialization_alias="refreshToken")
    token_type: str = Field("bearer", serialization_alias="tokenType")
    user: Optional[UserResponse] = None

    model_config = ConfigDict(populate_by_name=True)

