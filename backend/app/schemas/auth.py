from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    identifier: str = Field(
        min_length=1,
        max_length=100,
    )

    password: str = Field(
        min_length=1,
        max_length=128,
    )


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str


class LoginResponse(BaseModel):
    message: str
    user: UserResponse


class ErrorResponse(BaseModel):
    detail: str