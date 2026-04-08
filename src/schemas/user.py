from pydantic import BaseModel

class UserAddSchema(BaseModel):
    id_token: str