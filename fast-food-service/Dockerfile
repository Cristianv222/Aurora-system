FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema incluyendo libjemalloc2 para gestión eficiente de RAM
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libjemalloc2 \
    && rm -rf /var/lib/apt/lists/*

# Configuración de variables de entorno para optimización de RAM y allocators
ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2 \
    MALLOC_ARENA_MAX=2 \
    MALLOC_TRIM_THRESHOLD_=131072 \
    PYTHONUNBUFFERED=1

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY . .

# Exponer puerto
EXPOSE 8000

# Comando por defecto usando Gunicorn + Uvicorn worker + reciclado automático de workers
CMD ["gunicorn", "fast_food_service.asgi:application", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--workers", "2", "--max-requests", "500", "--max-requests-jitter", "50", "--timeout", "120"]