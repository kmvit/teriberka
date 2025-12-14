from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from django import forms
from .models import User, UserVerification, VerificationDocument


class UserVerificationAdminForm(forms.ModelForm):
    """Форма для админки верификации с возможностью изменения статуса"""
    change_status = forms.ChoiceField(
        choices=[
            ('keep', 'Оставить текущий статус'),
            ('approve', '✓ Одобрить'),
            ('reject', '✗ Отклонить'),
        ],
        required=False,
        label='Изменить статус',
        widget=forms.RadioSelect
    )
    
    class Meta:
        model = UserVerification
        fields = '__all__'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'email', 'first_name', 'last_name', 'role', 'phone',
        'verification_status', 'is_staff', 'is_active', 'created_at'
    )
    list_filter = ('role', 'verification_status', 'is_staff', 'is_active', 'created_at')
    search_fields = ('email', 'first_name', 'last_name', 'phone')
    ordering = ('email',)
    readonly_fields = ('avatar_preview',)
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Персональная информация', {'fields': ('first_name', 'last_name', 'phone', 'avatar', 'avatar_preview')}),
        ('Разрешения', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Важные даты', {'fields': ('last_login', 'date_joined')}),
        ('Дополнительная информация', {
            'fields': ('role',)
        }),
        ('Верификация', {
            'fields': ('verification_status', 'verification_rejection_reason')
        }),
    )
    
    def avatar_preview(self, obj):
        """Превью аватарки в админке"""
        if obj.avatar:
            return format_html(
                '<img src="{}" style="max-width: 100px; max-height: 100px; border-radius: 50%; object-fit: cover;" />',
                obj.avatar.url
            )
        return format_html('<span style="color: #999;">Нет аватарки</span>')
    avatar_preview.short_description = 'Аватарка'
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2'),
        }),
        ('Персональная информация', {
            'fields': ('first_name', 'last_name', 'phone')
        }),
        ('Дополнительная информация', {
            'fields': ('role',)
        }),
    )
    
    actions = ['approve_verification', 'reject_verification']
    
    def approve_verification(self, request, queryset):
        """Одобрить верификацию выбранных пользователей"""
        count = 0
        for user in queryset.filter(
            role__in=[User.Role.BOAT_OWNER, User.Role.GUIDE],
            verification_status=User.VerificationStatus.PENDING
        ):
            user.verification_status = User.VerificationStatus.VERIFIED
            user.is_active = True
            if hasattr(user, 'verification'):
                from django.utils import timezone
                user.verification.reviewed_by = request.user
                user.verification.reviewed_at = timezone.now()
                user.verification.save()
            user.save()
            count += 1
        self.message_user(request, f'Верифицировано пользователей: {count}')
    approve_verification.short_description = 'Одобрить верификацию'
    
    def reject_verification(self, request, queryset):
        """Отклонить верификацию выбранных пользователей"""
        count = 0
        for user in queryset.filter(
            role__in=[User.Role.BOAT_OWNER, User.Role.GUIDE],
            verification_status=User.VerificationStatus.PENDING
        ):
            user.verification_status = User.VerificationStatus.REJECTED
            if hasattr(user, 'verification'):
                from django.utils import timezone
                user.verification.reviewed_by = request.user
                user.verification.reviewed_at = timezone.now()
                user.verification.save()
            user.save()
            count += 1
        self.message_user(request, f'Отклонено пользователей: {count}')
    reject_verification.short_description = 'Отклонить верификацию'


class VerificationDocumentInline(admin.TabularInline):
    """Inline для документов верификации"""
    model = VerificationDocument
    extra = 0
    readonly_fields = ('uploaded_at', 'view_file')
    fields = ('file', 'view_file', 'uploaded_at')
    
    def view_file(self, obj):
        if obj.id and obj.file:
            return format_html('<a href="{}" target="_blank">Просмотр</a>', obj.file.url)
        return '-'
    view_file.short_description = 'Просмотр'


@admin.register(UserVerification)
class UserVerificationAdmin(admin.ModelAdmin):
    form = UserVerificationAdminForm
    list_display = (
        'user', 'user_role', 'verification_status',
        'submitted_at', 'reviewed_at', 'reviewed_by', 'documents_count'
    )
    list_filter = ('submitted_at', 'reviewed_at', 'user__verification_status', 'user__role')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')
    readonly_fields = ('submitted_at', 'reviewed_at', 'reviewed_by', 'current_status')
    inlines = [VerificationDocumentInline]
    fieldsets = (
        ('Пользователь', {
            'fields': ('user', 'current_status')
        }),
        ('Изменение статуса', {
            'fields': ('change_status',),
            'description': 'Выберите действие для изменения статуса верификации пользователя'
        }),
        ('Модерация', {
            'fields': ('submitted_at', 'reviewed_at', 'reviewed_by', 'admin_notes')
        }),
    )
    actions = ['approve_selected', 'reject_selected']
    
    def current_status(self, obj):
        """Текущий статус верификации"""
        if not obj:
            return '-'
        status = obj.user.verification_status
        if status == User.VerificationStatus.VERIFIED:
            return format_html('<span style="color: #28a745; font-weight: bold;">✓ Верифицирован</span>')
        elif status == User.VerificationStatus.REJECTED:
            return format_html('<span style="color: #dc3545; font-weight: bold;">✗ Отклонен</span>')
        elif status == User.VerificationStatus.PENDING:
            return format_html('<span style="color: #ffc107; font-weight: bold;">⏳ На проверке</span>')
        return format_html('<span style="color: #6c757d;">Не верифицирован</span>')
    current_status.short_description = 'Текущий статус'
    
    def user_role(self, obj):
        return obj.user.get_role_display()
    user_role.short_description = 'Роль'
    
    def verification_status(self, obj):
        return obj.user.get_verification_status_display()
    verification_status.short_description = 'Статус верификации'
    
    def documents_count(self, obj):
        """Количество документов"""
        return obj.documents.count()
    documents_count.short_description = 'Документов'
    
    def approve_selected(self, request, queryset):
        """Массовое одобрение верификаций"""
        from django.utils import timezone
        count = 0
        for verification in queryset:
            if verification.user.verification_status != User.VerificationStatus.VERIFIED:
                verification.user.verification_status = User.VerificationStatus.VERIFIED
                verification.user.is_active = True
                verification.user.save()
                
                verification.reviewed_by = request.user
                verification.reviewed_at = timezone.now()
                verification.save()
                count += 1
        self.message_user(request, f'Одобрено верификаций: {count}')
    approve_selected.short_description = 'Одобрить выбранные верификации'
    
    def reject_selected(self, request, queryset):
        """Массовое отклонение верификаций"""
        from django.utils import timezone
        count = 0
        for verification in queryset:
            if verification.user.verification_status != User.VerificationStatus.REJECTED:
                verification.user.verification_status = User.VerificationStatus.REJECTED
                verification.user.save()
                
                verification.reviewed_by = request.user
                verification.reviewed_at = timezone.now()
                verification.save()
                count += 1
        self.message_user(request, f'Отклонено верификаций: {count}')
    reject_selected.short_description = 'Отклонить выбранные верификации'
    
    def save_model(self, request, obj, form, change):
        """Автоматически устанавливаем reviewed_by при сохранении и обрабатываем изменение статуса"""
        if change:
            from django.utils import timezone
            
            # Обрабатываем изменение статуса из формы
            change_status = form.cleaned_data.get('change_status', 'keep')
            if change_status == 'approve' and obj.user.verification_status != User.VerificationStatus.VERIFIED:
                obj.user.verification_status = User.VerificationStatus.VERIFIED
                obj.user.is_active = True
                obj.user.save()
                obj.reviewed_by = request.user
                obj.reviewed_at = timezone.now()
            elif change_status == 'reject' and obj.user.verification_status != User.VerificationStatus.REJECTED:
                obj.user.verification_status = User.VerificationStatus.REJECTED
                obj.user.save()
                obj.reviewed_by = request.user
                obj.reviewed_at = timezone.now()
            
            if not obj.reviewed_by:
                obj.reviewed_by = request.user
                obj.reviewed_at = timezone.now()
        
        super().save_model(request, obj, form, change)

