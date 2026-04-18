import os

from authlib.integrations.starlette_client import OAuth

from sqlalchemy import select

from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from jose import jwt, JWTError
from database.database import SessionDep
from models.user import User
from utils.jwt import create_access_token

security = HTTPBearer()

SECRET_KEY = os.getenv("SESSION_SECRET")
ALGORITHM = os.getenv("ALGO")


router = APIRouter()

oauth = OAuth()

oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={
        "scope" : "openid email profile"
    }
)
@router.get("/login/google")
async def login_google(request: Request):
    redirect_uri = "https://sherill-carpellary-fulgently.ngrok-free.dev/auth/google"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/auth/google")
async def auth_google(request: Request, session: SessionDep):
    token = await oauth.google.authorize_access_token(request)

    user = token.get("userinfo")
    if not user:
        user = await oauth.google.parse_id_token(request, token)

    google_id = user["sub"]
    
    result = await session.execute(
        select(User).where(User.google_id == google_id)
    )
    db_user = result.scalar_one_or_none()

    if not db_user:
        db_user = User(
            google_id=google_id,
            email=user["email"],
            full_name=user.get("name"),
            picture=user.get("picture")
        )
        session.add(db_user)
        await session.commit()
        await session.refresh(db_user)
    
    access_token = create_access_token(db_user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid Token")