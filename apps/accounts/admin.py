from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import User, BoatOwnerVerification


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'username', 'email', 'first_name', 'last_name', 'role', 'phone',
        'verification_status', 'is_staff', 'is_active', 'created_at'
    )
    list_filter = ('role', 'verification_status', 'is_staff', 'is_active', 'created_at')
    search_fields = ('username', 'email', 'first_name', 'last_name', 'phone')
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Дополнительная информация', {
            'fields': ('role', 'phone',)
        }),
        ('Верификация', {
            'fields': ('verification_status', 'verification_rejection_reason')
        }),
    )
    
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Дополнительная информация', {
            'fields': ('role', 'phone', 'email', 'first_name', 'last_name')
        }),
    )
    
    actions = ['approve_verification', 'reject_verification']
    
    def approve_verification(self, request, queryset):
        """Одобрить верификацию выбранных пользователей"""
        count = 0
        for user in queryset.filter(role=User.Role.BOAT_OWNER, verification_status=User.VerificationStatus.PENDING):
            user.verification_status = User.VerificationStatus.VERIFIED
            user.is_active = True
            if hasattr(user, 'verification'):
                user.verification.reviewed_by = request.user
                user.verification.save()
            user.save()
            count += 1
        self.message_user(request, f'Верифицировано пользователей: {count}')
    approve_verification.short_description = 'Одобрить верификацию'
    
    def reject_verification(self, request, queryset):
        """Отклонить верификацию выбранных пользователей"""
        count = 0
        for user in queryset.filter(role=User.Role.BOAT_OWNER, verification_status=User.VerificationStatus.PENDING):
            user.verification_status = User.VerificationStatus.REJECTED
            user.is_active = False
            if hasattr(user, 'verification'):
                user.verification.reviewed_by = request.user
                user.verification.save()
            user.save()
            count += 1
        self.message_user(request, f'Отклонено пользователей: {count}')
    reject_verification.short_description = 'Отклонить верификацию'


@admin.register(BoatOwnerVerification)
class BoatOwnerVerificationAdmin(admin.ModelAdmin):
    list_display = (
        'user', 'verification_status', 'submitted_at', 'reviewed_at', 'reviewed_by', 'view_documents'
    )
    list_filter = ('submitted_at', 'reviewed_at', 'user__verification_status')
    search_fields = ('user__username', 'user__email', 'user__first_name', 'user__last_name')
    readonly_fields = ('submitted_at', 'reviewed_at', 'reviewed_by', 'view_documents')
    fieldsets = (
        ('Пользователь', {
            'fields': ('user',)
        }),
        ('Документы', {
            'fields': ('passport_scan', 'gims_documents', 'insurance', 'boat_photos', 'view_documents')
        }),
        ('Модерация', {
            'fields': ('submitted_at', 'reviewed_at', 'reviewed_by', 'admin_notes')
        }),
    )
    
    def verification_status(self, obj):
        return obj.user.get_verification_status_display()
    verification_status.short_description = 'Статус верификации'
    
    def view_documents(self, obj):
        """Ссылки на документы"""
        links = []
        if obj.passport_scan:
            links.append(f'<a href="{obj.passport_scan.url}" target="_blank">Паспорт</a>')
        if obj.gims_documents:
            links.append(f'<a href="{obj.gims_documents.url}" target="_blank">ГИМС</a>')
        if obj.insurance:
            links.append(f'<a href="{obj.insurance.url}" target="_blank">Страховка</a>')
        return format_html(' | '.join(links)) if links else 'Нет документов'
    view_documents.short_description = 'Документы'
    
    def save_model(self, request, obj, form, change):
        """Автоматически устанавливаем reviewed_by при сохранении"""
        if change and not obj.reviewed_by:
            obj.reviewed_by = request.user
        super().save_model(request, obj, form, change)

