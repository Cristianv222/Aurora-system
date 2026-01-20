from rest_framework import viewsets, generics, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Sum, Avg, Q
from django.utils import timezone
from datetime import timedelta
import logging

from .models import (
    Customer, CustomerAddress, CustomerNote, 
    CustomerLoyalty, CustomerLoyaltyHistory, CustomerDevice
)
from .serializers import (
    CustomerSerializer, CustomerCreateSerializer, CustomerUpdateSerializer,
    CustomerLoginSerializer, CustomerAddressSerializer, CustomerNoteSerializer,
    CustomerLoyaltySerializer, CustomerLoyaltyHistorySerializer, 
    CustomerDeviceSerializer, CustomerStatsSerializer, CustomerSearchSerializer
)

logger = logging.getLogger(__name__)

# ========== ENDPOINTS PÚBLICOS ==========

@api_view(['POST'])
@permission_classes([AllowAny])
def register_customer(request):
    """
    Endpoint público para registro de nuevos clientes
    POST /api/customers/register/
    """
    serializer = CustomerCreateSerializer(data=request.data)
    if serializer.is_valid():
        customer = serializer.save()
        
        # Generar token JWT
        refresh = RefreshToken.for_user(customer)
        
        return Response({
            'status': 'success',
            'message': 'Cliente registrado exitosamente',
            'data': {
                'customer': CustomerSerializer(customer).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }
        }, status=status.HTTP_201_CREATED)
    
    return Response({
        'status': 'error',
        'message': 'Error en el registro',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_customer(request):
    """
    Endpoint público para login de clientes
    POST /api/customers/login/
    """
    serializer = CustomerLoginSerializer(data=request.data)
    if serializer.is_valid():
        customer = serializer.validated_data['customer']
        
        # Actualizar última IP de login
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        
        customer.last_login_ip = ip
        customer.save(update_fields=['last_login_ip'])
        
        # Generar token JWT
        refresh = RefreshToken.for_user(customer)
        
        return Response({
            'status': 'success',
            'message': 'Login exitoso',
            'data': {
                'customer': CustomerSerializer(customer).data,
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            }
        })
    
    return Response({
        'status': 'error',
        'message': 'Credenciales inválidas',
        'errors': serializer.errors
    }, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_email(request):
    """
    Endpoint público para verificar email
    POST /api/customers/verify-email/
    """
    email = request.data.get('email')
    
    if not email:
        return Response({
            'status': 'error',
            'message': 'Email es requerido'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    exists = Customer.objects.filter(email=email).exists()
    
    return Response({
        'status': 'success',
        'data': {
            'email': email,
            'exists': exists,
            'available': not exists
        }
    })


# ========== ENDPOINTS PROTEGIDOS (AUTENTICADOS) ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_customer_profile(request):
    """
    Obtener perfil del cliente autenticado
    GET /api/customers/me/
    """
    customer = request.user
    serializer = CustomerSerializer(customer)
    
    return Response({
        'status': 'success',
        'data': serializer.data
    })


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_customer_profile(request):
    """
    Actualizar perfil del cliente autenticado
    PUT/PATCH /api/customers/me/
    """
    customer = request.user
    
    if request.method == 'PUT':
        serializer = CustomerUpdateSerializer(customer, data=request.data, partial=False)
    else:  # PATCH
        serializer = CustomerUpdateSerializer(customer, data=request.data, partial=True)
    
    if serializer.is_valid():
        serializer.save()
        
        # Retornar datos completos actualizados
        customer_serializer = CustomerSerializer(customer)
        return Response({
            'status': 'success',
            'message': 'Perfil actualizado exitosamente',
            'data': customer_serializer.data
        })
    
    return Response({
        'status': 'error',
        'message': 'Error al actualizar perfil',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_customer_stats(request):
    """
    Obtener estadísticas personales del cliente
    GET /api/customers/me/stats/
    """
    customer = request.user
    
    stats = {
        'total_orders': customer.total_orders,
        'total_spent': float(customer.total_spent),
        'average_order_value': float(customer.average_order_value),
        'customer_since_days': customer.customer_since,
        'days_since_last_order': customer.days_since_last_order,
    }
    
    # Agregar información de lealtad si existe
    try:
        loyalty = customer.loyalty
        stats.update({
            'loyalty_points': loyalty.points_balance,
            'loyalty_tier': loyalty.current_tier,
            'loyalty_tier_name': loyalty.get_current_tier_display(),
            'next_tier_progress': float(loyalty.next_tier_progress),
            'discount_rate': float(loyalty.discount_rate),
            'free_delivery': loyalty.free_delivery,
            'priority_service': loyalty.priority_service,
        })
    except CustomerLoyalty.DoesNotExist:
        stats.update({
            'loyalty_points': 0,
            'loyalty_tier': 'bronze',
            'loyalty_tier_name': 'Bronce',
            'next_tier_progress': 0,
            'discount_rate': 0,
            'free_delivery': False,
            'priority_service': False,
        })
    
    return Response({
        'status': 'success',
        'data': stats
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_customer_loyalty(request):
    """
    Obtener información de lealtad del cliente
    GET /api/customers/me/loyalty/
    """
    customer = request.user
    
    try:
        loyalty = customer.loyalty
        serializer = CustomerLoyaltySerializer(loyalty)
        return Response({
            'status': 'success',
            'data': serializer.data
        })
    except CustomerLoyalty.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Programa de lealtad no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_loyalty_history(request):
    """
    Obtener historial de puntos de lealtad
    GET /api/customers/me/loyalty/history/
    """
    customer = request.user
    
    try:
        loyalty = customer.loyalty
        history = loyalty.history.all().order_by('-created_at')[:50]  # Últimos 50 registros
        
        serializer = CustomerLoyaltyHistorySerializer(history, many=True)
        
        return Response({
            'status': 'success',
            'data': {
                'total_records': history.count(),
                'history': serializer.data
            }
        })
    except CustomerLoyalty.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Programa de lealtad no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)


# ========== ENDPOINTS DE DIRECCIONES ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_customer_addresses(request):
    """
    Obtener todas las direcciones del cliente
    GET /api/customers/me/addresses/
    """
    customer = request.user
    addresses = customer.addresses.all()
    
    serializer = CustomerAddressSerializer(addresses, many=True)
    
    return Response({
        'status': 'success',
        'data': {
            'total_addresses': addresses.count(),
            'addresses': serializer.data
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_customer_address(request):
    """
    Crear una nueva dirección para el cliente
    POST /api/customers/me/addresses/
    """
    customer = request.user
    
    serializer = CustomerAddressSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        # Asignar automáticamente el cliente
        serializer.save(customer=customer)
        
        return Response({
            'status': 'success',
            'message': 'Dirección creada exitosamente',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
    
    return Response({
        'status': 'error',
        'message': 'Error al crear dirección',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def customer_address_detail(request, address_id):
    """
    Operaciones CRUD en una dirección específica
    GET /api/customers/me/addresses/{id}/
    PUT /api/customers/me/addresses/{id}/
    PATCH /api/customers/me/addresses/{id}/
    DELETE /api/customers/me/addresses/{id}/
    """
    try:
        address = CustomerAddress.objects.get(id=address_id, customer=request.user)
    except CustomerAddress.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Dirección no encontrada'
        }, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = CustomerAddressSerializer(address)
        return Response({
            'status': 'success',
            'data': serializer.data
        })
    
    elif request.method == 'DELETE':
        address.delete()
        return Response({
            'status': 'success',
            'message': 'Dirección eliminada exitosamente'
        }, status=status.HTTP_204_NO_CONTENT)
    
    else:  # PUT o PATCH
        partial = request.method == 'PATCH'
        serializer = CustomerAddressSerializer(address, data=request.data, 
                                             partial=partial, context={'request': request})
        
        if serializer.is_valid():
            serializer.save()
            return Response({
                'status': 'success',
                'message': 'Dirección actualizada exitosamente',
                'data': serializer.data
            })
        
        return Response({
            'status': 'error',
            'message': 'Error al actualizar dirección',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_default_address(request, address_type=None):
    """
    Obtener dirección por defecto del cliente
    GET /api/customers/me/addresses/default/
    GET /api/customers/me/addresses/default/{type}/
    """
    customer = request.user
    
    if address_type:
        addresses = customer.addresses.filter(
            address_type=address_type, 
            is_default=True
        )
    else:
        addresses = customer.addresses.filter(is_default=True)
    
    if addresses.exists():
        serializer = CustomerAddressSerializer(addresses.first())
        return Response({
            'status': 'success',
            'data': serializer.data
        })
    
    return Response({
        'status': 'error',
        'message': 'No se encontró dirección por defecto'
    }, status=status.HTTP_404_NOT_FOUND)


# ========== ENDPOINTS DE DISPOSITIVOS ==========

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_device(request):
    """
    Registrar dispositivo para notificaciones push
    POST /api/customers/me/devices/
    """
    customer = request.user
    
    serializer = CustomerDeviceSerializer(data=request.data)
    if serializer.is_valid():
        # Verificar si el dispositivo ya existe
        device_token = serializer.validated_data.get('device_token')
        existing_device = CustomerDevice.objects.filter(
            customer=customer,
            device_token=device_token
        ).first()
        
        if existing_device:
            # Actualizar dispositivo existente
            serializer = CustomerDeviceSerializer(existing_device, data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response({
                    'status': 'success',
                    'message': 'Dispositivo actualizado',
                    'data': serializer.data
                })
        else:
            # Crear nuevo dispositivo
            serializer.save(customer=customer)
            return Response({
                'status': 'success',
                'message': 'Dispositivo registrado exitosamente',
                'data': serializer.data
            }, status=status.HTTP_201_CREATED)
    
    return Response({
        'status': 'error',
        'message': 'Error al registrar dispositivo',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def unregister_device(request, device_token):
    """
    Desregistrar dispositivo
    DELETE /api/customers/me/devices/{token}/
    """
    customer = request.user
    
    try:
        device = CustomerDevice.objects.get(
            customer=customer,
            device_token=device_token
        )
        device.delete()
        
        return Response({
            'status': 'success',
            'message': 'Dispositivo desregistrado exitosamente'
        }, status=status.HTTP_204_NO_CONTENT)
    
    except CustomerDevice.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Dispositivo no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)


# ========== ENDPOINTS DE ADMINISTRADOR ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_customer_list(request):
    """
    Listar todos los clientes (solo admin)
    GET /api/customers/admin/list/
    """
    # Parámetros de filtrado
    customer_type = request.query_params.get('type')
    is_active = request.query_params.get('active')
    is_vip = request.query_params.get('vip')
    search = request.query_params.get('search')
    city = request.query_params.get('city')
    
    queryset = Customer.objects.all()
    
    # Aplicar filtros
    if customer_type:
        queryset = queryset.filter(customer_type=customer_type)
    
    if is_active is not None:
        queryset = queryset.filter(is_active=is_active.lower() == 'true')
    
    if is_vip is not None:
        queryset = queryset.filter(is_vip=is_vip.lower() == 'true')
    
    if city:
        queryset = queryset.filter(city__icontains=city)
    
    if search:
        queryset = queryset.filter(
            Q(email__icontains=search) |
            Q(phone__icontains=search) |
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search)
        )
    
    # Paginación
    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 20))
    start = (page - 1) * page_size
    end = start + page_size
    
    total = queryset.count()
    customers = queryset.order_by('-created_at')[start:end]
    
    serializer = CustomerSerializer(customers, many=True)
    
    return Response({
        'status': 'success',
        'data': {
            'customers': serializer.data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': (total + page_size - 1) // page_size
            }
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_customer_detail(request, customer_id):
    """
    Ver detalle de un cliente (solo admin)
    GET /api/customers/admin/{id}/
    """
    try:
        customer = Customer.objects.get(id=customer_id)
    except Customer.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Cliente no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)
    
    serializer = CustomerSerializer(customer)
    
    # Obtener información adicional
    addresses = CustomerAddressSerializer(customer.addresses.all(), many=True).data
    notes = CustomerNoteSerializer(customer.notes.all(), many=True).data
    
    try:
        loyalty = CustomerLoyaltySerializer(customer.loyalty).data
    except CustomerLoyalty.DoesNotExist:
        loyalty = None
    
    data = serializer.data
    data['addresses'] = addresses
    data['notes'] = notes
    data['loyalty'] = loyalty
    
    return Response({
        'status': 'success',
        'data': data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_create_customer_note(request, customer_id):
    """
    Crear nota para un cliente (solo admin)
    POST /api/customers/admin/{id}/notes/
    """
    try:
        customer = Customer.objects.get(id=customer_id)
    except Customer.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Cliente no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)
    
    serializer = CustomerNoteSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(customer=customer, created_by=request.user)
        
        return Response({
            'status': 'success',
            'message': 'Nota creada exitosamente',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
    
    return Response({
        'status': 'error',
        'message': 'Error al crear nota',
        'errors': serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_add_loyalty_points(request, customer_id):
    """
    Añadir puntos de lealtad a un cliente (solo admin)
    POST /api/customers/admin/{id}/loyalty/add-points/
    """
    try:
        customer = Customer.objects.get(id=customer_id)
    except Customer.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Cliente no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)
    
    points = request.data.get('points')
    reason = request.data.get('reason', 'Ajuste administrativo')
    
    if not points or not isinstance(points, (int, float)) or points <= 0:
        return Response({
            'status': 'error',
            'message': 'Puntos inválidos. Debe ser un número positivo'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        loyalty = customer.loyalty
        loyalty.add_points(int(points), reason)
        
        return Response({
            'status': 'success',
            'message': f'{points} puntos añadidos exitosamente',
            'data': {
                'customer_id': str(customer.id),
                'customer_name': customer.get_full_name(),
                'points_added': points,
                'new_balance': loyalty.points_balance,
                'new_tier': loyalty.current_tier,
                'reason': reason
            }
        })
    
    except CustomerLoyalty.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'Cliente no tiene programa de lealtad'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_customer_stats(request):
    """
    Estadísticas generales de clientes (solo admin)
    GET /api/customers/admin/stats/
    """
    today = timezone.now().date()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    # Estadísticas básicas
    stats = {
        'total_customers': Customer.objects.count(),
        'active_customers': Customer.objects.filter(is_active=True).count(),
        'inactive_customers': Customer.objects.filter(is_active=False).count(),
        'vip_customers': Customer.objects.filter(is_vip=True).count(),
        
        # Nuevos clientes
        'new_today': Customer.objects.filter(created_at__date=today).count(),
        'new_this_week': Customer.objects.filter(created_at__date__gte=week_ago).count(),
        'new_this_month': Customer.objects.filter(created_at__date__gte=month_ago).count(),
        
        # Métricas financieras
        'total_revenue': float(Customer.objects.aggregate(total=Sum('total_spent'))['total'] or 0),
        'avg_order_value': float(Customer.objects.aggregate(avg=Avg('average_order_value'))['avg'] or 0),
        'avg_orders_per_customer': Customer.objects.aggregate(avg=Avg('total_orders'))['avg'] or 0,
    }
    
    # Distribución por tipo de cliente
    type_distribution = Customer.objects.values('customer_type').annotate(
        count=Count('id'),
        total_spent=Sum('total_spent'),
        avg_orders=Avg('total_orders')
    ).order_by('-count')
    
    stats['type_distribution'] = list(type_distribution)
    
    # Clientes por ciudad (top 10)
    top_cities = Customer.objects.exclude(city='').values('city').annotate(
        count=Count('id')
    ).order_by('-count')[:10]
    
    stats['top_cities'] = list(top_cities)
    
    # Clientes top por gasto (top 10)
    top_spenders = Customer.objects.order_by('-total_spent')[:10].values(
        'id', 'email', 'first_name', 'last_name', 'total_spent', 'total_orders'
    )
    
    stats['top_spenders'] = list(top_spenders)
    
    return Response({
        'status': 'success',
        'data': stats
    })

# apps/customers/views.py (SOLO la función admin_search_customers)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_search_customers(request):
    """
    Búsqueda avanzada de clientes (solo admin)
    POST /api/customers/admin/search/
    """
    serializer = CustomerSearchSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({
            'status': 'error',
            'message': 'Búsqueda inválida',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    query = serializer.validated_data['query']
    
    # Búsqueda en múltiples campos (AÑADIDO: Q(cedula__icontains=query))
    customers = Customer.objects.filter(
        Q(email__icontains=query) |
        Q(phone__icontains=query) |
        Q(first_name__icontains=query) |
        Q(last_name__icontains=query) |
        Q(cedula__icontains=query) | # <--- CAMBIO CRÍTICO
        Q(address__icontains=query) |
        Q(city__icontains=query)
    ).order_by('-created_at')[:50] 
    
    serializer = CustomerSerializer(customers, many=True)
    
    return Response({
        'status': 'success',
        'data': {
            'query': query,
            'total_results': customers.count(),
            'customers': serializer.data
        }
    })
# ========== ENDPOINTS DE HEALTH CHECK ==========

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check del servicio de clientes
    GET /api/customers/health/
    """
    # Verificar conexión a base de datos
    try:
        customer_count = Customer.objects.count()
        db_status = 'healthy'
    except Exception as e:
        customer_count = 0
        db_status = f'error: {str(e)}'
    
    return Response({
        'status': 'ok',
        'service': 'fast-food-customers',
        'timestamp': timezone.now().isoformat(),
        'database': {
            'status': db_status,
            'customers_count': customer_count
        },
        'endpoints': {
            'register': '/api/customers/register/',
            'login': '/api/customers/login/',
            'profile': '/api/customers/me/',
            'health': '/api/customers/health/'
        }
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def service_info(request):
    """
    Información del servicio
    GET /api/customers/info/
    """
    return Response({
        'service': 'Fast Food Customer Service',
        'version': '1.0.0',
        'description': 'Microservicio para gestión de clientes y lealtad',
        'status': 'running'
    })