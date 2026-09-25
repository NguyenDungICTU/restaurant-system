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


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(
        min_length=1,
        max_length=128,
    )

    new_password: str = Field(
        min_length=1,
        max_length=128,
    )

    confirm_password: str = Field(
        min_length=1,
        max_length=128,
    )


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    must_change_password: bool = False


class LoginResponse(BaseModel):
    message: str
    user: UserResponse


class ChangePasswordResponse(BaseModel):
    message: str
    logout_required: bool = True


class ErrorResponse(BaseModel):
    detail: str
