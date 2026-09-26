from pydantic import BaseModel, Field, field_validator


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
    password_change_required: bool = False


class LoginResponse(BaseModel):
    message: str
    user: UserResponse


class ErrorResponse(BaseModel):
    detail: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if not any(character.isalpha() for character in value):
            raise ValueError("Mật khẩu mới phải có ít nhất một chữ cái.")
        if not any(character.isdigit() for character in value):
            raise ValueError("Mật khẩu mới phải có ít nhất một chữ số.")
        return value