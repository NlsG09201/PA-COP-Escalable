# syntax=docker/dockerfile:1
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 ffmpeg libgl1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt
COPY app/ ./app/
COPY train/ ./train/
EXPOSE 8091
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8091/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8091"]
