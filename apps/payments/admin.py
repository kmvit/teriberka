from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = [
        'order_id',
        'booking',
        'payment_type',
        'amount',
        'status',
        'created_at',
        'paid_at'
    ]
    list_filter = ['payment_type', 'status', 'created_at']
    search_fields = ['order_id', 'payment_id', 'booking__guest_name']
    readonly_fields = [
        'payment_id',
        'order_id',
        'payment_url',
        'raw_response',
        'created_at',
        'updated_at',
        'paid_at'
    ]
    fieldsets = (
        ('Основная информация', {
            'fields': ('booking', 'payment_type', 'amount', 'status')
        }),
        ('Данные Т-Банка', {
            'fields': ('payment_id', 'order_id', 'payment_url')
        }),
        ('URLs', {
            'fields': ('success_url', 'fail_url'),
            'classes': ('collapse',)
        }),
        ('Ошибки', {
            'fields': ('error_code', 'error_message'),
            'classes': ('collapse',)
        }),
        ('Отладка', {
            'fields': ('raw_response',),
            'classes': ('collapse',)
        }),
        ('Временные метки', {
            'fields': ('created_at', 'updated_at', 'paid_at'),
            'classes': ('collapse',)
        }),
    )
