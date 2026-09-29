from rest_framework.pagination import PageNumberPagination

class CappedPageNumberPagination(PageNumberPagination):
    """
    Paginador global para prevenir sobrecarga de memoria RAM.
    - Paginación por defecto: 20 elementos por página.
    - Soporta parámetro de consulta ?page_size=N.
    - Límite máximo estricto: 100 elementos por página.
    """
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
