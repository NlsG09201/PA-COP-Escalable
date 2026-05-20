# Build context: repositorio raíz (Render: dockerContext: .)
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY services/recommendation-engine/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r ./requirements.txt

COPY services/recommendation-engine/app ./app
COPY services/recommendation-engine/train ./train

ENV PYTHONUNBUFFERED=1
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=120s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
