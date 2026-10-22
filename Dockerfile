# Stage 1: build the frontend in live API mode, same origin (VITE_API_BASE_URL=/ -> fetch('/api/v1/...')).
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
ENV VITE_API_MODE=live VITE_API_BASE_URL=/
RUN npx vite build

# Stage 2: API, serving the built frontend at / (backend/app/main.py mounts frontend/dist when present).
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv/aegis
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=web /web/dist ./frontend/dist
RUN mkdir -p work
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
