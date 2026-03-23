import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Отримуємо шлях до бази з перемінних оточення Docker (або ставимо дефолт)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:////app/data/startup.db")

app = FastAPI(title="Plugin Translation Startup")

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
        "database_connected": DATABASE_URL.split("/")[-1] # Покаже назву файлу бази
    }

# ТУТ УЧНІ БУДУТЬ ДОДАВАТИ СВІЙ КОД:
# 1. Створення моделей (SQLAlchemy)
# 2. Створення схем (Pydantic)
# 3. Ендпоінти (app.post("/translate") тощо)
