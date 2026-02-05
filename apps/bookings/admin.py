from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html
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
        'created_at',
        'days_old'
    )
    list_filter = ('status', 'payment_method', 'boat', 'guide', 'created_at', 'start_datetime')
    search_fields = ('guest_name', 'guest_phone', 'customer__email', 'guide__email', 'boat__name', 'event_type')
    readonly_fields = ('original_price', 'discount_amount', 'remaining_amount', 'created_at', 'updated_at')
    date_hierarchy = 'start_datetime'
    actions = ['delete_unpaid_reserved_bookings']
    
    def days_old(self, obj):
        """Показывает сколько дней прошло с момента создания"""
        if obj.created_at:
            days = (timezone.now() - obj.created_at).days
            if obj.status == Booking.Status.RESERVED:
                # Для неоплаченных бронирований показываем красным
                return format_html(
                    '<span style="color: red; font-weight: bold;">{} дн.</span>',
                    days
                )
            return f"{days} дн."
        return "-"
    days_old.short_description = "Дней с создания"
    
    def delete_unpaid_reserved_bookings(self, request, queryset):
        """Массовое удаление неоплаченных бронирований (RESERVED)"""
        # Фильтруем только RESERVED бронирования
        reserved_bookings = queryset.filter(status=Booking.Status.RESERVED)
        count = reserved_bookings.count()
        reserved_bookings.delete()
        self.message_user(
            request,
            f'Удалено {count} неоплаченных бронирований (RESERVED)'
        )
    delete_unpaid_reserved_bookings.short_description = "Удалить выбранные неоплаченные бронирования (RESERVED)"
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
