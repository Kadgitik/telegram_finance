# Stage 1: фронтенд Mini App
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: FastAPI + роздача static/
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONPATH=/app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY bot ./bot
COPY backend ./backend
COPY --from=frontend-build /app/frontend/dist ./static
# Підміна на static/ з git (завжди як у останньому push) — обходить застиглий кеш шару npm build на Render
COPY static ./static
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
