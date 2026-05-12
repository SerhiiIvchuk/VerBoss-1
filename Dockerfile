# Використовуємо офіційний образ Python (slim-версія для економії місця)
FROM python:3.11-slim

# Встановлюємо системні залежності для коректної роботи bcrypt та sqlalchemy
RUN apt-get update && apt-get install -y \
    build-essential \
    libffi-dev \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

#FFMPEG для Whisper
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Встановлюємо робочу директорію
WORKDIR /app

# Створюємо папку для бази даних заздалегідь
RUN mkdir -p /app/data

# Спочатку копіюємо лише файл залежностей (це важливо для кешування шарів Docker)
COPY requirements.txt .

# Встановлюємо бібліотеки Python
RUN pip install --no-cache-dir -r requirements.txt
RUN pip list

# Копіюємо решту файлів проекту (код учнів, бази тощо)
COPY src/ .

# Відкриваємо порт 8000
EXPOSE 8000

# Запускаємо сервер з автоперезавантаженням (зручно для стартапу)
# Замініть 'main' на назву файлу, який є входом у додаток
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--reload"]