from django.contrib import admin
from .models import Trip


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ('boat', 'start_datetime', 'end_datetime', 'event_type', 'guide', 'status', 'price_per_person')
    list_filter = ('status', 'boat', 'start_datetime', 'guide')
    search_fields = ('boat__name', 'event_type', 'guide__username')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'start_datetime'
    fieldsets = (
        ('Основная информация', {
            'fields': ('boat', 'event_type', 'guide')
        }),
        ('Время', {
            'fields': ('start_datetime', 'end_datetime', 'duration_hours')
        }),
        ('Цена и вместимость', {
            'fields': ('price_per_person', 'max_capacity')
        }),
        ('Статус', {
            'fields': ('status',)
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at')
        }),
    )
