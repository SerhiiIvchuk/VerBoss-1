import os
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse

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
async def auth_google(request: Request):
    token = await oauth.google.authorize_access_token(request)

    user = token.get("userinfo")
    if not user:
        user = await oauth.google.parse_id_token(request, token)

    return {
    "email": user["email"],
    "name": user["name"],
    "picture": user["picture"]
    }