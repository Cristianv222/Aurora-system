# create-aurora-system.ps1
# Script para crear la estructura completa del proyecto Aurora System

# Colores para mensajes
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Green "=========================================="
Write-ColorOutput Green "   AURORA SYSTEM - Creacion de Estructura"
Write-ColorOutput Green "=========================================="
Write-Host ""

# Verificar si estamos en el directorio correcto
$currentDir = Get-Location
Write-ColorOutput Yellow "Directorio actual: $currentDir"
Write-Host ""

$confirm = Read-Host "Deseas crear la estructura en este directorio? (s/n)"
if ($confirm -ne 's' -and $confirm -ne 'S') {
    Write-ColorOutput Red "Operacion cancelada."
    exit
}

# Crear directorios base
Write-ColorOutput Cyan "`n[1/8] Creando estructura de directorios..."

$services = @(
    "auth-service",
    "fast-food-service",
    "hotel-service",
    "pool-service",
    "restaurant-service",
    "reporting-service",
    "notification-service"
)

# Estructura de apps por servicio
$serviceApps = @{
    "auth-service" = @("authentication", "users", "roles")
    "fast-food-service" = @("menu", "pos", "orders", "payments", "kitchen", "printer", "customers", "reports")
    "hotel-service" = @("rooms", "reservations", "checkin", "guests", "services", "reports")
    "pool-service" = @("access", "pricing", "customers", "lockers", "reports")
    "restaurant-service" = @("menu", "tables", "reservations", "pos", "orders", "payments", "kitchen", "printer", "customers", "reports")
    "reporting-service" = @("consolidation", "analytics", "dashboards", "integrations", "exports")
    "notification-service" = @("email", "sms", "push")
}

# Crear estructura de cada servicio
foreach ($service in $services) {
    Write-ColorOutput Yellow "  > Creando $service..."
    
    # Crear directorio del servicio
    New-Item -ItemType Directory -Force -Path $service | Out-Null
    
    # Crear subdirectorios
    $serviceName = $service -replace "-service", "_service"
    
    New-Item -ItemType Directory -Force -Path "$service\$serviceName" | Out-Null
    New-Item -ItemType Directory -Force -Path "$service\apps" | Out-Null
    New-Item -ItemType Directory -Force -Path "$service\core" | Out-Null
    
    # Crear apps del servicio
    foreach ($app in $serviceApps[$service]) {
        $appPath = "$service\apps\$app"
        New-Item -ItemType Directory -Force -Path $appPath | Out-Null
        New-Item -ItemType Directory -Force -Path "$appPath\migrations" | Out-Null
    }
}

# Crear estructura de frontend
Write-ColorOutput Yellow "  > Creando frontend..."
New-Item -ItemType Directory -Force -Path "frontend\public" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\auth\pages" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\auth\components" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\auth\context" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\fast-food\pages" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\fast-food\components" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\hotel\pages" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\hotel\components" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\pool\pages" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\pool\components" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\restaurant\pages" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\restaurant\components" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\reporting\pages" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\reporting\components" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\modules\shared" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\services" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\utils" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\styles" | Out-Null

# Crear directorios adicionales
New-Item -ItemType Directory -Force -Path "shared\middleware" | Out-Null
New-Item -ItemType Directory -Force -Path "shared\utils" | Out-Null
New-Item -ItemType Directory -Force -Path "shared\exceptions" | Out-Null
New-Item -ItemType Directory -Force -Path "scripts" | Out-Null

Write-ColorOutput Green "  OK Estructura de directorios creada"

# ============================================
# CREAR ARCHIVOS DE SERVICIOS DJANGO
# ============================================

Write-ColorOutput Cyan "`n[2/8] Creando archivos de servicios Django..."

foreach ($service in $services) {
    Write-ColorOutput Yellow "  > Configurando $service..."
    
    $serviceName = $service -replace "-service", "_service"
    
    # ========== Dockerfile ==========
    $dockerfileContent = @"
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
CMD ["gunicorn", "$serviceName.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
"@
    Set-Content -Path "$service\Dockerfile" -Value $dockerfileContent

    # ========== requirements.txt ==========
    $requirementsContent = @"
Django==5.0.1
djangorestframework==3.14.0
psycopg2-binary==2.9.9
python-dotenv==1.0.0
django-cors-headers==4.3.1
gunicorn==21.2.0
celery==5.3.4
redis==5.0.1
Pillow==10.2.0
PyJWT==2.8.0
requests==2.31.0
dj-database-url==2.1.0
"@
    Set-Content -Path "$service\requirements.txt" -Value $requirementsContent

    # ========== .env ==========
    $envContent = @"
DEBUG=True
SECRET_KEY=your-secret-key-here-change-in-production
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/${serviceName}_db
REDIS_URL=redis://redis:6379/0
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000
"@
    Set-Content -Path "$service\.env" -Value $envContent

    # ========== manage.py ==========
    $manageContent = @"
#!/usr/bin/env python
import os
import sys

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', '$serviceName.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)
"@
    Set-Content -Path "$service\manage.py" -Value $manageContent

    # ========== __init__.py del servicio ==========
    Set-Content -Path "$service\$serviceName\__init__.py" -Value ""

    # ========== settings.py ==========
    $appsInstall = ""
    foreach ($app in $serviceApps[$service]) {
        $appsInstall += "INSTALLED_APPS.append('apps.$app')`n"
    }
    
    $settingsContent = @"
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-change-this-in-production')

DEBUG = os.getenv('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
]

# Apps del servicio
$appsInstall

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = '$serviceName.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = '$serviceName.wsgi.application'

# Database
import dj_database_url
DATABASES = {
    'default': dj_database_url.config(
        default=os.getenv('DATABASE_URL'),
        conn_max_age=600
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'es-ec'
TIME_ZONE = 'America/Guayaquil'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

MEDIA_URL = 'media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20
}

# CORS
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(',')

# Celery (si aplica)
CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = os.getenv('REDIS_URL', 'redis://redis:6379/0')
"@
    Set-Content -Path "$service\$serviceName\settings.py" -Value $settingsContent

    # ========== urls.py ==========
    $urlsApps = ""
    foreach ($app in $serviceApps[$service]) {
        $urlsApps += "    path('api/$app/', include('apps.$app.urls')),`n"
    }
    
    $urlsContent = @"
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
$urlsApps]
"@
    Set-Content -Path "$service\$serviceName\urls.py" -Value $urlsContent

    # ========== wsgi.py ==========
    $wsgiContent = @"
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', '$serviceName.settings')
application = get_wsgi_application()
"@
    Set-Content -Path "$service\$serviceName\wsgi.py" -Value $wsgiContent

    # ========== asgi.py ==========
    $asgiContent = @"
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', '$serviceName.settings')
application = get_asgi_application()
"@
    Set-Content -Path "$service\$serviceName\asgi.py" -Value $asgiContent

    # ========== core/middleware.py ==========
    $middlewareContent = @"
# Middleware personalizado del servicio
"@
    Set-Content -Path "$service\core\middleware.py" -Value $middlewareContent
    Set-Content -Path "$service\core\__init__.py" -Value ""

    # ========== core/exceptions.py ==========
    $exceptionsContent = @"
from rest_framework.exceptions import APIException

class ServiceException(APIException):
    status_code = 500
    default_detail = 'Error interno del servicio.'
    default_code = 'service_error'
"@
    Set-Content -Path "$service\core\exceptions.py" -Value $exceptionsContent

    # ========== core/utils.py ==========
    $utilsContent = @"
# Utilidades del servicio
"@
    Set-Content -Path "$service\core\utils.py" -Value $utilsContent

    # ========== Crear archivos de apps ==========
    foreach ($app in $serviceApps[$service]) {
        $appPath = "$service\apps\$app"
        
        # __init__.py
        Set-Content -Path "$appPath\__init__.py" -Value ""
        Set-Content -Path "$appPath\migrations\__init__.py" -Value ""
        
        # models.py
        $modelsContent = @"
from django.db import models

# Create your models here.
"@
        Set-Content -Path "$appPath\models.py" -Value $modelsContent
        
        # views.py
        $viewsContent = @"
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

# Create your views here.
"@
        Set-Content -Path "$appPath\views.py" -Value $viewsContent
        
        # serializers.py
        $serializersContent = @"
from rest_framework import serializers

# Create your serializers here.
"@
        Set-Content -Path "$appPath\serializers.py" -Value $serializersContent
        
        # urls.py
        $urlsAppContent = @"
from django.urls import path, include
from rest_framework.routers import DefaultRouter

router = DefaultRouter()

urlpatterns = [
    path('', include(router.urls)),
]
"@
        Set-Content -Path "$appPath\urls.py" -Value $urlsAppContent
        
        # admin.py
        $adminContent = @"
from django.contrib import admin

# Register your models here.
"@
        Set-Content -Path "$appPath\admin.py" -Value $adminContent
        
        # tests.py
        $testsContent = @"
from django.test import TestCase

# Create your tests here.
"@
        Set-Content -Path "$appPath\tests.py" -Value $testsContent
    }
}

Write-ColorOutput Green "  OK Archivos de servicios Django creados"

# ============================================
# CREAR ARCHIVOS DE FRONTEND
# ============================================

Write-ColorOutput Cyan "`n[3/8] Creando archivos de frontend React..."

# ========== package.json ==========
$packageJsonContent = @"
{
  "name": "aurora-system-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "axios": "^1.6.2",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
"@
Set-Content -Path "frontend\package.json" -Value $packageJsonContent

# ========== Dockerfile ==========
$frontendDockerfile = @"
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
"@
Set-Content -Path "frontend\Dockerfile" -Value $frontendDockerfile

# ========== .env ==========
$frontendEnv = @"
REACT_APP_AUTH_SERVICE=http://localhost:8001
REACT_APP_FAST_FOOD_SERVICE=http://localhost:8002
REACT_APP_HOTEL_SERVICE=http://localhost:8003
REACT_APP_POOL_SERVICE=http://localhost:8004
REACT_APP_RESTAURANT_SERVICE=http://localhost:8005
REACT_APP_REPORTING_SERVICE=http://localhost:8006
REACT_APP_NOTIFICATION_SERVICE=http://localhost:8007
"@
Set-Content -Path "frontend\.env" -Value $frontendEnv

# ========== public/index.html ==========
$indexHtml = @"
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Aurora System - Sistema de Gestion Empresarial" />
    <title>Aurora System</title>
  </head>
  <body>
    <noscript>Necesitas habilitar JavaScript para ejecutar esta aplicacion.</noscript>
    <div id="root"></div>
  </body>
</html>
"@
Set-Content -Path "frontend\public\index.html" -Value $indexHtml

# ========== src/index.js ==========
$indexJs = @"
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
"@
Set-Content -Path "frontend\src\index.js" -Value $indexJs

# ========== src/App.js ==========
$appJs = @"
import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

function App() {
  return (
    <Router>
      <div className="App">
        <h1>Aurora System</h1>
        <p>Sistema de Gestion Empresarial</p>
      </div>
    </Router>
  );
}

export default App;
"@
Set-Content -Path "frontend\src\App.js" -Value $appJs

# ========== src/services/api.js ==========
$apiJs = @"
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_AUTH_SERVICE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `+'`Bearer ${token}`'+`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
"@
Set-Content -Path "frontend\src\services\api.js" -Value $apiJs

# ========== src/styles/global.css ==========
$globalCss = @"
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.App {
  text-align: center;
  padding: 50px;
}
"@
Set-Content -Path "frontend\src\styles\global.css" -Value $globalCss

Write-ColorOutput Green "  OK Archivos de frontend creados"

# ============================================
# CREAR DOCKER-COMPOSE.YML
# ============================================

Write-ColorOutput Cyan "`n[4/8] Creando docker-compose.yml..."

$dockerComposeContent = @"
version: '3.8'

services:
  # Base de datos PostgreSQL
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_MULTIPLE_DATABASES: auth_service_db,fast_food_service_db,hotel_service_db,pool_service_db,restaurant_service_db,reporting_service_db,notification_service_db
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./scripts/create-multiple-postgresql-databases.sh:/docker-entrypoint-initdb.d/create-multiple-postgresql-databases.sh
    ports:
      - "5432:5432"
    networks:
      - aurora-network

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - aurora-network

  # Servicio de Autenticacion
  auth-service:
    build: ./auth-service
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - ./auth-service:/app
    ports:
      - "8001:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/auth_service_db
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis
    networks:
      - aurora-network

  # Servicio de Comida Rapida
  fast-food-service:
    build: ./fast-food-service
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - ./fast-food-service:/app
    ports:
      - "8002:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/fast_food_service_db
      - AUTH_SERVICE_URL=http://auth-service:8000
    depends_on:
      - postgres
      - auth-service
    networks:
      - aurora-network

  # Servicio de Hotel
  hotel-service:
    build: ./hotel-service
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - ./hotel-service:/app
    ports:
      - "8003:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/hotel_service_db
      - AUTH_SERVICE_URL=http://auth-service:8000
    depends_on:
      - postgres
      - auth-service
    networks:
      - aurora-network

  # Servicio de Piscinas
  pool-service:
    build: ./pool-service
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - ./pool-service:/app
    ports:
      - "8004:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/pool_service_db
      - AUTH_SERVICE_URL=http://auth-service:8000
      - HOTEL_SERVICE_URL=http://hotel-service:8000
    depends_on:
      - postgres
      - auth-service
      - hotel-service
    networks:
      - aurora-network

  # Servicio de Restaurante
  restaurant-service:
    build: ./restaurant-service
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - ./restaurant-service:/app
    ports:
      - "8005:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/restaurant_service_db
      - AUTH_SERVICE_URL=http://auth-service:8000
      - HOTEL_SERVICE_URL=http://hotel-service:8000
    depends_on:
      - postgres
      - auth-service
      - hotel-service
    networks:
      - aurora-network

  # Servicio de Reportes
  reporting-service:
    build: ./reporting-service
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - ./reporting-service:/app
    ports:
      - "8006:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/reporting_service_db
      - FAST_FOOD_SERVICE_URL=http://fast-food-service:8000
      - HOTEL_SERVICE_URL=http://hotel-service:8000
      - POOL_SERVICE_URL=http://pool-service:8000
      - RESTAURANT_SERVICE_URL=http://restaurant-service:8000
    depends_on:
      - postgres
      - fast-food-service
      - hotel-service
      - pool-service
      - restaurant-service
    networks:
      - aurora-network

  # Servicio de Notificaciones
  notification-service:
    build: ./notification-service
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - ./notification-service:/app
    ports:
      - "8007:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/notification_service_db
      - REDIS_URL=redis://redis:6379/1
    depends_on:
      - postgres
      - redis
    networks:
      - aurora-network

  # Celery Worker (Notificaciones)
  celery-worker:
    build: ./notification-service
    command: celery -A notification_service worker -l info
    volumes:
      - ./notification-service:/app
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/notification_service_db
      - REDIS_URL=redis://redis:6379/1
    depends_on:
      - redis
      - notification-service
    networks:
      - aurora-network

  # Frontend React
  frontend:
    build: ./frontend
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_AUTH_SERVICE=http://localhost:8001
      - REACT_APP_FAST_FOOD_SERVICE=http://localhost:8002
      - REACT_APP_HOTEL_SERVICE=http://localhost:8003
      - REACT_APP_POOL_SERVICE=http://localhost:8004
      - REACT_APP_RESTAURANT_SERVICE=http://localhost:8005
      - REACT_APP_REPORTING_SERVICE=http://localhost:8006
      - REACT_APP_NOTIFICATION_SERVICE=http://localhost:8007
    networks:
      - aurora-network

networks:
  aurora-network:
    driver: bridge

volumes:
  postgres-data:
"@
Set-Content -Path "docker-compose.yml" -Value $dockerComposeContent

Write-ColorOutput Green "  OK docker-compose.yml creado"

# ============================================
# CREAR SCRIPTS
# ============================================

Write-ColorOutput Cyan "`n[5/8] Creando scripts de utilidad..."

# ========== create-multiple-postgresql-databases.sh ==========
$createDbScript = @'
#!/bin/bash
set -e
set -u

function create_database() {
    local database=$1
    echo "Creating database '$database'"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        CREATE DATABASE $database;
        GRANT ALL PRIVILEGES ON DATABASE $database TO $POSTGRES_USER;
EOSQL
}

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
    echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
    for db in $(echo $POSTGRES_MULTIPLE_DATABASES | tr ',' ' '); do
        create_database $db
    done
    echo "Multiple databases created"
fi
'@
Set-Content -Path "scripts\create-multiple-postgresql-databases.sh" -Value $createDbScript

# ========== migrate-all.sh ==========
$migrateScript = @'
#!/bin/bash

echo "Migrando auth-service..."
docker-compose exec auth-service python manage.py migrate

echo "Migrando fast-food-service..."
docker-compose exec fast-food-service python manage.py migrate

echo "Migrando hotel-service..."
docker-compose exec hotel-service python manage.py migrate

echo "Migrando pool-service..."
docker-compose exec pool-service python manage.py migrate

echo "Migrando restaurant-service..."
docker-compose exec restaurant-service python manage.py migrate

echo "Migrando reporting-service..."
docker-compose exec reporting-service python manage.py migrate

echo "Migrando notification-service..."
docker-compose exec notification-service python manage.py migrate

echo "Todas las migraciones completadas!"
'@
Set-Content -Path "scripts\migrate-all.sh" -Value $migrateScript

# ========== start-dev.sh ==========
$startDevScript = @'
#!/bin/bash

echo "Iniciando Aurora System en modo desarrollo..."
docker-compose up -d

echo "Esperando a que los servicios esten listos..."
sleep 10

echo "Ejecutando migraciones..."
./scripts/migrate-all.sh

echo "Aurora System esta listo!"
echo "Frontend: http://localhost:3000"
echo "Auth Service: http://localhost:8001"
echo "Fast Food Service: http://localhost:8002"
echo "Hotel Service: http://localhost:8003"
echo "Pool Service: http://localhost:8004"
echo "Restaurant Service: http://localhost:8005"
echo "Reporting Service: http://localhost:8006"
echo "Notification Service: http://localhost:8007"
'@
Set-Content -Path "scripts\start-dev.sh" -Value $startDevScript

Write-ColorOutput Green "  OK Scripts creados"

# ============================================
# CREAR ARCHIVOS ROOT
# ============================================

Write-ColorOutput Cyan "`n[6/8] Creando archivos raiz..."

# ========== .gitignore ==========
$gitignoreContent = @"
# Python
__pycache__/
*.py[cod]
*.so
.Python
env/
venv/
ENV/
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Django
*.log
local_settings.py
db.sqlite3
media/
staticfiles/

# Environment
.env
.env.local

# IDEs
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Node
node_modules/
npm-debug.log
yarn-error.log

# Docker
*.log

# Databases
*.sqlite3
*.db
"@
Set-Content -Path ".gitignore" -Value $gitignoreContent

# ========== README.md ==========
$readmeContent = @"
# Aurora System

Sistema de gestion empresarial integrado para comida rapida, hotel, piscinas y restaurante.

## Arquitectura

Este proyecto utiliza una arquitectura de microservicios con Docker:

- **auth-service**: Autenticacion y autorizacion centralizada
- **fast-food-service**: Gestion de comida rapida (POS, cocina, reportes)
- **hotel-service**: Gestion hotelera (reservas, habitaciones, check-in/out)
- **pool-service**: Gestion de piscinas (acceso, tarifas, lockers)
- **restaurant-service**: Gestion del restaurante Fortaleza (mesas, reservas, POS)
- **reporting-service**: Reportes consolidados de todos los negocios
- **notification-service**: Notificaciones (email, SMS, push)
- **frontend**: Aplicacion React

## Requisitos

- Docker
- Docker Compose

## Instalacion

1. Clonar el repositorio
2. Levantar los servicios:
``````bash
docker-compose up -d
``````

3. Ejecutar migraciones (Windows Git Bash o WSL):
``````bash
chmod +x scripts/migrate-all.sh
./scripts/migrate-all.sh
``````

## Acceso

- **Frontend**: http://localhost:3000
- **Auth Service**: http://localhost:8001
- **Fast Food Service**: http://localhost:8002
- **Hotel Service**: http://localhost:8003
- **Pool Service**: http://localhost:8004
- **Restaurant Service**: http://localhost:8005
- **Reporting Service**: http://localhost:8006
- **Notification Service**: http://localhost:8007

## Licencia

Propietario
"@
Set-Content -Path "README.md" -Value $readmeContent

# ========== .env ==========
$rootEnvContent = @"
# Configuracion global del proyecto Aurora System
COMPOSE_PROJECT_NAME=aurora-system

# Base de datos
DB_USER=postgres
DB_PASSWORD=postgres

# Seguridad
SECRET_KEY=change-this-in-production-use-python-secret-key-generator
"@
Set-Content -Path ".env" -Value $rootEnvContent

Write-ColorOutput Green "  OK Archivos raiz creados"

Write-ColorOutput Cyan "`n[7/8] Finalizando..."
Write-ColorOutput Green "  OK Proceso completado"

# ============================================
# RESUMEN FINAL
# ============================================

Write-ColorOutput Cyan "`n[8/8] Generando resumen..."

Write-Host ""
Write-ColorOutput Green "=========================================="
Write-ColorOutput Green "   OK ESTRUCTURA CREADA EXITOSAMENTE"
Write-ColorOutput Green "=========================================="
Write-Host ""

Write-ColorOutput Yellow "SERVICIOS CREADOS:"
Write-ColorOutput White "  > auth-service (3 apps)"
Write-ColorOutput White "  > fast-food-service (8 apps)"
Write-ColorOutput White "  > hotel-service (6 apps)"
Write-ColorOutput White "  > pool-service (5 apps)"
Write-ColorOutput White "  > restaurant-service (10 apps)"
Write-ColorOutput White "  > reporting-service (5 apps)"
Write-ColorOutput White "  > notification-service (3 apps)"
Write-ColorOutput White "  > frontend (React)"

Write-Host ""
Write-ColorOutput Yellow "PROXIMOS PASOS:"
Write-ColorOutput White "  1. docker-compose up -d"
Write-ColorOutput White "  2. Esperar a que todos los servicios inicien"
Write-ColorOutput White "  3. Ejecutar migraciones (usar Git Bash o WSL):"
Write-ColorOutput White "     chmod +x scripts/migrate-all.sh"
Write-ColorOutput White "     ./scripts/migrate-all.sh"
Write-ColorOutput White "  4. Acceder a http://localhost:3000"

Write-Host ""
Write-ColorOutput Yellow "PUERTOS:"
Write-ColorOutput White "  Frontend:     http://localhost:3000"
Write-ColorOutput White "  Auth:         http://localhost:8001"
Write-ColorOutput White "  Fast Food:    http://localhost:8002"
Write-ColorOutput White "  Hotel:        http://localhost:8003"
Write-ColorOutput White "  Pool:         http://localhost:8004"
Write-ColorOutput White "  Restaurant:   http://localhost:8005"
Write-ColorOutput White "  Reporting:    http://localhost:8006"
Write-ColorOutput White "  Notification: http://localhost:8007"
Write-ColorOutput White "  PostgreSQL:   localhost:5432"
Write-ColorOutput White "  Redis:        localhost:6379"

Write-Host ""
Write-ColorOutput Green "Proyecto Aurora System listo para desarrollo!"
Write-Host ""