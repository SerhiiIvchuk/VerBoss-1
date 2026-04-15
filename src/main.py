import os
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from starlette.middleware.sessions import SessionMiddleware

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import Annotated

from dotenv import load_dotenv

from auth.auth import router as auth_router

from models.user import user
from database.database import Base
from schemas.user import UserAddSchema
# Отримуємо шлях до бази з перемінних оточення Docker (або ставимо дефолт)
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:////app/data/startup.db")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
engine = create_async_engine(DATABASE_URL)
app = FastAPI(title="Plugin Translation Startup")
# Створення сесії та генератору
Session = async_sessionmaker(engine, expire_on_commit=False)
async def get_session():
    async with Session() as session:
        yield session
SessionDep = Annotated[AsyncSession, Depends(get_session)]

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
    secret_key=os.getenv("SESSION_SECRET")
)

app.include_router(auth_router)

@app.get("/")
async def root():
    return {
        "message": "Бекенд для перекладу відео працює!",
        "database_connected": DATABASE_URL.split("/")[-1], # Покаже назву файлу бази
        "test-1": "just a code for a test-1 branch",
    }


# Створює датабазу при запуску бекенду (якщо немає)
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    await engine.dispose()


# 3.1 Отримання всіх юзерів
@app.get("/get_all_users")
async def get_all_users(session: SessionDep):
    query = select(user)
    res = await session.execute(query)
    return res.scalars().all()


# 3.2 Додавання нового юзера
@app.post("/add_new_user")
async def add_new_user(user: UserAddSchema, session: SessionDep):
    return {"Endpoint" : "Is working"}

# 3.3 тестовий ендпоінт щоб перевірити айпі користувача
@app.get("/get_ip")
async def get_user_ip(request: Request):
        return {
        "client": request.client.host,
        "headers": dict(request.headers),
        "Base" : list(Base.metadata.tables.keys())
    }