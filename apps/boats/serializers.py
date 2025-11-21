from rest_framework import serializers
from .models import (
    Boat, BoatImage, BoatFeature, BoatPricing, 
    BoatAvailability, SailingZone
)


class BoatImageSerializer(serializers.ModelSerializer):
    """Сериализатор для фото судна"""
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = BoatImage
        fields = ('id', 'image', 'image_url', 'order', 'created_at')
        read_only_fields = ('id', 'created_at')
    
    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and hasattr(obj.image, 'url'):
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class BoatFeatureSerializer(serializers.ModelSerializer):
    """Сериализатор для особенностей судна"""
    feature_type_display = serializers.CharField(source='get_feature_type_display', read_only=True)
    
    class Meta:
        model = BoatFeature
        fields = ('id', 'feature_type', 'feature_type_display')
        read_only_fields = ('id',)


class BoatPricingSerializer(serializers.ModelSerializer):
    """Сериализатор для ценообразования судна"""
    duration_hours_display = serializers.CharField(source='get_duration_hours_display', read_only=True)
    
    class Meta:
        model = BoatPricing
        fields = ('id', 'duration_hours', 'duration_hours_display', 'price_per_person')
        read_only_fields = ('id',)


class BoatAvailabilitySerializer(serializers.ModelSerializer):
    """Сериализатор для расписания доступности судна"""
    
    class Meta:
        model = BoatAvailability
        fields = (
            'id', 'departure_date', 'departure_time', 'return_time', 
            'is_active', 'created_at'
        )
        read_only_fields = ('id', 'created_at')


class SailingZoneSerializer(serializers.ModelSerializer):
    """Сериализатор для маршрутов (зон плавания)"""
    
    class Meta:
        model = SailingZone
        fields = ('id', 'name', 'description', 'is_active')
        read_only_fields = ('id',)


class BoatShortSerializer(serializers.ModelSerializer):
    """Сериализатор для краткого отображения судна"""
    boat_type_display = serializers.CharField(source='get_boat_type_display', read_only=True)
    first_image = serializers.SerializerMethodField()
    
    class Meta:
        model = Boat
        fields = (
            'id', 'name', 'boat_type', 'boat_type_display', 'capacity',
            'first_image'
        )
        read_only_fields = ('id',)
    
    def get_first_image(self, obj):
        first_image = obj.images.first()
        if first_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(first_image.image.url)
            return first_image.image.url
        return None


class BoatListSerializer(serializers.ModelSerializer):
    """Сериализатор для списка судов (краткая информация)"""
    boat_type_display = serializers.CharField(source='get_boat_type_display', read_only=True)
    owner_email = serializers.EmailField(source='owner.email', read_only=True)
    first_image = serializers.SerializerMethodField()
    features = serializers.SerializerMethodField()
    min_price = serializers.SerializerMethodField()
    
    class Meta:
        model = Boat
        fields = (
            'id', 'name', 'boat_type', 'boat_type_display', 'capacity',
            'description', 'is_active', 'owner_email', 'first_image',
            'features', 'min_price', 'created_at'
        )
        read_only_fields = ('id', 'created_at')
    
    def get_first_image(self, obj):
        first_image = obj.images.first()
        if first_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(first_image.image.url)
            return first_image.image.url
        return None
    
    def get_features(self, obj):
        return [feature.feature_type for feature in obj.features.all()]
    
    def get_min_price(self, obj):
        min_pricing = obj.pricing.order_by('price_per_person').first()
        if min_pricing:
            return float(min_pricing.price_per_person)
        return None


class BoatDetailSerializer(serializers.ModelSerializer):
    """Сериализатор для детальной информации о судне"""
    boat_type_display = serializers.CharField(source='get_boat_type_display', read_only=True)
    owner = serializers.SerializerMethodField()
    images = BoatImageSerializer(many=True, read_only=True)
    features = BoatFeatureSerializer(many=True, read_only=True)
    pricing = BoatPricingSerializer(many=True, read_only=True)
    availabilities = BoatAvailabilitySerializer(many=True, read_only=True)
    sailing_zones = SailingZoneSerializer(many=True, read_only=True)
    
    class Meta:
        model = Boat
        fields = (
            'id', 'name', 'boat_type', 'boat_type_display', 'capacity',
            'description', 'is_active', 'owner', 'images', 'features',
            'pricing', 'availabilities', 'sailing_zones', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')
    
    def get_owner(self, obj):
        return {
            'id': obj.owner.id,
            'email': obj.owner.email,
            'first_name': obj.owner.first_name,
            'last_name': obj.owner.last_name,
        }


class BoatCreateUpdateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания и обновления судна"""
    images = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        allow_empty=True,
        write_only=True
    )
    features = serializers.ListField(
        child=serializers.ChoiceField(choices=BoatFeature.FeatureType.choices),
        required=False,
        allow_empty=True,
        write_only=True
    )
    pricing = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        allow_empty=True,
        write_only=True
    )
    route_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        write_only=True
    )
    
    class Meta:
        model = Boat
        fields = (
            'name', 'boat_type', 'capacity', 'description', 'is_active',
            'images', 'features', 'pricing', 'route_ids'
        )
    
    def validate_pricing(self, value):
        """Валидация цен"""
        if value:
            durations = [item.get('duration_hours') for item in value]
            if len(durations) != len(set(durations)):
                raise serializers.ValidationError("Длительности должны быть уникальными")
            for item in value:
                if 'duration_hours' not in item or 'price_per_person' not in item:
                    raise serializers.ValidationError("Каждый элемент pricing должен содержать duration_hours и price_per_person")
                if item['duration_hours'] not in [2, 3]:
                    raise serializers.ValidationError("Длительность должна быть 2 или 3 часа")
        return value
    
    def create(self, validated_data):
        images_data = validated_data.pop('images', [])
        features_data = validated_data.pop('features', [])
        pricing_data = validated_data.pop('pricing', [])
        route_ids = validated_data.pop('route_ids', [])
        
        # Создаем судно
        boat = Boat.objects.create(**validated_data)
        
        # Сохраняем фото
        for order, image in enumerate(images_data):
            BoatImage.objects.create(boat=boat, image=image, order=order)
        
        # Сохраняем особенности
        for feature_type in features_data:
            BoatFeature.objects.get_or_create(boat=boat, feature_type=feature_type)
        
        # Сохраняем цены
        for pricing_item in pricing_data:
            BoatPricing.objects.create(
                boat=boat,
                duration_hours=pricing_item['duration_hours'],
                price_per_person=pricing_item['price_per_person']
            )
        
        # Связываем маршруты
        if route_ids:
            boat.sailing_zones.set(route_ids)
        
        return boat
    
    def update(self, instance, validated_data):
        images_data = validated_data.pop('images', None)
        features_data = validated_data.pop('features', None)
        pricing_data = validated_data.pop('pricing', None)
        route_ids = validated_data.pop('route_ids', None)
        
        # Обновляем основные поля
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Обновляем фото (если переданы)
        if images_data is not None:
            # Удаляем старые фото
            instance.images.all().delete()
            # Добавляем новые
            for order, image in enumerate(images_data):
                BoatImage.objects.create(boat=instance, image=image, order=order)
        
        # Обновляем особенности (если переданы)
        if features_data is not None:
            instance.features.all().delete()
            for feature_type in features_data:
                BoatFeature.objects.create(boat=instance, feature_type=feature_type)
        
        # Обновляем цены (если переданы)
        if pricing_data is not None:
            instance.pricing.all().delete()
            for pricing_item in pricing_data:
                BoatPricing.objects.create(
                    boat=instance,
                    duration_hours=pricing_item['duration_hours'],
                    price_per_person=pricing_item['price_per_person']
                )
        
        # Обновляем маршруты (если переданы)
        if route_ids is not None:
            instance.sailing_zones.set(route_ids)
        
        return instance

