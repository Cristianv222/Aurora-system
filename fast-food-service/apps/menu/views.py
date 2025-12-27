from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Prefetch

from core.permissions import require_authentication, require_staff
from .models import Category, Product, Size, Extra, Combo, ComboProduct
from .serializers import (
    CategorySerializer,
    ProductListSerializer,
    ProductDetailSerializer,
    ProductCreateUpdateSerializer,
    SizeSerializer,
    SizeCreateUpdateSerializer,
    ExtraSerializer,
    ExtraCreateUpdateSerializer,
    ComboListSerializer,
    ComboDetailSerializer,
    ComboCreateUpdateSerializer,
)


# ============================================================================
# VIEWS DE PRUEBA Y HEALTH CHECK
# ============================================================================

@api_view(['GET'])
@require_authentication
def test_auth_view(request):
    """
    Vista de prueba para verificar que la autenticación JWT funciona
    GET /api/menu/test-auth/
    """
    return Response({
        'message': 'Autenticación exitosa',
        'user_id': request.user_id,
        'username': request.username,
        'email': request.user_email,
        'role': request.user_role,
        'is_staff': request.is_staff,
        'is_superuser': request.is_superuser
    })


@api_view(['GET'])
@require_staff
def test_staff_view(request):
    """
    Vista de prueba que requiere permisos de staff
    GET /api/menu/test-staff/
    """
    return Response({
        'message': 'Acceso de staff exitoso',
        'user': request.username
    })


@api_view(['GET'])
def health_check(request):
    """
    Health check endpoint (sin autenticación)
    GET /api/menu/health/
    """
    return Response({
        'status': 'ok',
        'service': 'fast-food-service'
    })


# ============================================================================
# VIEWSETS DEL MENÚ
# ============================================================================

class CategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet para categorías del menú
    
    list: Lista todas las categorías activas
    retrieve: Obtiene detalle de una categoría
    create: Crea una nueva categoría
    update: Actualiza una categoría
    partial_update: Actualiza parcialmente una categoría
    destroy: Elimina una categoría
    """
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['display_order', 'name', 'created_at']
    ordering = ['display_order', 'name']
    lookup_field = 'pk'  # ← CAMBIADO de 'slug' a 'pk'
    
    def get_queryset(self):
        """Optimiza queries con prefetch"""
        queryset = super().get_queryset()
        return queryset
    
    @action(detail=True, methods=['get'])
    def products(self, request, pk=None):  # ← CAMBIADO slug a pk
        """Obtiene todos los productos de una categoría"""
        category = self.get_object()
        products = category.products.filter(
            is_active=True, 
            is_available=True
        ).select_related('category').prefetch_related('sizes', 'extras')
        
        serializer = ProductListSerializer(products, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Obtiene categorías destacadas con productos destacados"""
        categories = self.get_queryset().filter(
            is_active=True,
            products__is_featured=True
        ).distinct()
        
        serializer = self.get_serializer(categories, many=True)
        return Response(serializer.data)


class ProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet para productos del menú
    
    list: Lista todos los productos
    retrieve: Obtiene detalle de un producto
    create: Crea un nuevo producto
    update: Actualiza un producto
    partial_update: Actualiza parcialmente un producto
    destroy: Elimina un producto
    """
    queryset = Product.objects.all()
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['category', 'is_active', 'is_available', 'is_featured', 'is_new']
    search_fields = ['name', 'description', 'ingredients']
    ordering_fields = ['display_order', 'name', 'price', 'created_at']
    ordering = ['category__display_order', 'display_order', 'name']
    lookup_field = 'pk'  # ← CAMBIADO de 'slug' a 'pk'
    
    def get_queryset(self):
        """Optimiza queries y filtra según contexto"""
        queryset = super().get_queryset().select_related('category').prefetch_related(
            'sizes',
            'extras'
        )
        
        # Filtros adicionales por query params
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        
        if min_price:
            queryset = queryset.filter(price__gte=min_price)
        if max_price:
            queryset = queryset.filter(price__lte=max_price)
        
        return queryset
    
    def get_serializer_class(self):
        """Retorna el serializer apropiado según la acción"""
        if self.action == 'list':
            return ProductListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ProductCreateUpdateSerializer
        return ProductDetailSerializer
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Obtiene productos destacados"""
        products = self.get_queryset().filter(
            is_featured=True,
            is_active=True,
            is_available=True
        )[:10]
        
        serializer = ProductListSerializer(products, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def new(self, request):
        """Obtiene productos nuevos"""
        products = self.get_queryset().filter(
            is_new=True,
            is_active=True,
            is_available=True
        ).order_by('-created_at')[:10]
        
        serializer = ProductListSerializer(products, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def sizes(self, request, pk=None):  # ← CAMBIADO slug a pk
        """Obtiene tamaños disponibles del producto"""
        product = self.get_object()
        sizes = product.sizes.filter(is_active=True).order_by('display_order')
        
        serializer = SizeSerializer(sizes, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def extras(self, request, pk=None):  # ← CAMBIADO slug a pk
        """Obtiene extras disponibles del producto"""
        product = self.get_object()
        extras = product.extras.filter(is_active=True).order_by('display_order')
        
        serializer = ExtraSerializer(extras, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Búsqueda avanzada de productos"""
        query = request.query_params.get('q', '')
        
        if not query:
            return Response(
                {'error': 'El parámetro "q" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        products = self.get_queryset().filter(
            Q(name__icontains=query) |
            Q(description__icontains=query) |
            Q(ingredients__icontains=query) |
            Q(category__name__icontains=query)
        ).distinct()
        
        serializer = ProductListSerializer(products, many=True)
        return Response(serializer.data)


class SizeViewSet(viewsets.ModelViewSet):
    """
    ViewSet para tamaños de productos
    
    list: Lista todos los tamaños
    retrieve: Obtiene detalle de un tamaño
    create: Crea un nuevo tamaño
    update: Actualiza un tamaño
    partial_update: Actualiza parcialmente un tamaño
    destroy: Elimina un tamaño
    """
    queryset = Size.objects.all()
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['product', 'is_active', 'is_default']
    ordering_fields = ['display_order', 'price_adjustment']
    ordering = ['product', 'display_order']
    
    def get_queryset(self):
        """Optimiza queries"""
        return super().get_queryset().select_related('product')
    
    def get_serializer_class(self):
        """Retorna el serializer apropiado"""
        if self.action in ['create', 'update', 'partial_update']:
            return SizeCreateUpdateSerializer
        return SizeSerializer
    
    @action(detail=False, methods=['get'])
    def by_product(self, request):
        """Obtiene tamaños de un producto específico"""
        product_id = request.query_params.get('product_id')
        
        if not product_id:
            return Response(
                {'error': 'El parámetro "product_id" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        sizes = self.get_queryset().filter(
            product_id=product_id,
            is_active=True
        )
        
        serializer = SizeSerializer(sizes, many=True)
        return Response(serializer.data)


class ExtraViewSet(viewsets.ModelViewSet):
    """
    ViewSet para extras/adicionales
    
    list: Lista todos los extras
    retrieve: Obtiene detalle de un extra
    create: Crea un nuevo extra
    update: Actualiza un extra
    partial_update: Actualiza parcialmente un extra
    destroy: Elimina un extra
    """
    queryset = Extra.objects.all()
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['display_order', 'name', 'price']
    ordering = ['display_order', 'name']
    
    def get_queryset(self):
        """Optimiza queries"""
        return super().get_queryset().prefetch_related('products')
    
    def get_serializer_class(self):
        """Retorna el serializer apropiado"""
        if self.action in ['create', 'update', 'partial_update']:
            return ExtraCreateUpdateSerializer
        return ExtraSerializer
    
    @action(detail=False, methods=['get'])
    def by_product(self, request):
        """Obtiene extras disponibles para un producto específico"""
        product_id = request.query_params.get('product_id')
        
        if not product_id:
            return Response(
                {'error': 'El parámetro "product_id" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        extras = self.get_queryset().filter(
            products__id=product_id,
            is_active=True
        )
        
        serializer = ExtraSerializer(extras, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_products(self, request, pk=None):
        """Asocia productos a un extra"""
        extra = self.get_object()
        product_ids = request.data.get('product_ids', [])
        
        if not product_ids:
            return Response(
                {'error': 'Se requiere una lista de product_ids'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        extra.products.add(*product_ids)
        
        serializer = self.get_serializer(extra)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def remove_products(self, request, pk=None):
        """Desasocia productos de un extra"""
        extra = self.get_object()
        product_ids = request.data.get('product_ids', [])
        
        if not product_ids:
            return Response(
                {'error': 'Se requiere una lista de product_ids'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        extra.products.remove(*product_ids)
        
        serializer = self.get_serializer(extra)
        return Response(serializer.data)


class ComboViewSet(viewsets.ModelViewSet):
    """
    ViewSet para combos
    
    list: Lista todos los combos
    retrieve: Obtiene detalle de un combo
    create: Crea un nuevo combo
    update: Actualiza un combo
    partial_update: Actualiza parcialmente un combo
    destroy: Elimina un combo
    """
    queryset = Combo.objects.all()
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['is_active', 'is_featured']
    search_fields = ['name', 'description']
    ordering_fields = ['display_order', 'name', 'price', 'created_at']
    ordering = ['display_order', 'name']
    lookup_field = 'pk'  # ← CAMBIADO de 'slug' a 'pk'
    
    def get_queryset(self):
        """Optimiza queries"""
        queryset = super().get_queryset().prefetch_related(
            Prefetch(
                'combo_products',
                queryset=ComboProduct.objects.select_related('product')
            )
        )
        
        # Filtros adicionales
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        
        if min_price:
            queryset = queryset.filter(price__gte=min_price)
        if max_price:
            queryset = queryset.filter(price__lte=max_price)
        
        return queryset
    
    def get_serializer_class(self):
        """Retorna el serializer apropiado"""
        if self.action == 'list':
            return ComboListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ComboCreateUpdateSerializer
        return ComboDetailSerializer
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Obtiene combos destacados"""
        combos = self.get_queryset().filter(
            is_featured=True,
            is_active=True
        )[:10]
        
        serializer = ComboListSerializer(combos, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def products(self, request, pk=None):  # ← CAMBIADO slug a pk
        """Obtiene productos incluidos en el combo"""
        combo = self.get_object()
        combo_products = combo.combo_products.all().select_related('product')
        
        # Retornar información detallada de los productos
        data = []
        for cp in combo_products:
            data.append({
                'id': cp.id,
                'product': ProductListSerializer(cp.product).data,
                'quantity': cp.quantity,
                'is_selectable': cp.is_selectable,
                'display_order': cp.display_order
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def calculate_savings(self, request):
        """Calcula ahorro de todos los combos"""
        combos = self.get_queryset().filter(is_active=True)
        
        data = []
        for combo in combos:
            individual_price = sum(
                cp.product.price * cp.quantity 
                for cp in combo.combo_products.all()
            )
            savings = individual_price - combo.price
            savings_percentage = (savings / individual_price * 100) if individual_price > 0 else 0
            
            data.append({
                'id': combo.id,
                'name': combo.name,
                'combo_price': float(combo.price),
                'individual_price': float(individual_price),
                'savings': float(savings),
                'savings_percentage': round(savings_percentage, 2)
            })
        
        return Response(data)


class MenuViewSet(viewsets.ViewSet):
    """
    ViewSet para obtener el menú completo
    Endpoints personalizados para el menú
    """
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['get'])
    def full(self, request):
        """
        Obtiene el menú completo con todas las categorías y productos
        """
        categories = Category.objects.filter(is_active=True).prefetch_related(
            Prefetch(
                'products',
                queryset=Product.objects.filter(
                    is_active=True,
                    is_available=True
                ).prefetch_related('sizes', 'extras')
            )
        ).order_by('display_order')
        
        data = []
        for category in categories:
            category_data = CategorySerializer(category).data
            category_data['products'] = ProductListSerializer(
                category.products.all(),
                many=True
            ).data
            data.append(category_data)
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Obtiene un resumen del menú (solo categorías con conteos)
        """
        categories = Category.objects.filter(is_active=True).order_by('display_order')
        serializer = CategorySerializer(categories, many=True)
        return Response(serializer.data)