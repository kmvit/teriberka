from rest_framework import serializers
from decimal import Decimal
from datetime import datetime, timedelta
from django.utils import timezone
from .models import Booking
from apps.boats.models import Boat, BoatAvailability, BoatPricing
from apps.boats.serializers import DockSerializer
from apps.accounts.models import User
from apps.payments.serializers import PaymentSerializer


class BoatShortSerializer(serializers.ModelSerializer):
    """Краткая информация о судне для бронирования"""
    boat_type_display = serializers.CharField(source='get_boat_type_display', read_only=True)
    dock = DockSerializer(read_only=True)
    
    class Meta:
        model = Boat
        fields = ('id', 'name', 'boat_type', 'boat_type_display', 'capacity', 'dock')


class BookingListSerializer(serializers.ModelSerializer):
    """Сериализатор для списка бронирований"""
    boat = BoatShortSerializer(read_only=True)
    guide = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    is_guide_booking = serializers.SerializerMethodField()
    guide_commission_per_person = serializers.SerializerMethodField()
    guide_total_commission = serializers.SerializerMethodField()
    guide_booking_amount = serializers.SerializerMethodField()
    payments = PaymentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Booking
        fields = (
            'id', 'boat', 'guide', 'start_datetime', 'end_datetime', 'duration_hours',
            'event_type', 'number_of_people', 'guest_name', 'guest_phone',
            'price_per_person', 'total_price', 'deposit', 'remaining_amount',
            'status', 'status_display', 'payment_method', 'payment_method_display',
            'is_guide_booking', 'guide_commission_per_person', 'guide_total_commission',
            'guide_booking_amount', 'payments', 'created_at'
        )
        read_only_fields = ('id', 'created_at')
    
    def get_guide(self, obj):
        """Возвращает информацию о гиде, если бронирование от гида"""
        if obj.guide:
            return {
                'id': obj.guide.id,
                'email': obj.guide.email,
                'first_name': obj.guide.first_name,
                'last_name': obj.guide.last_name,
                'phone': obj.guide.phone,
            }
        return None
    
    def get_is_guide_booking(self, obj):
        """Проверяет, является ли бронирование от гида"""
        return obj.guide is not None
    
    def get_guide_commission_per_person(self, obj):
        """Возвращает комиссию гида за одного туриста (только для гидов)"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        # Показываем комиссию только если это бронирование гида и текущий пользователь - гид
        if obj.guide and (request.user == obj.guide or request.user.role == User.Role.GUIDE):
            # TODO: Здесь будет логика расчета комиссии гида
            # Пока возвращаем фиксированную сумму (500 руб/чел)
            # В будущем это будет настраиваться через модель GuideCommission
            return float(500)
        return None
    
    def get_guide_total_commission(self, obj):
        """Возвращает общую комиссию гида (только для гидов)"""
        commission_per_person = self.get_guide_commission_per_person(obj)
        if commission_per_person:
            return float(commission_per_person * obj.number_of_people)
        return None
    
    def get_guide_booking_amount(self, obj):
        """Возвращает сумму бронирования для гида (цена со скидкой * количество людей)"""
        if obj.guide:
            # Используем total_price, который уже рассчитан с учетом скидки в методе save модели Booking
            if obj.total_price:
                return float(obj.total_price)
            # Если total_price не установлен, рассчитываем на основе price_per_person и скидки
            elif obj.price_per_person:
                # Если есть скидка, применяем её
                if obj.discount_percent and obj.discount_percent > 0:
                    base_amount = float(obj.price_per_person * obj.number_of_people)
                    discount_amount = base_amount * (float(obj.discount_percent) / 100)
                    return base_amount - discount_amount
                else:
                    return float(obj.price_per_person * obj.number_of_people)
        return None


class BookingDetailSerializer(serializers.ModelSerializer):
    """Сериализатор для детальной информации о бронировании"""
    boat = BoatShortSerializer(read_only=True)
    guide = serializers.SerializerMethodField()
    customer = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    is_guide_booking = serializers.SerializerMethodField()
    guide_commission_per_person = serializers.SerializerMethodField()
    guide_total_commission = serializers.SerializerMethodField()
    payments = PaymentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Booking
        fields = (
            'id', 'boat', 'start_datetime', 'end_datetime', 'duration_hours',
            'event_type', 'guide', 'customer', 'number_of_people',
            'guest_name', 'guest_phone', 'price_per_person', 'original_price',
            'discount_percent', 'discount_amount', 'total_price', 'deposit',
            'remaining_amount', 'payment_method', 'payment_method_display',
            'status', 'status_display', 'notes', 'is_guide_booking',
            'guide_commission_per_person', 'guide_total_commission',
            'payments', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')
    
    def get_guide(self, obj):
        if obj.guide:
            return {
                'id': obj.guide.id,
                'email': obj.guide.email,
                'first_name': obj.guide.first_name,
                'last_name': obj.guide.last_name,
            }
        return None
    
    def get_customer(self, obj):
        if obj.customer:
            return {
                'id': obj.customer.id,
                'email': obj.customer.email,
                'first_name': obj.customer.first_name,
                'last_name': obj.customer.last_name,
            }
        return None
    
    def get_is_guide_booking(self, obj):
        return obj.guide is not None
    
    def get_guide_commission_per_person(self, obj):
        """Возвращает комиссию гида за одного туриста (только для гидов)"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        if obj.guide and (request.user == obj.guide or request.user.role == User.Role.GUIDE):
            # TODO: Логика расчета комиссии
            return float(500)
        return None
    
    def get_guide_total_commission(self, obj):
        commission_per_person = self.get_guide_commission_per_person(obj)
        if commission_per_person:
            return float(commission_per_person * obj.number_of_people)
        return None


class BookingCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания бронирования"""
    trip_id = serializers.IntegerField(write_only=True, help_text='ID из /api/trips/')
    boat = BoatShortSerializer(read_only=True)
    status = serializers.CharField(read_only=True)
    
    class Meta:
        model = Booking
        fields = (
            'id', 'trip_id', 'number_of_people', 'guest_name', 'guest_phone',
            'boat', 'start_datetime', 'end_datetime', 'duration_hours',
            'price_per_person', 'total_price', 'deposit', 'remaining_amount',
            'status', 'created_at'
        )
        read_only_fields = ('id', 'boat', 'start_datetime', 'end_datetime', 
                           'duration_hours', 'price_per_person', 'total_price', 
                           'deposit', 'remaining_amount', 'status', 'created_at')
    
    def validate_trip_id(self, value):
        """Проверяет существование доступного рейса"""
        try:
            availability = BoatAvailability.objects.get(id=value, is_active=True)
        except BoatAvailability.DoesNotExist:
            raise serializers.ValidationError("Доступный рейс не найден")
        return value
    
    def validate_number_of_people(self, value):
        """Проверяет количество людей"""
        if value < 1:
            raise serializers.ValidationError("Количество людей должно быть не менее 1")
        if value > 11:
            raise serializers.ValidationError("Максимальное количество людей - 11")
        return value
    
    def create(self, validated_data):
        trip_id = validated_data.pop('trip_id')
        user = self.context['request'].user
        
        # Получаем доступный рейс
        availability = BoatAvailability.objects.get(id=trip_id)
        boat = availability.boat
        
        # Проверяем доступность мест
        # Подсчитываем уже забронированные места на этот слот
        start_datetime = datetime.combine(availability.departure_date, availability.departure_time)
        end_datetime = datetime.combine(availability.departure_date, availability.return_time)
        
        # Если время возвращения меньше времени отправления, значит рейс через полночь
        if availability.return_time < availability.departure_time:
            end_datetime += timedelta(days=1)
        
        # Проверяем пересечения с существующими бронированиями (обычные бронирования)
        # RESERVED не учитываются, так как места не заблокированы до оплаты предоплаты
        existing_bookings = Booking.objects.filter(
            boat=boat,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            start_datetime__lt=end_datetime,
            end_datetime__gt=start_datetime
        )
        
        # Подсчитываем заблокированные места капитаном (Booking с customer=None, guide=None, notes содержит "[БЛОКИРОВКА]")
        blocked_bookings = Booking.objects.filter(
            boat=boat,
            customer__isnull=True,
            guide__isnull=True,
            notes__startswith="[БЛОКИРОВКА]",
            status=Booking.Status.CONFIRMED,
            start_datetime__lt=end_datetime,
            end_datetime__gt=start_datetime
        )
        
        booked_places = sum(booking.number_of_people for booking in existing_bookings)
        blocked_places = sum(booking.number_of_people for booking in blocked_bookings)
        available_places = boat.capacity - booked_places - blocked_places
        
        if validated_data['number_of_people'] > available_places:
            raise serializers.ValidationError(
                f"Недостаточно свободных мест. Доступно: {available_places}, запрошено: {validated_data['number_of_people']}"
            )
        
        # Получаем цену из BoatPricing
        duration_hours = self._calculate_duration(availability)
        try:
            pricing = BoatPricing.objects.get(boat=boat, duration_hours=duration_hours)
            price_per_person = pricing.price_per_person
        except BoatPricing.DoesNotExist:
            raise serializers.ValidationError(f"Цена для длительности {duration_hours} часов не установлена")
        
        # Рассчитываем предоплату (1000 руб/чел)
        deposit = Decimal('1000') * validated_data['number_of_people']
        
        # Определяем роль пользователя и создаем бронирование
        if user.role == User.Role.GUIDE and user.is_verified:
            # Бронирование от гида
            guide = user
            customer = None
            event_type = f"Группа от гида: {validated_data['guest_name']}"
        else:
            # Бронирование от клиента
            guide = None
            customer = user if user.role == User.Role.CUSTOMER else None
            event_type = "Выход в море"
        
        # Создаем бронирование со статусом RESERVED (ожидает оплаты предоплаты)
        # Места не блокируются до успешной оплаты предоплаты
        booking = Booking.objects.create(
            boat=boat,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            duration_hours=duration_hours,
            event_type=event_type,
            guide=guide,
            customer=customer,
            number_of_people=validated_data['number_of_people'],
            guest_name=validated_data['guest_name'],
            guest_phone=validated_data['guest_phone'],
            price_per_person=price_per_person,
            deposit=deposit,
            status=Booking.Status.RESERVED
        )
        
        return booking
    
    def _calculate_duration(self, availability):
        """Рассчитывает длительность в часах"""
        departure = datetime.combine(availability.departure_date, availability.departure_time)
        return_time = datetime.combine(availability.departure_date, availability.return_time)
        duration = return_time - departure
        return int(duration.total_seconds() / 3600)


class BlockSeatsSerializer(serializers.ModelSerializer):
    """Сериализатор для блокировки мест капитаном (внешняя продажа)"""
    trip_id = serializers.IntegerField(write_only=True, help_text='ID рейса из BoatAvailability')
    number_of_people = serializers.IntegerField(write_only=True, min_value=1)
    
    class Meta:
        model = Booking
        fields = (
            'id', 'trip_id', 'number_of_people',
            'start_datetime', 'end_datetime', 'created_at'
        )
        read_only_fields = ('id', 'start_datetime', 'end_datetime', 'created_at')
    
    def validate_trip_id(self, value):
        """Проверяет существование рейса и права доступа"""
        try:
            availability = BoatAvailability.objects.get(id=value, is_active=True)
        except BoatAvailability.DoesNotExist:
            raise serializers.ValidationError("Рейс не найден")
        
        # Проверяем, что пользователь - владелец судна
        user = self.context['request'].user
        if user.role != User.Role.BOAT_OWNER or availability.boat.owner != user:
            raise serializers.ValidationError("Вы можете блокировать места только на своих судах")
        
        return value
    
    def validate_number_of_people(self, value):
        """Проверяет количество людей"""
        if value < 1:
            raise serializers.ValidationError("Количество людей должно быть не менее 1")
        if value > 11:
            raise serializers.ValidationError("Максимальное количество людей - 11")
        return value
    
    def validate(self, attrs):
        """Валидация данных блокировки"""
        trip_id = attrs.get('trip_id')
        number_of_people = attrs.get('number_of_people')
        
        if not trip_id or not number_of_people:
            raise serializers.ValidationError("Рейс и количество мест обязательны для заполнения")
        
        # Получаем рейс
        try:
            availability = BoatAvailability.objects.get(id=trip_id, is_active=True)
        except BoatAvailability.DoesNotExist:
            raise serializers.ValidationError("Рейс не найден")
        
        boat = availability.boat
        
        # Проверяем, что количество мест не превышает вместимость
        if number_of_people > boat.capacity:
            raise serializers.ValidationError(
                f"Количество мест ({number_of_people}) превышает вместимость судна ({boat.capacity})"
            )
        
        # Создаем datetime для проверки пересечений
        start_datetime = datetime.combine(availability.departure_date, availability.departure_time)
        end_datetime = datetime.combine(availability.departure_date, availability.return_time)
        
        # Если время возвращения меньше времени отправления, значит рейс через полночь
        if availability.return_time < availability.departure_time:
            end_datetime += timedelta(days=1)
        
        # Проверяем доступность мест (учитываем обычные бронирования и другие блокировки)
        existing_bookings = Booking.objects.filter(
            boat=boat,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            start_datetime__lt=end_datetime,
            end_datetime__gt=start_datetime
        )
        
        # Подсчитываем заблокированные места капитаном
        blocked_bookings = Booking.objects.filter(
            boat=boat,
            customer__isnull=True,
            guide__isnull=True,
            notes__startswith="[БЛОКИРОВКА]",
            status=Booking.Status.CONFIRMED,
            start_datetime__lt=end_datetime,
            end_datetime__gt=start_datetime
        )
        
        booked_places = sum(booking.number_of_people for booking in existing_bookings)
        blocked_places = sum(booking.number_of_people for booking in blocked_bookings)
        available_places = boat.capacity - booked_places - blocked_places
        
        if number_of_people > available_places:
            raise serializers.ValidationError(
                f"Недостаточно свободных мест. Доступно: {available_places}, запрошено: {number_of_people}"
            )
        
        return attrs
    
    def create(self, validated_data):
        """Создает блокировку мест (Booking с признаками блокировки)"""
        trip_id = validated_data.pop('trip_id')
        number_of_people = validated_data.pop('number_of_people')
        
        # Получаем рейс
        availability = BoatAvailability.objects.get(id=trip_id)
        boat = availability.boat
        
        # Создаем datetime
        start_datetime = datetime.combine(availability.departure_date, availability.departure_time)
        end_datetime = datetime.combine(availability.departure_date, availability.return_time)
        
        # Если время возвращения меньше времени отправления, значит рейс через полночь
        if availability.return_time < availability.departure_time:
            end_datetime += timedelta(days=1)
        
        # Рассчитываем длительность
        duration = end_datetime - start_datetime
        duration_hours = int(duration.total_seconds() / 3600)
        
        # Формируем notes с префиксом блокировки
        notes = "[БЛОКИРОВКА] Продано напрямую"
        
        # Создаем блокировку как Booking
        booking = Booking.objects.create(
            boat=boat,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            duration_hours=duration_hours,
            event_type="Блокировка мест (внешняя продажа)",
            guide=None,
            customer=None,
            number_of_people=number_of_people,
            guest_name="Блокировка мест",
            guest_phone="",
            price_per_person=Decimal('0'),
            original_price=Decimal('0'),
            discount_percent=Decimal('0'),
            discount_amount=Decimal('0'),
            total_price=Decimal('0'),
            deposit=Decimal('0'),
            remaining_amount=Decimal('0'),
            payment_method=Booking.PaymentMethod.CASH,
            status=Booking.Status.CONFIRMED,
            notes=notes
        )
        
        return booking

