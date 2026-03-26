import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base, Mapped, mapped_column
from typing import Annotated
# Отримуємо шлях до бази з перемінних оточення Docker (або ставимо дефолт)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:////app/data/startup.db")
engine = create_async_engine(DATABASE_URL)
Base = declarative_base()
app = FastAPI(title="Plugin Translation Startup")

Session = async_sessionmaker(engine, expire_on_commit=False)
async def get_session():
    async with Session() as session:
        yield session
SessionDep = Annotated[AsyncSession, Depends(get_session)]


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    Name : Mapped[str] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True)
# 2. Створення схем (Pydantic)
# 3. Ендпоінти (app.post("/translate") тощо)
@app.get("/get_all_users")
async def get_all_users(session: SessionDep):
    query = select(User)
    res = await session.execute(query)
    return res.scalars().all()