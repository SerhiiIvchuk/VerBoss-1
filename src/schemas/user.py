from pydantic import BaseModel, EmailStr

class UserAddSchema(BaseModel):
    google_id: str
    email: EmailStr
    full_name: str | None = None
    picture: str | None = None