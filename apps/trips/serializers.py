from rest_framework import serializers
from datetime import datetime
from decimal import Decimal
from apps.boats.models import BoatAvailability, Boat, BoatPricing, GuideBoatDiscount
from apps.boats.serializers import BoatShortSerializer, BoatDetailSerializer, SailingZoneSerializer as RouteSerializer
from apps.accounts.models import User


class AvailableTripSerializer(serializers.Serializer):
    """Сериализатор для доступных рейсов"""
    id = serializers.IntegerField(source='availability.id', read_only=True)
    boat = BoatShortSerializer(source='availability.boat', read_only=True)
    departure_date = serializers.DateField(source='availability.departure_date', read_only=True)
    departure_time = serializers.TimeField(source='availability.departure_time', read_only=True)
    return_time = serializers.TimeField(source='availability.return_time', read_only=True)
    duration_hours = serializers.IntegerField(read_only=True)
    available_spots = serializers.IntegerField(read_only=True)
    price_per_person = serializers.SerializerMethodField()
    guide_commission_per_person = serializers.SerializerMethodField()
    guide_total_commission = serializers.SerializerMethodField()
    route = serializers.SerializerMethodField()
    
    def get_price_per_person(self, obj):
        """Возвращает цену за человека с учетом скидки для гидов"""
        base_price = Decimal(str(obj.get('price_per_person', 0)))
        request = self.context.get('request')
        
        # Если пользователь не авторизован, возвращаем базовую цену
        if not request or not request.user.is_authenticated:
            return base_price
        
        user = request.user
        # Если пользователь не является верифицированным гидом, возвращаем базовую цену
        if user.role != User.Role.GUIDE or not user.is_verified:
            return base_price
        
        # Ищем скидку для данного гида и владельца судна
        boat = obj['availability'].boat
        boat_owner = boat.owner
        
        try:
            discount_obj = GuideBoatDiscount.objects.get(
                guide=user,
                boat_owner=boat_owner,
                is_active=True
            )
            # Применяем скидку
            discount_percent = discount_obj.discount_percent
            discounted_price = base_price * (1 - discount_percent / 100)
            return discounted_price.quantize(Decimal('0.01'))
        except GuideBoatDiscount.DoesNotExist:
            # Если скидка не найдена, возвращаем базовую цену
            return base_price
    
    def get_guide_commission_per_person(self, obj):
        """Возвращает комиссию гида за одного туриста (только для верифицированных гидов)"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        user = request.user
        if user.role == User.Role.GUIDE and user.is_verified:
            # TODO: Логика расчета комиссии из модели GuideCommission
            # Пока возвращаем фиксированную сумму
            return float(500)
        return None
    
    def get_guide_total_commission(self, obj):
        """Возвращает общую комиссию гида (если указано number_of_people)"""
        commission_per_person = self.get_guide_commission_per_person(obj)
        if commission_per_person:
            number_of_people = self.context.get('request').query_params.get('number_of_people')
            if number_of_people:
                try:
                    return float(commission_per_person * int(number_of_people))
                except (ValueError, TypeError):
                    pass
        return None
    
    def get_route(self, obj):
        """Возвращает маршруты судна"""
        boat = obj['availability'].boat
        routes = boat.sailing_zones.filter(is_active=True)
        return RouteSerializer(routes, many=True).data


class TripDetailSerializer(serializers.Serializer):
    """Сериализатор для детальной информации о рейсе"""
    id = serializers.IntegerField(source='availability.id', read_only=True)
    boat = serializers.SerializerMethodField()
    departure_date = serializers.DateField(source='availability.departure_date', read_only=True)
    departure_time = serializers.TimeField(source='availability.departure_time', read_only=True)
    return_time = serializers.TimeField(source='availability.return_time', read_only=True)
    duration_hours = serializers.IntegerField(read_only=True)
    available_spots = serializers.IntegerField(read_only=True)
    price_per_person = serializers.SerializerMethodField()
    route = serializers.SerializerMethodField()
    guide_commission_per_person = serializers.SerializerMethodField()
    
    def get_price_per_person(self, obj):
        """Возвращает цену за человека с учетом скидки для гидов"""
        base_price = Decimal(str(obj.get('price_per_person', 0)))
        request = self.context.get('request')
        
        # Если пользователь не авторизован, возвращаем базовую цену
        if not request or not request.user.is_authenticated:
            return base_price
        
        user = request.user
        # Если пользователь не является верифицированным гидом, возвращаем базовую цену
        if user.role != User.Role.GUIDE or not user.is_verified:
            return base_price
        
        # Ищем скидку для данного гида и владельца судна
        boat = obj['availability'].boat
        boat_owner = boat.owner
        
        try:
            discount_obj = GuideBoatDiscount.objects.get(
                guide=user,
                boat_owner=boat_owner,
                is_active=True
            )
            # Применяем скидку
            discount_percent = discount_obj.discount_percent
            discounted_price = base_price * (1 - discount_percent / 100)
            return discounted_price.quantize(Decimal('0.01'))
        except GuideBoatDiscount.DoesNotExist:
            # Если скидка не найдена, возвращаем базовую цену
            return base_price
    
    def get_boat(self, obj):
        """Возвращает полную информацию о судне"""
        boat = obj['availability'].boat
        return BoatDetailSerializer(boat, context=self.context).data
    
    def get_route(self, obj):
        """Возвращает маршруты судна"""
        boat = obj['availability'].boat
        routes = boat.sailing_zones.filter(is_active=True)
        return RouteSerializer(routes, many=True).data
    
    def get_guide_commission_per_person(self, obj):
        """Возвращает комиссию гида за одного туриста (только для верифицированных гидов)"""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        user = request.user
        if user.role == User.Role.GUIDE and user.is_verified:
            # TODO: Логика расчета комиссии из модели GuideCommission
            # Пока возвращаем фиксированную сумму
            return float(500)
        return None

