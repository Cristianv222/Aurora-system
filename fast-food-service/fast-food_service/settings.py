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
    'rest_framework.authtoken',  # ← NUEVO: Para tokens del agente
    'corsheaders',
]

# Apps del servicio
INSTALLED_APPS.append('apps.menu')
INSTALLED_APPS.append('apps.pos')
INSTALLED_APPS.append('apps.orders')
INSTALLED_APPS.append('apps.payments')
INSTALLED_APPS.append('apps.kitchen')
INSTALLED_APPS.append('apps.printer')
INSTALLED_APPS.append('apps.customers')
INSTALLED_APPS.append('apps.reports')


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

ROOT_URLCONF = 'fast-food_service.urls'

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

WSGI_APPLICATION = 'fast-food_service.wsgi.application'

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

# ============================================
# 🔥 REST Framework - MODIFICADO
# ============================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',  # ← NUEVO: Para agente Windows
        'core.authentication.JWTAuthentication',              # Para frontend React
        'rest_framework.authentication.SessionAuthentication', # Para admin Django
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

# Servicios
AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://auth-service:8000')

# Middleware de autenticación JWT
#MIDDLEWARE.insert(
    ##MIDDLEWARE.index('django.contrib.auth.middleware.AuthenticationMiddleware') + 1,
    #'core.middleware.JWTAuthenticationMiddleware'
#)

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps.printer': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

# ============================================
#  CONFIGURACIÓN DE EMPRESA E IMPRESIÓN
# ============================================

# Configuración de la Empresa
COMPANY_CONFIG = {
    'name': os.getenv('COMPANY_NAME', 'Mi Restaurante'),
    'address': os.getenv('COMPANY_ADDRESS', 'Dirección no configurada'),
    'phone': os.getenv('COMPANY_PHONE', '000-0000'),
    'email': os.getenv('COMPANY_EMAIL', ''),
    'website': os.getenv('COMPANY_WEBSITE', ''),
    'tax_id': os.getenv('COMPANY_TAX_ID', ''),
    'logo': os.getenv('COMPANY_LOGO', ''),  # Path relativo a MEDIA_ROOT
}

# Configuración de Impresión
PRINTING_CONFIG = {
    'receipt_header': os.getenv('RECEIPT_HEADER', ''),
    'receipt_footer': os.getenv('RECEIPT_FOOTER', '¡Gracias por su compra!'),
    'auto_print_receipt': os.getenv('AUTO_PRINT_RECEIPT', 'True') == 'True',
    'auto_print_kitchen': os.getenv('AUTO_PRINT_KITCHEN', 'True') == 'True',
    'auto_open_drawer_on_payment': os.getenv('AUTO_OPEN_DRAWER_ON_PAYMENT', 'True') == 'True',
    'require_confirmation_to_open_drawer': os.getenv('REQUIRE_CONFIRMATION_TO_OPEN_DRAWER', 'False') == 'True',
}

# Cache (para rate limiting de retry)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}