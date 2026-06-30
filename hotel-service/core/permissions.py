from functools import wraps
from django.http import JsonResponse
from rest_framework.permissions import BasePermission
from django.utils import timezone
from decimal import Decimal
from apps.reports.models import Shift

class IsJWTAuthenticated(BasePermission):
    """
    DRF Permission class that verifies that the request is JWT authenticated
    AND strictly checks that the user has an open shift for any state-modifying
    requests (POST, PUT, PATCH, DELETE) on other apps.
    Automatically closes expired shifts.
    """
    def has_permission(self, request, view):
        # 1. Verify JWT Authentication first
        is_auth = hasattr(request, 'user_data') and request.user_data is not None
        if not is_auth:
            return False
            
        # 2. Allow read-only operations (GET, HEAD, OPTIONS)
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
            
        # 3. Exempt shifts and reports endpoints (reports app) to allow opening/closing shifts
        view_module = getattr(view, '__module__', '')
        if 'reports' in view_module:
            return True

        # 4. Exempt public views (e.g. public reservation page queries/submissions)
        if request.path.startswith('/api/reservations/public/'):
            return True

        # 5. Enforce strict active shift constraint for any write action
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return False
            
        shift = Shift.objects.filter(user_id=user_id, status='open').first()
        if not shift:
            return False
            
        # Auto-close if scheduled_end has passed
        if shift.scheduled_end and timezone.now() >= shift.scheduled_end:
            shift.close_shift(
                closing_cash=Decimal('0.00'),
                closing_notes='Cierre automático del sistema al finalizar el horario programado.'
            )
            return False
            
        return True

def require_jwt_auth(view_func):
    """
    Decorator for requiring JWT authentication
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not hasattr(request, 'user_data') or request.user_data is None:
            return JsonResponse({'error': 'Autenticación JWT requerida'}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper

def require_company_access(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not hasattr(request, 'user_data') or request.user_data is None:
            return JsonResponse({'error': 'Autenticación requerida'}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper
