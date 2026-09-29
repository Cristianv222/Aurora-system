# Reglas de Control y Optimización de RAM - Aurora System

Para evitar picos de uso de memoria y fugas en producción, todos los desarrolladores y servicios deben cumplir estrictamente las siguientes 4 reglas fundamentales:

---

### 1. Paginación Acotada en DRF (`CappedPageNumberPagination`)
- **Regla**: Ningún endpoint de listado (`ListAPIView` / `ViewSet.list`) puede devolver respuestas sin paginar o con páginas masivas.
- **Configuración estándar**:
  - `PAGE_SIZE = 20` (por defecto en `settings.py`).
  - Usar la clase `core.pagination.CappedPageNumberPagination` en `DEFAULT_PAGINATION_CLASS`.
  - Límite máximo estricto: `max_page_size = 100` (incluso si la petición envía `?page_size=9999`, DRF lo limita a 100).
- **Optimización de consultas**: Usar siempre `.select_related()` y `.prefetch_related()` en querysets para evitar N+1 consultas y la instanciación redundante de objetos en memoria.

---

### 2. Ejecución con Gunicorn + Workers ASGI y Reciclado Automático
- **Regla**: Ningún microservicio en producción debe ejecutarse como un proceso único no reciclable (ej. `daphne` directo).
- **Configuración obligatoria**:
  - Servidor: `gunicorn` utilizando la clase de worker `uvicorn.workers.UvicornWorker` para soporte ASGI + WebSockets (Django Channels).
  - Parámetros de reciclo: `--max-requests 500 --max-requests-jitter 50`.
  - **Efecto**: Cada worker de Python se reinicia automáticamente tras atender 500 peticiones, liberando al kernel del sistema operativo el 100% de la memoria asignada a ese proceso.

---

### 3. Asignador de Memoria de Alto Rendimiento (`jemalloc` + `malloc_trim`)
- **Regla**: Todos los contenedores Docker de servicios Python deben usar `jemalloc` en lugar del asignador glibc por defecto, y ejecutar un middleware de liberación tras cada request.
- **Variables de Entorno en Dockerfile / docker-compose**:
  - `LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2`
  - `MALLOC_ARENA_MAX=2`
  - `MALLOC_TRIM_THRESHOLD_=131072`
- **Middleware**: Incluir `'core.middleware.MemoryTrimMiddleware'` en el encabezado de `MIDDLEWARE` en `settings.py` para forzar `malloc_trim(0)` tras cada petición HTTP.

---

### 4. Límites Rígidos de Memoria en Docker (`mem_limit`)
- **Regla**: Todos los servicios definidos en `docker-compose.yml` deben declarar límites rígidos de memoria RAM.
- **Límites asignados**:
  - Microservicios de negocio (`restaurant`, `hotel`, `fast-food`): `mem_limit: 512m` o `1g`.
  - Microservicios auxiliares (`auth`, `pool`, `reporting`, `notification`): `mem_limit: 512m`.
  - Nginx: `mem_limit: 128m`.
  - Redis: `mem_limit: 512m`.
