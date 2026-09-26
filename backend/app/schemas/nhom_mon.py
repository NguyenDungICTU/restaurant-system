from pydantic import BaseModel, Field, field_validator


class NhomMonCreate(BaseModel):
    ten_nhom: str = Field(min_length=1, max_length=50)
    anh_url: str | None = Field(default=None, max_length=500)


class NhomMonUpdate(BaseModel):
    ten_nhom: str | None = Field(default=None, min_length=1, max_length=50)
    anh_url: str | None = Field(default=None, max_length=500)


class NhomMonStatusUpdate(BaseModel):
    dang_su_dung: bool


class NhomMonResponse(BaseModel):
    id: int
    ten_nhom: str
    thu_tu: int
    dang_su_dung: bool
    anh_url: str

    model_config = {
        "from_attributes": True,
    }


class NhomMonReorderItem(BaseModel):
    id: int = Field(gt=0)
    thu_tu: int = Field(gt=0)


class NhomMonReorderRequest(BaseModel):
    items: list[NhomMonReorderItem]

    @field_validator("items")
    @classmethod
    def validate_items(
        cls,
        value: list[NhomMonReorderItem],
    ):
        if not value:
            raise ValueError(
                "Danh sách sắp xếp không được rỗng."
            )

        ids = [item.id for item in value]

        if len(ids) != len(set(ids)):
            raise ValueError(
                "ID nhóm món không được trùng."
            )

        positions = [
            item.thu_tu
            for item in value
        ]

        if len(positions) != len(set(positions)):
            raise ValueError(
                "Thứ tự nhóm món không được trùng."
            )

        return value