import os
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from starlette.middleware.sessions import SessionMiddleware

from sqlalchemy import select

from dotenv import load_dotenv

from auth.auth import router as auth_router

from models.user import User
from database.database import Base, engine, DATABASE_URL, SessionDep
from schemas.user import UserAddSchema
from auth.auth import get_current_user
# Отримуємо шлях до бази з перемінних оточення Docker (або ставимо дефолт)
load_dotenv()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    await engine.dispose()

app = FastAPI(title="Plugin Translation Startup", lifespan=lifespan)

# Корс для підключення бекенду. (FRONTEND_URL береться з docker-compose.yml)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET"),
    same_site="none",
    https_only=True
)

app.include_router(auth_router)

@app.get("/")
async def root():
    return {
        "message": "Бекенд для перекладу відео працює!",
        "database_connected": DATABASE_URL.split("/")[-1], # Покаже назву файлу бази
        "test-1": "just a code for a test-1 branch",
    }



# 3.1 Отримання всіх юзерів
@app.get("/get_all_users")
async def get_all_users(session: SessionDep):
    query = select(User)
    res = await session.execute(query)
    return res.scalars().all()


# 3.2 Додавання нового юзера
@app.post("/add_new_user")
async def add_new_user(user: UserAddSchema, session: SessionDep):
    return list(Base.metadata.tables.keys())

# 3.3 тестовий ендпоінт щоб перевірити айпі користувача
@app.get("/get_ip")
async def get_user_ip(request: Request):
        return {
        "client": request.client.host,
        "headers": dict(request.headers),
        "Base" : list(Base.metadata.tables.keys())
    }
@app.get("/me")
async def me(user=Depends(get_current_user), session: SessionDep = None):
    return await session.get(User, user["sub"])