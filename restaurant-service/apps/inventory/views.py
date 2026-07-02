from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
from .models import RawMaterial, RecipeItem, DailyInventory
from .serializers import RawMaterialSerializer, RecipeItemSerializer, DailyInventorySerializer, AddIncomeSerializer
from .signals import get_or_create_daily_inventory

class RawMaterialViewSet(viewsets.ModelViewSet):
    queryset = RawMaterial.objects.all()
    serializer_class = RawMaterialSerializer

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def add_income(self, request, pk=None):
        raw_material = self.get_object()
        serializer = AddIncomeSerializer(data=request.data)
        
        if serializer.is_valid():
            amount = serializer.validated_data['amount']
            
            daily = get_or_create_daily_inventory(raw_material)
            
            raw_material.stock += amount
            raw_material.save()
            
            daily.income += amount
            daily.update_balance()
            daily.save()
            
            return Response({'status': 'Ingreso registrado correctamente', 'new_stock': raw_material.stock})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def update_full(self, request, pk=None):
        from decimal import Decimal
        from .models import RecipeItem
        raw_material = self.get_object()
        
        name = request.data.get('name')
        unit = request.data.get('unit')
        previous_balance = Decimal(str(request.data.get('previous_balance', 0)))
        income = Decimal(str(request.data.get('income', 0)))
        usages = request.data.get('usages', [])
        
        if name:
            raw_material.name = name
        if unit:
            raw_material.unit = unit
            
        daily = get_or_create_daily_inventory(raw_material)
        daily.previous_balance = previous_balance
        daily.income = income
        daily.update_balance()
        daily.save()
        
        raw_material.stock = daily.current_balance
        raw_material.save()
        
        # Update recipe items (usages)
        for usage in usages:
            try:
                recipe_item = RecipeItem.objects.get(id=usage.get('id'), raw_material=raw_material)
                recipe_item.quantity_used = Decimal(str(usage.get('quantity_used', 0)))
                recipe_item.save()
            except Exception:
                pass
        
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                "inventory_updates",
                {
                    "type": "inventory_update",
                    "message": "inventory_changed"
                }
            )
            
        return Response({'status': 'ok'})

class RecipeItemViewSet(viewsets.ModelViewSet):
    queryset = RecipeItem.objects.all()
    serializer_class = RecipeItemSerializer

class DailyInventoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DailyInventory.objects.all()
    serializer_class = DailyInventorySerializer
    
    def get_queryset(self):
        queryset = DailyInventory.objects.all()
        date = self.request.query_params.get('date', None)
        if date:
            queryset = queryset.filter(date=date)
        else:
            # Por defecto mostrar el de hoy
            queryset = queryset.filter(date=timezone.now().date())
        return queryset

    @action(detail=False, methods=['post'])
    def generate_daily(self, request):
        """Genera el kardex diario para todas las materias primas si no existe para la fecha solicitada."""
        from datetime import datetime
        date_str = request.data.get('date', None)
        if date_str:
            try:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'error': 'Formato de fecha inválido, use YYYY-MM-DD'}, status=400)
        else:
            date_obj = timezone.now().date()
            
        active_materials = RawMaterial.objects.filter(is_active=True)
        for material in active_materials:
            get_or_create_daily_inventory(material, date=date_obj)
            
        return Response({'status': 'ok', 'date': str(date_obj)})
