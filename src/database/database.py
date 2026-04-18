import os
from fastapi import Depends
from sqlalchemy.orm import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import Annotated
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:////app/data/startup.db")
engine = create_async_engine(DATABASE_URL)
Base = declarative_base()


Session = async_sessionmaker(engine, expire_on_commit=False)
async def get_session():
    async with Session() as session:
        yield session
SessionDep = Annotated[AsyncSession, Depends(get_session)]