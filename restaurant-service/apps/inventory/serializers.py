from rest_framework import serializers
from .models import RawMaterial, RecipeItem, DailyInventory
from apps.menu.models import Product

class RecipeItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    class Meta:
        model = RecipeItem
        fields = ['id', 'raw_material', 'product', 'product_name', 'quantity_used']

class RawMaterialSerializer(serializers.ModelSerializer):
    recipe_items = RecipeItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = RawMaterial
        fields = ['id', 'name', 'unit', 'stock', 'is_active', 'created_at', 'updated_at', 'recipe_items']

class DailyInventorySerializer(serializers.ModelSerializer):
    raw_material_name = serializers.CharField(source='raw_material.name', read_only=True)
    raw_material_unit = serializers.CharField(source='raw_material.unit', read_only=True)
    
    class Meta:
        model = DailyInventory
        fields = ['id', 'date', 'raw_material', 'raw_material_name', 'raw_material_unit', 
                  'previous_balance', 'income', 'consumption', 'current_balance']

class AddIncomeSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0.01)
