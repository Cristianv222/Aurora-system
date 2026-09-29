import ctypes
import logging

logger = logging.getLogger(__name__)

try:
    _libc = ctypes.CDLL('libc.so.6')
    _has_malloc_trim = hasattr(_libc, 'malloc_trim')
except Exception:
    _libc = None
    _has_malloc_trim = False


class MemoryTrimMiddleware:
    """
    Middleware para liberar memoria RAM al SO (Kernel Linux).
    Ejecuta malloc_trim(0) tras procesar cada petición HTTP de Django,
    forzando a glibc a retornar páginas de memoria liberadas de vuelta al SO.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if _has_malloc_trim:
            try:
                _libc.malloc_trim(0)
            except Exception:
                pass
        return response
