FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=120

RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install \
    --no-cache-dir \
    --timeout 120 \
    --retries 10 \
    -r requirements.txt

COPY app ./app
COPY uploads ./default-assets
COPY alembic.ini .
COPY alembic ./alembic
COPY entrypoint.py .

EXPOSE 8000

CMD ["python", "entrypoint.py"]