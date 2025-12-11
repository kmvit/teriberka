from rest_framework import serializers
from django.db.models import Max
from sorl.thumbnail import get_thumbnail
from .models import (
    Boat, BoatImage, Feature, BoatPricing, 
    BoatAvailability, SailingZone, BlockedDate, SeasonalPricing
)


class BoatImageSerializer(serializers.ModelSerializer):
    """Сериализатор для фото судна"""
    image_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    
    class Meta:
        model = BoatImage
        fields = ('id', 'image', 'image_url', 'thumbnail_url', 'order', 'created_at')
        read_only_fields = ('id', 'created_at')
    
    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and hasattr(obj.image, 'url'):
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None
    
    def get_thumbnail_url(self, obj):
        """Возвращает URL thumbnail для карусели"""
        if not obj.image:
            return None
        
        try:
            # Определяем размер thumbnail в зависимости от контекста
            # Для детальной страницы используем больший размер
            is_detail_page = self.context.get('is_detail_page', False)
            
            if is_detail_page:
                # Детальная страница рейса - используем больший thumbnail (800x450)
                size = '800'
            else:
                # Главная страница - используем меньший thumbnail (400x220)
                size = '400'
            
            # Создаем thumbnail (sorl-thumbnail автоматически сохранит пропорции)
            thumbnail = get_thumbnail(obj.image, size, quality=85, crop='center')
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(thumbnail.url)
            return thumbnail.url
        except Exception as e:
            # Если не удалось создать thumbnail, возвращаем оригинальное изображение
            print(f"Ошибка при создании thumbnail: {e}")
            return self.get_image_url(obj)


class FeatureSerializer(serializers.ModelSerializer):
    """Сериализатор для особенностей судна"""
    
    class Meta:
        model = Feature
        fields = ('id', 'name')
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


class BlockedDateSerializer(serializers.ModelSerializer):
    """Сериализатор для блокировки дат"""
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    boat_id = serializers.IntegerField(source='boat.id', read_only=True)
    
    class Meta:
        model = BlockedDate
        fields = ('id', 'boat_id', 'date_from', 'date_to', 'reason', 'reason_display', 'reason_text', 'is_active', 'created_at')
        read_only_fields = ('id', 'created_at')


class SeasonalPricingSerializer(serializers.ModelSerializer):
    """Сериализатор для сезонных цен"""
    duration_hours_display = serializers.CharField(source='get_duration_hours_display', read_only=True)
    boat_id = serializers.IntegerField(source='boat.id', read_only=True)
    
    class Meta:
        model = SeasonalPricing
        fields = ('id', 'boat_id', 'date_from', 'date_to', 'duration_hours', 'duration_hours_display', 'price_per_person', 'is_active', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class BoatShortSerializer(serializers.ModelSerializer):
    """Сериализатор для краткого отображения судна"""
    boat_type_display = serializers.CharField(source='get_boat_type_display', read_only=True)
    first_image = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Boat
        fields = (
            'id', 'name', 'boat_type', 'boat_type_display', 'capacity',
            'first_image', 'images', 'owner_name'
        )
        read_only_fields = ('id',)
    
    def get_first_image(self, obj):
        """Возвращает thumbnail первого изображения для главной страницы"""
        first_image = obj.images.first()
        if first_image:
            try:
                thumbnail = get_thumbnail(first_image.image, '400', quality=85, crop='center')
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(thumbnail.url)
                return thumbnail.url
            except Exception:
                # Если не удалось создать thumbnail, возвращаем оригинал
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(first_image.image.url)
                return first_image.image.url
        return None
    
    def get_images(self, obj):
        """Возвращает все изображения судна с thumbnail для главной страницы"""
        images = obj.images.all()
        request = self.context.get('request')
        result = []
        for img in images:
            if img.image:
                try:
                    # Используем thumbnail для карусели на главной странице
                    thumbnail = get_thumbnail(img.image, '400', quality=85, crop='center')
                    image_url = thumbnail.url
                    if request:
                        image_url = request.build_absolute_uri(image_url)
                except Exception:
                    # Если не удалось создать thumbnail, используем оригинал
                    image_url = img.image.url
                    if request:
                        image_url = request.build_absolute_uri(image_url)
                
                result.append({
                    'id': img.id,
                    'url': image_url,
                    'order': img.order
                })
        return result
    
    def get_owner_name(self, obj):
        """Возвращает имя капитана (владельца судна)"""
        owner = obj.owner
        if owner.first_name or owner.last_name:
            return f"{owner.first_name or ''} {owner.last_name or ''}".strip()
        return owner.email.split('@')[0] if owner.email else 'Капитан'


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
        return [feature.name for feature in obj.features.filter(is_active=True)]
    
    def get_min_price(self, obj):
        min_pricing = obj.pricing.order_by('price_per_person').first()
        if min_pricing:
            return float(min_pricing.price_per_person)
        return None


class BoatDetailSerializer(serializers.ModelSerializer):
    """Сериализатор для детальной информации о судне"""
    boat_type_display = serializers.CharField(source='get_boat_type_display', read_only=True)
    owner = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    features = FeatureSerializer(many=True, read_only=True)
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
    
    def get_images(self, obj):
        """Возвращает изображения с большим thumbnail для детальной страницы"""
        # Передаем флаг, что это детальная страница
        context = self.context.copy()
        context['is_detail_page'] = True
        return BoatImageSerializer(obj.images.all(), many=True, context=context).data


class BoatCreateUpdateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания и обновления судна"""
    images = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        allow_empty=True,
        write_only=True
    )
    features = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        write_only=True,
        help_text='Список ID особенностей'
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
    
    def to_internal_value(self, data):
        """Парсим pricing из FormData и конвертируем типы"""
        from django.http import QueryDict
        from django.core.files.uploadedfile import UploadedFile
        import json
        import re
        
        # Преобразуем QueryDict в dict для упрощения обработки
        is_querydict = isinstance(data, QueryDict)
        if is_querydict:
            # Создаем обычный dict из QueryDict для обычных полей
            data_dict = data.dict()
            
            # Для полей-списков используем getlist() чтобы получить все значения
            # Изображения
            images_list = data.getlist('images')
            if images_list:
                data_dict['images'] = images_list
            elif 'images' in data_dict:
                del data_dict['images']
            
            # Особенности (features) - должны быть списком ID
            features_list = data.getlist('features')
            if features_list:
                # Преобразуем строки в числа
                try:
                    data_dict['features'] = [int(f) for f in features_list]
                except (ValueError, TypeError):
                    data_dict['features'] = features_list
            elif 'features' in data_dict:
                # Если features есть как строка, пытаемся преобразовать
                features_value = data_dict.get('features')
                if isinstance(features_value, str):
                    try:
                        data_dict['features'] = [int(features_value)]
                    except (ValueError, TypeError):
                        data_dict['features'] = []
                else:
                    data_dict['features'] = []
            
            # Маршруты (route_ids) - должны быть списком ID
            route_ids_list = data.getlist('route_ids')
            if route_ids_list:
                # Преобразуем строки в числа
                try:
                    data_dict['route_ids'] = [int(r) for r in route_ids_list]
                except (ValueError, TypeError):
                    data_dict['route_ids'] = route_ids_list
            elif 'route_ids' in data_dict:
                # Если route_ids есть как строка, пытаемся преобразовать
                route_ids_value = data_dict.get('route_ids')
                if isinstance(route_ids_value, str):
                    try:
                        data_dict['route_ids'] = [int(route_ids_value)]
                    except (ValueError, TypeError):
                        data_dict['route_ids'] = []
                else:
                    data_dict['route_ids'] = []
        else:
            data_dict = dict(data) if hasattr(data, 'items') else data
        
        # Обрабатываем pricing - может прийти как JSON строка или как отдельные поля FormData
        pricing_value = None
        
        # Проверяем, есть ли pricing как JSON строка
        if 'pricing' in data_dict:
            pricing_raw = data_dict.get('pricing', '')
            if isinstance(pricing_raw, str) and pricing_raw:
                try:
                    pricing_value = json.loads(pricing_raw)
                except (json.JSONDecodeError, TypeError):
                    pass
            elif isinstance(pricing_raw, list):
                # Если это список строк (из QueryDict), пытаемся распарсить первую
                if len(pricing_raw) > 0 and isinstance(pricing_raw[0], str):
                    try:
                        pricing_value = json.loads(pricing_raw[0])
                    except (json.JSONDecodeError, TypeError):
                        pricing_value = pricing_raw
                else:
                    pricing_value = pricing_raw
        
        # Если pricing не найден как JSON, пытаемся собрать из отдельных полей FormData
        if pricing_value is None:
            pricing_pattern = re.compile(r'pricing\[(\d+)\]\[(\w+)\]')
            pricing_dict = {}
            
            for key in data_dict.keys():
                match = pricing_pattern.match(key)
                if match:
                    index = int(match.group(1))
                    field = match.group(2)
                    if index not in pricing_dict:
                        pricing_dict[index] = {}
                    value = data_dict[key]
                    # Если значение - список из одного элемента, берем первый
                    if isinstance(value, list) and len(value) == 1:
                        value = value[0]
                    pricing_dict[index][field] = value
            
            if pricing_dict:
                pricing_value = []
                for index in sorted(pricing_dict.keys()):
                    price_item = pricing_dict[index]
                    if 'duration_hours' in price_item and 'price_per_person' in price_item:
                        try:
                            pricing_value.append({
                                'duration_hours': int(price_item['duration_hours']),
                                'price_per_person': float(price_item['price_per_person'])
                            })
                        except (ValueError, TypeError):
                            pass
        
        # Устанавливаем pricing в data_dict
        if pricing_value is not None:
            # Удаляем все старые поля pricing[...]
            keys_to_remove = [key for key in data_dict.keys() if re.match(r'pricing\[', key)]
            for key in keys_to_remove:
                del data_dict[key]
            # Устанавливаем pricing как список
            data_dict['pricing'] = pricing_value
        # Если pricing не найден и не был передан, не добавляем его в data_dict
        # Это позволит методу update не трогать существующие цены
        
        # Конвертируем типы для FormData
        # is_active может прийти как строка "true"/"false"
        if 'is_active' in data_dict:
            is_active_value = data_dict['is_active']
            if isinstance(is_active_value, str):
                data_dict['is_active'] = is_active_value.lower() in ('true', '1', 'yes', 'on')
            elif isinstance(is_active_value, list) and len(is_active_value) > 0:
                is_active_value = is_active_value[0]
                if isinstance(is_active_value, str):
                    data_dict['is_active'] = is_active_value.lower() in ('true', '1', 'yes', 'on')
        
        # capacity должен быть числом
        if 'capacity' in data_dict:
            capacity_value = data_dict['capacity']
            if isinstance(capacity_value, str):
                try:
                    data_dict['capacity'] = int(capacity_value)
                except (ValueError, TypeError):
                    pass
            elif isinstance(capacity_value, list) and len(capacity_value) > 0:
                try:
                    data_dict['capacity'] = int(capacity_value[0])
                except (ValueError, TypeError):
                    pass
        
        # Возвращаем обработанный dict
        return super().to_internal_value(data_dict)
    
    class Meta:
        model = Boat
        fields = (
            'name', 'boat_type', 'capacity', 'description', 'is_active',
            'images', 'features', 'pricing', 'route_ids'
        )
    
    def validate_pricing(self, value):
        """Валидация цен"""
        if value:
            # Убеждаемся, что value - это список
            if not isinstance(value, list):
                raise serializers.ValidationError("Pricing должен быть списком")
            
            durations = []
            for item in value:
                # Убеждаемся, что item - это словарь
                if not isinstance(item, dict):
                    raise serializers.ValidationError("Каждый элемент pricing должен быть объектом с полями duration_hours и price_per_person")
                
                if 'duration_hours' not in item or 'price_per_person' not in item:
                    raise serializers.ValidationError("Каждый элемент pricing должен содержать duration_hours и price_per_person")
                
                # Преобразуем duration_hours в int
                try:
                    duration = int(item['duration_hours'])
                except (ValueError, TypeError):
                    raise serializers.ValidationError("duration_hours должен быть числом (2 или 3)")
                
                if duration not in [2, 3]:
                    raise serializers.ValidationError("Длительность должна быть 2 или 3 часа")
                
                durations.append(duration)
            
            # Проверяем уникальность длительностей
            if len(durations) != len(set(durations)):
                raise serializers.ValidationError("Длительности должны быть уникальными")
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
        if features_data:
            boat.features.set(features_data)
        
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
        
        # Обновляем фото (если переданы) - добавляем к существующим
        if images_data is not None and len(images_data) > 0:
            # Получаем максимальный порядок существующих изображений
            max_order = instance.images.aggregate(max_order=Max('order'))['max_order']
            start_order = (max_order + 1) if max_order is not None else 0
            # Добавляем новые фото к существующим
            for idx, image in enumerate(images_data):
                BoatImage.objects.create(boat=instance, image=image, order=start_order + idx)
        
        # Обновляем особенности (если переданы)
        if features_data is not None:
            instance.features.set(features_data)
        
        # Обновляем цены (если переданы и не пустой список)
        if pricing_data is not None:
            if isinstance(pricing_data, list) and len(pricing_data) > 0:
                instance.pricing.all().delete()
                for pricing_item in pricing_data:
                    # Убеждаемся, что это словарь с нужными полями
                    if isinstance(pricing_item, dict) and 'duration_hours' in pricing_item and 'price_per_person' in pricing_item:
                        BoatPricing.objects.create(
                            boat=instance,
                            duration_hours=int(pricing_item['duration_hours']),
                            price_per_person=float(pricing_item['price_per_person'])
                        )
            # Если передан пустой список, удаляем все цены
            elif isinstance(pricing_data, list) and len(pricing_data) == 0:
                instance.pricing.all().delete()
        
        # Обновляем маршруты (если переданы)
        if route_ids is not None:
            instance.sailing_zones.set(route_ids)
        
        return instance

