import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.ml.model_service import model_service
from app.routers import health, lab, predict
from app.ml.lab_service import lab_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="COP J48 Psychology Risk Service",
    version="1.0.0",
    description="Predicción de recaída psicológica con árbol de decisión (scikit-learn).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(predict.router)
app.include_router(lab.router)


@app.on_event("startup")
def startup() -> None:
    lab_service.init()
    model_service.init()
    logger.info("J48 Python service listo (modelo=%s)", settings.model_path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=False)
