# Build context: repositorio raíz (Render: dockerContext: .)
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY services/j48-python/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r ./requirements.txt

COPY services/j48-python/app ./app
COPY services/j48-python/train ./train
COPY datasets/relapse_risk_j48.arff /data/relapse_risk_j48.arff

ENV J48_ARFF_PATH=/data/relapse_risk_j48.arff
ENV J48_MODEL_PATH=/models/j48_sklearn.joblib
ENV J48_LAB_DATA_DIR=/data/lab
ENV J48_AUTO_TRAIN=true
RUN mkdir -p /data/lab/datasets /data/lab/models /models
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=90s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
