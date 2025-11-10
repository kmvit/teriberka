from django.contrib import admin
from .models import Boat, BoatAvailability, GuideBoatDiscount


@admin.register(Boat)
class BoatAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'capacity', 'base_price_per_person', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at', 'owner')
    search_fields = ('name', 'description', 'owner__username', 'owner__email')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Основная информация', {
            'fields': ('name', 'owner', 'description', 'image')
        }),
        ('Характеристики', {
            'fields': ('capacity', 'base_price_per_person')
        }),
        ('Статус', {
            'fields': ('is_active',)
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(BoatAvailability)
class BoatAvailabilityAdmin(admin.ModelAdmin):
    list_display = ('boat', 'day_of_week', 'specific_date', 'start_time', 'end_time', 'is_active')
    list_filter = ('is_active', 'day_of_week', 'boat')
    search_fields = ('boat__name',)
    fieldsets = (
        ('Основная информация', {
            'fields': ('boat',)
        }),
        ('Расписание', {
            'fields': ('day_of_week', 'specific_date', 'start_time', 'end_time')
        }),
        ('Ограничения', {
            'fields': ('min_duration_hours', 'max_duration_hours')
        }),
        ('Статус', {
            'fields': ('is_active',)
        }),
    )


@admin.register(GuideBoatDiscount)
class GuideBoatDiscountAdmin(admin.ModelAdmin):
    list_display = ('guide', 'boat_owner', 'discount_percent', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at', 'boat_owner')
    search_fields = ('guide__username', 'guide__email', 'boat_owner__username', 'boat_owner__email')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Основная информация', {
            'fields': ('guide', 'boat_owner', 'discount_percent')
        }),
        ('Статус', {
            'fields': ('is_active',)
        }),
        ('Дополнительно', {
            'fields': ('notes',)
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at')
        }),
    )
