from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    """Сериализатор для платежа"""
    
    payment_type_display = serializers.CharField(source='get_payment_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_paid = serializers.BooleanField(read_only=True)
    is_failed = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id',
            'booking',
            'payment_id',
            'order_id',
            'amount',
            'payment_type',
            'payment_type_display',
            'status',
            'status_display',
            'payment_url',
            'error_code',
            'error_message',
            'is_paid',
            'is_failed',
            'created_at',
            'updated_at',
            'paid_at'
        ]
        read_only_fields = [
            'payment_id',
            'order_id',
            'payment_url',
            'error_code',
            'error_message',
            'created_at',
            'updated_at',
            'paid_at'
        ]


class PaymentStatusSerializer(serializers.Serializer):
    """Сериализатор для проверки статуса платежа"""
    
    payment_id = serializers.CharField()
    status = serializers.CharField()
    status_display = serializers.CharField()
    is_paid = serializers.BooleanField()
    is_failed = serializers.BooleanField()
