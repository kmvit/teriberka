from django.contrib import admin
from .models import Booking, PromoCode


@admin.register(PromoCode)
class PromoCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_amount', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('code',)
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Основная информация', {
            'fields': ('code', 'discount_amount', 'is_active')
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'guest_name',
        'guest_phone',
        'boat',
        'guide',
        'promo_code',
        'start_datetime',
        'event_type',
        'number_of_people',
        'original_price',
        'discount_percent',
        'total_price',
        'deposit',
        'remaining_amount',
        'status',
        'created_at'
    )
    list_filter = ('status', 'payment_method', 'boat', 'guide', 'created_at', 'start_datetime')
    search_fields = ('guest_name', 'guest_phone', 'customer__email', 'guide__email', 'boat__name', 'event_type')
    readonly_fields = ('original_price', 'discount_amount', 'remaining_amount', 'created_at', 'updated_at')
    date_hierarchy = 'start_datetime'
    fieldsets = (
        ('Основная информация', {
            'fields': ('boat', 'guide', 'customer', 'guest_name', 'guest_phone', 'number_of_people')
        }),
        ('Время и мероприятие', {
            'fields': ('start_datetime', 'end_datetime', 'duration_hours', 'event_type')
        }),
        ('Финансы', {
            'fields': (
                'price_per_person',
                'promo_code',
                'original_price',
                'discount_percent',
                'discount_amount',
                'total_price',
                'deposit',
                'remaining_amount',
                'payment_method'
            )
        }),
        ('Статус', {
            'fields': ('status',)
        }),
        ('Дополнительно', {
            'fields': ('notes',)
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at')
        }),
    )
