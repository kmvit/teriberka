from django.contrib import admin
from .models import (
    Dock, Boat, BoatImage, Feature, BoatPricing, SailingZone,
    BoatAvailability, GuideBoatDiscount
)


class BoatImageInline(admin.TabularInline):
    model = BoatImage
    extra = 1
    fields = ('image', 'order')




class BoatPricingInline(admin.TabularInline):
    model = BoatPricing
    extra = 0
    fields = ('duration_hours', 'price_per_person')
    max_num = 2


@admin.register(Dock)
class DockAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Основная информация', {
            'fields': ('name', 'yandex_location_url', 'description')
        }),
        ('Статус', {
            'fields': ('is_active',)
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(Boat)
class BoatAdmin(admin.ModelAdmin):
    list_display = ('name', 'boat_type', 'owner', 'capacity', 'is_active', 'created_at')
    list_filter = ('is_active', 'boat_type', 'created_at', 'owner')
    search_fields = ('name', 'description', 'owner__email')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [BoatImageInline, BoatPricingInline]
    filter_horizontal = ('features',)
    fieldsets = (
        ('Основная информация', {
            'fields': ('name', 'boat_type', 'owner', 'description')
        }),
        ('Характеристики', {
            'fields': ('capacity', 'dock', 'features')
        }),
        ('Статус', {
            'fields': ('is_active',)
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(BoatImage)
class BoatImageAdmin(admin.ModelAdmin):
    list_display = ('boat', 'order', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('boat__name',)
    ordering = ('boat', 'order')


@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name',)
    readonly_fields = ('created_at',)
    fieldsets = (
        ('Основная информация', {
            'fields': ('name',)
        }),
        ('Статус', {
            'fields': ('is_active',)
        }),
        ('Даты', {
            'fields': ('created_at',)
        }),
    )


@admin.register(BoatPricing)
class BoatPricingAdmin(admin.ModelAdmin):
    list_display = ('boat', 'duration_hours', 'price_per_person')
    list_filter = ('duration_hours',)
    search_fields = ('boat__name',)


@admin.register(SailingZone)
class SailingZoneAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at',)
    filter_horizontal = ('boats',)
    fieldsets = (
        ('Основная информация', {
            'fields': ('name', 'description', 'boats')
        }),
        ('Статус', {
            'fields': ('is_active',)
        }),
        ('Даты', {
            'fields': ('created_at',)
        }),
    )


@admin.register(BoatAvailability)
class BoatAvailabilityAdmin(admin.ModelAdmin):
    list_display = ('boat', 'departure_date', 'departure_time', 'return_time', 'is_active')
    list_filter = ('is_active', 'departure_date', 'boat')
    search_fields = ('boat__name',)
    date_hierarchy = 'departure_date'
    fieldsets = (
        ('Основная информация', {
            'fields': ('boat',)
        }),
        ('Дата и время выхода', {
            'fields': ('departure_date', 'departure_time', 'return_time')
        }),
        ('Статус', {
            'fields': ('is_active',)
        }),
    )


@admin.register(GuideBoatDiscount)
class GuideBoatDiscountAdmin(admin.ModelAdmin):
    list_display = ('guide', 'boat_owner', 'discount_percent', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at', 'boat_owner')
    search_fields = ('guide__email', 'boat_owner__email')
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
