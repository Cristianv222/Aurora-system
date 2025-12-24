import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url

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
    'rest_framework.authtoken',
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
    'whitenoise.middleware.WhiteNoiseMiddleware',  # ✅ Ya lo tienes
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

# ============================================
# 🔥 STATIC FILES - CONFIGURACIÓN COMPLETA
# ============================================
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# ✅ AGREGADO: Configuración de WhiteNoise
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# ✅ AGREGADO: Directorios adicionales de archivos estáticos (si tienes)
STATICFILES_DIRS = [
    # os.path.join(BASE_DIR, 'static'),  # Descomenta si tienes una carpeta /static
]

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ============================================
# 🔥 REST Framework
# ============================================
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'core.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    # ✅ AGREGADO: Mejores defaults para producción
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ] if not DEBUG else [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
}

# ============================================
# 🔥 CORS - MEJORADO
# ============================================
CORS_ALLOWED_ORIGINS = [
    "http://aurora.fronteratech.ec",
    "https://aurora.fronteratech.ec",
    "http://aurorabackend.fronteratech.ec",
    "https://aurorabackend.fronteratech.ec",
    "http://localhost:3000",
]

# ✅ AGREGADO: Configuración adicional de CORS
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# ✅ AGREGADO: Si necesitas CSRF token desde frontend
CSRF_TRUSTED_ORIGINS = [
    "http://aurora.fronteratech.ec",
    "https://aurora.fronteratech.ec",
    "http://aurorabackend.fronteratech.ec",
    "https://aurorabackend.fronteratech.ec",
]

# ============================================
# 🔥 CELERY
# ============================================
CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = os.getenv('REDIS_URL', 'redis://redis:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# ============================================
# 🔥 SERVICIOS
# ============================================
AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://auth-service:8000')
BASE_URL = os.getenv('BASE_URL', 'http://localhost:8002')
HARDWARE_SERVICE_TOKEN = os.getenv('HARDWARE_SERVICE_TOKEN', '4ab1eb1da612019e57b1803e83185649564f12ae')

# ============================================
# 🔥 LOGGING - MEJORADO
# ============================================
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'django.log'),
            'formatter': 'verbose',
        } if not DEBUG else {
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
# 🔥 CONFIGURACIÓN DE EMPRESA E IMPRESIÓN
# ============================================
COMPANY_CONFIG = {
    'name': os.getenv('COMPANY_NAME', 'Mi Restaurante'),
    'address': os.getenv('COMPANY_ADDRESS', 'Dirección no configurada'),
    'phone': os.getenv('COMPANY_PHONE', '000-0000'),
    'email': os.getenv('COMPANY_EMAIL', ''),
    'website': os.getenv('COMPANY_WEBSITE', ''),
    'tax_id': os.getenv('COMPANY_TAX_ID', ''),
    'logo': os.getenv('COMPANY_LOGO', ''),
}

PRINTING_CONFIG = {
    'receipt_header': os.getenv('RECEIPT_HEADER', ''),
    'receipt_footer': os.getenv('RECEIPT_FOOTER', '¡Gracias por su compra!'),
    'auto_print_receipt': os.getenv('AUTO_PRINT_RECEIPT', 'True') == 'True',
    'auto_print_kitchen': os.getenv('AUTO_PRINT_KITCHEN', 'True') == 'True',
    'auto_open_drawer_on_payment': os.getenv('AUTO_OPEN_DRAWER_ON_PAYMENT', 'True') == 'True',
    'require_confirmation_to_open_drawer': os.getenv('REQUIRE_CONFIRMATION_TO_OPEN_DRAWER', 'False') == 'True',
}

# ============================================
# 🔥 CACHE
# ============================================
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': os.getenv('REDIS_URL', 'redis://redis:6379/1'),
    } if not DEBUG else {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}

# ============================================
# 🔥 SEGURIDAD PARA PRODUCCIÓN
# ============================================
# ✅ AGREGADO: Configuración para funcionar detrás de proxy (Nginx)
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# ✅ AGREGADO: Headers de seguridad (solo en producción)
if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    # SECURE_SSL_REDIRECT = True  # Descomenta cuando tengas SSL
    # SESSION_COOKIE_SECURE = True  # Descomenta cuando tengas SSL
    # CSRF_COOKIE_SECURE = True  # Descomenta cuando tengas SSL
    SECURE_HSTS_SECONDS = 31536000  # 1 año
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# ✅ AGREGADO: Crear directorio de logs si no existe
if not DEBUG:
    LOGS_DIR = os.path.join(BASE_DIR, 'logs')
    os.makedirs(LOGS_DIR, exist_ok=True)