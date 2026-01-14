from rest_framework import serializers
from decimal import Decimal
from datetime import datetime, timedelta
from django.utils import timezone
from .models import Booking
from apps.boats.models import Boat, BoatAvailability, BoatPricing
from apps.accounts.models import User
from apps.payments.serializers import PaymentSerializer


class BoatShortSerializer(serializers.ModelSerializer):
    """Краткая информация о судне для бронирования"""
    boat_type_display = serializers.CharField(source='get_boat_type_display', read_only=True)
    
    class Meta:
        model = Boat
        fields = ('id', 'name', 'boat_type', 'boat_type_display', 'capacity')


class BookingListSerializer(serializers.ModelSerializer):
    """Сериализатор для списка бронирований"""
    boat = BoatShortSerializer(read_only=True)
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
            'event_type', 'number_of_people', 'guest_name', 'guest_phone',
            'price_per_person', 'total_price', 'deposit', 'remaining_amount',
            'status', 'status_display', 'payment_method', 'payment_method_display',
            'is_guide_booking', 'guide_commission_per_person', 'guide_total_commission',
            'payments', 'created_at'
        )
        read_only_fields = ('id', 'created_at')
    
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
        
        # Проверяем пересечения с существующими бронированиями
        existing_bookings = Booking.objects.filter(
            boat=boat,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            start_datetime__lt=end_datetime,
            end_datetime__gt=start_datetime
        )
        
        booked_places = sum(booking.number_of_people for booking in existing_bookings)
        available_places = boat.capacity - booked_places
        
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
        
        # Создаем бронирование
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
            status=Booking.Status.PENDING
        )
        
        return booking
    
    def _calculate_duration(self, availability):
        """Рассчитывает длительность в часах"""
        departure = datetime.combine(availability.departure_date, availability.departure_time)
        return_time = datetime.combine(availability.departure_date, availability.return_time)
        duration = return_time - departure
        return int(duration.total_seconds() / 3600)

