FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar codigo
COPY . .

# Exponer puerto
EXPOSE 8000

# Comando por defecto
CMD ["gunicorn", "auth_service.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
