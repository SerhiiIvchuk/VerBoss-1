import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, EmailStr

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base, Mapped, mapped_column
from typing import Annotated
# Отримуємо шлях до бази з перемінних оточення Docker (або ставимо дефолт)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:////app/data/startup.db")
FRONTEND_URL = os.getenv("FRONTEND_URL")
engine = create_async_engine(DATABASE_URL)
Base = declarative_base()
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
    allow_origins=["FRONTEND_URL"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "Бекенд для перекладу відео працює!",
        "database_connected": DATABASE_URL.split("/")[-1], # Покаже назву файлу бази
        "test-1": "just a code for a test-1 branch",
    }
# Створює датабазу при запуску бекенду (якщо немає)
@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# ТУТ УЧНІ БУДУТЬ ДОДАВАТИ СВІЙ КОД:
# 1. Створення моделей (SQLAlchemy)
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    login: Mapped[str] = mapped_column(unique=True)
    email: Mapped[str] = mapped_column(unique=True)
    password: Mapped[str]
# 2. Створення схем (Pydantic)
class UserAddSchema(BaseModel):
    login: str
    email: EmailStr
    password: str
# 3. Ендпоінти (app.post("/translate") тощо)
# 3.1 Отримання всіх юзерів
@app.get("/get_all_users")
async def get_all_users(session: SessionDep):
    query = select(User)
    res = await session.execute(query)
    return res.scalars().all()
# 3.2 Додавання нового юзера
@app.post("/add_new_user")
async def add_new_user(user: UserAddSchema, session: SessionDep):
    stmt = select(User).where(User.login == user.login)
    res = await session.execute(stmt)
    if res.scalar_one_or_none():
        return {"User" : "Is already exists"}
    new_user = User(
        login = user.login,
        email = user.email,
        password = user.password
    )
    session.add(new_user)
    await session.commit()
    return {"User" : "Added"}