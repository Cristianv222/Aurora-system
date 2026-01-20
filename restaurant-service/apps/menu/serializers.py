from rest_framework import serializers
from .models import Category, Product, Size, Extra, Combo, ComboProduct


class CategorySerializer(serializers.ModelSerializer):
    """Serializer para categorías"""
    products_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Category
        fields = [
            'id', 'name', 'slug', 'description', 'image',
            'color', 'icon', 'is_active', 'display_order',
            'products_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_products_count(self, obj):
        """Cuenta productos activos en la categoría"""
        return obj.products.filter(is_active=True, is_available=True).count()


class SizeSerializer(serializers.ModelSerializer):
    """Serializer para tamaños de productos"""
    final_price = serializers.SerializerMethodField()
    
    class Meta:
        model = Size
        fields = [
            'id', 'product', 'name', 'price_adjustment',
            'final_price', 'calories', 'is_default',
            'is_active', 'display_order', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_final_price(self, obj):
        """Calcula el precio final del tamaño"""
        return float(obj.get_final_price())


class ExtraSerializer(serializers.ModelSerializer):
    """Serializer para extras"""
    class Meta:
        model = Extra
        fields = [
            'id', 'name', 'description', 'price', 'image',
            'is_active', 'display_order', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProductListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listados de productos"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    has_sizes = serializers.SerializerMethodField()
    has_extras = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = [
            'id', 'category', 'category_name', 'name', 'slug',
            'description', 'image', 'price', 'calories',
            'is_active', 'is_available', 'is_featured', 'is_new',
            'prep_time', 'display_order', 'has_sizes', 'has_extras'
        ]
        read_only_fields = ['id']
    
    def get_has_sizes(self, obj):
        """Indica si el producto tiene tamaños"""
        return obj.sizes.filter(is_active=True).exists()
    
    def get_has_extras(self, obj):
        """Indica si el producto tiene extras"""
        return obj.extras.filter(is_active=True).exists()


class ProductDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para detalle de productos"""
    category = CategorySerializer(read_only=True)
    sizes = SizeSerializer(many=True, read_only=True)
    extras = ExtraSerializer(many=True, read_only=True)
    is_available_now = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = [
            'id', 'category', 'name', 'slug', 'description',
            'image', 'price', 'calories', 'ingredients', 'allergens',
            'is_active', 'is_available', 'is_featured', 'is_new',
            'prep_time', 'display_order', 'sizes', 'extras',
            'is_available_now', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_is_available_now(self, obj):
        """Verifica si está disponible ahora"""
        return obj.is_available_now()


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para crear/actualizar productos"""
    class Meta:
        model = Product
        fields = [
            'category', 'name', 'slug', 'description', 'image',
            'price', 'calories', 'ingredients', 'allergens',
            'is_active', 'is_available', 'is_featured', 'is_new',
            'prep_time', 'display_order'
        ]
    
    def validate_price(self, value):
        """Valida que el precio sea positivo"""
        if value < 0:
            raise serializers.ValidationError("El precio debe ser mayor o igual a 0")
        return value


class ComboProductSerializer(serializers.ModelSerializer):
    """Serializer para productos de combo"""
    product = ProductListSerializer(read_only=True)
    product_id = serializers.UUIDField(write_only=True)
    
    class Meta:
        model = ComboProduct
        fields = [
            'id', 'product', 'product_id', 'quantity',
            'is_selectable', 'display_order'
        ]
        read_only_fields = ['id']


class ComboListSerializer(serializers.ModelSerializer):
    """Serializer para listado de combos"""
    products_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Combo
        fields = [
            'id', 'name', 'slug', 'description', 'image',
            'price', 'is_active', 'is_featured', 'display_order',
            'products_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_products_count(self, obj):
        """Cuenta productos en el combo"""
        return obj.combo_products.count()


class ComboDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para combos"""
    combo_products = ComboProductSerializer(many=True, read_only=True)
    total_individual_price = serializers.SerializerMethodField()
    savings = serializers.SerializerMethodField()
    
    class Meta:
        model = Combo
        fields = [
            'id', 'name', 'slug', 'description', 'image',
            'price', 'is_active', 'is_featured', 'display_order',
            'combo_products', 'total_individual_price', 'savings',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_total_individual_price(self, obj):
        """Calcula precio si se compraran los productos por separado"""
        total = sum(
            cp.product.price * cp.quantity 
            for cp in obj.combo_products.all()
        )
        return float(total)
    
    def get_savings(self, obj):
        """Calcula el ahorro del combo"""
        individual_price = self.get_total_individual_price(obj)
        savings = individual_price - float(obj.price)
        return round(savings, 2)


class ComboCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para crear/actualizar combos"""
    combo_products = ComboProductSerializer(many=True, required=False)
    
    class Meta:
        model = Combo
        fields = [
            'name', 'slug', 'description', 'image', 'price',
            'is_active', 'is_featured', 'display_order', 'combo_products'
        ]
    
    def create(self, validated_data):
        """Crea combo con productos incluidos"""
        combo_products_data = validated_data.pop('combo_products', [])
        combo = Combo.objects.create(**validated_data)
        
        for product_data in combo_products_data:
            product_id = product_data.pop('product_id')
            ComboProduct.objects.create(
                combo=combo,
                product_id=product_id,
                **product_data
            )
        
        return combo
    
    def update(self, instance, validated_data):
        """Actualiza combo y sus productos"""
        combo_products_data = validated_data.pop('combo_products', None)
        
        # Actualizar campos del combo
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Actualizar productos del combo si se proporcionaron
        if combo_products_data is not None:
            instance.combo_products.all().delete()
            for product_data in combo_products_data:
                product_id = product_data.pop('product_id')
                ComboProduct.objects.create(
                    combo=instance,
                    product_id=product_id,
                    **product_data
                )
        
        return instance


class SizeCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para crear/actualizar tamaños"""
    class Meta:
        model = Size
        fields = [
            'product', 'name', 'price_adjustment', 'calories',
            'is_default', 'is_active', 'display_order'
        ]


class ExtraCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para crear/actualizar extras"""
    product_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Extra
        fields = [
            'name', 'description', 'price', 'image',
            'is_active', 'display_order', 'product_ids'
        ]
    
    def create(self, validated_data):
        """Crea extra y asocia productos"""
        product_ids = validated_data.pop('product_ids', [])
        extra = Extra.objects.create(**validated_data)
        
        if product_ids:
            extra.products.set(product_ids)
        
        return extra
    
    def update(self, instance, validated_data):
        """Actualiza extra y sus productos asociados"""
        product_ids = validated_data.pop('product_ids', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if product_ids is not None:
            instance.products.set(product_ids)
        
        return instance