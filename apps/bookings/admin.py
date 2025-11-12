from django.contrib import admin
from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'guest_name',
        'guest_phone',
        'boat',
        'guide',
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
