# builds the model artifacts from the raw CSVs
FROM python:3.11-slim AS build

WORKDIR /build
COPY requirements-build.txt .
RUN pip install --no-cache-dir -r requirements-build.txt

COPY data/ ./data/
COPY app/preprocess.py ./app/preprocess.py
RUN python app/preprocess.py

# runtime image - only needs fastapi/numpy/psycopg2, not the training libs
FROM python:3.11-slim AS runtime

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements-runtime.txt .
RUN pip install --no-cache-dir -r requirements-runtime.txt

COPY app/ ./app/
COPY --from=build /build/artifacts ./artifacts

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
