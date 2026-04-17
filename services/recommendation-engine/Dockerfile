# syntax=docker/dockerfile:1
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt
COPY app/ ./app/
COPY train/ ./train/
EXPOSE 8092
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8092/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8092"]
