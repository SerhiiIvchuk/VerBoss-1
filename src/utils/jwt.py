from jose import jwt
from datetime import datetime, timezone, timedelta
import os

SECRET_KEY = os.getenv("SESSION_SECRET")
ALGORITH = "HS256"

def create_access_token(user_id: int):
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITH)