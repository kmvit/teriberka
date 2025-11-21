"""
Схемы OpenAPI для документации API endpoints в приложении accounts.

Этот модуль содержит декораторы и схемы для drf-spectacular,
которые используются для генерации Swagger/OpenAPI документации.
"""
from drf_spectacular.utils import extend_schema, OpenApiResponse

from .serializers import (
    UserLoginSerializer,
    LoginResponseSerializer,
    UserRegistrationSerializer,
    UserSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)


# Схемы для эндпоинта логина
login_schema = extend_schema(
    request=UserLoginSerializer,
    responses={
        200: LoginResponseSerializer,
        400: OpenApiResponse(
            description='Ошибка валидации',
            examples=[
                {
                    "email": ["Обязательное поле."],
                    "password": ["Обязательное поле."]
                },
                {
                    "non_field_errors": ["Неверный email или пароль"]
                },
                {
                    "non_field_errors": ["Ваш email не подтвержден. Пожалуйста, проверьте почту и перейдите по ссылке для подтверждения регистрации."]
                }
            ]
        ),
    },
    summary='Авторизация пользователя',
    description='Авторизация пользователя по email и паролю. Возвращает токен аутентификации и данные пользователя.',
    tags=['accounts']
)


# Схемы для эндпоинта регистрации
register_schema = extend_schema(
    request=UserRegistrationSerializer,
    responses={
        201: OpenApiResponse(
            description='Регистрация успешна',
            examples=[
                {
                    "message": "Регистрация успешна! На ваш email отправлено письмо с подтверждением. Пожалуйста, проверьте почту и перейдите по ссылке для активации аккаунта.",
                    "email": "user@example.com"
                }
            ]
        ),
        400: OpenApiResponse(
            description='Ошибка валидации',
            examples=[
                {
                    "email": ["Пользователь с таким email уже существует."],
                    "password": ["Это поле обязательно."]
                }
            ]
        ),
    },
    summary='Регистрация нового пользователя',
    description='Регистрация нового пользователя в системе. После регистрации на email будет отправлено письмо с подтверждением.',
    tags=['accounts']
)


# Схемы для эндпоинта запроса сброса пароля
password_reset_request_schema = extend_schema(
    request=PasswordResetRequestSerializer,
    responses={
        200: OpenApiResponse(
            description='Запрос на сброс пароля принят',
            examples=[
                {
                    "message": "Если пользователь с таким email существует, на него будет отправлено письмо с инструкциями по восстановлению пароля."
                }
            ]
        ),
        400: OpenApiResponse(
            description='Ошибка валидации',
            examples=[
                {
                    "email": ["Обязательное поле."]
                }
            ]
        ),
    },
    summary='Запрос на сброс пароля',
    description='Отправляет письмо с инструкциями по восстановлению пароля на указанный email.',
    tags=['accounts']
)


# Схемы для эндпоинта подтверждения сброса пароля
password_reset_confirm_schema = extend_schema(
    request=PasswordResetConfirmSerializer,
    responses={
        200: OpenApiResponse(
            description='Пароль успешно изменен',
            examples=[
                {
                    "message": "Пароль успешно изменен"
                }
            ]
        ),
        400: OpenApiResponse(
            description='Ошибка валидации',
            examples=[
                {
                    "token": ["Неверный или устаревший токен"],
                    "password": ["Пароль должен содержать минимум 8 символов."]
                }
            ]
        ),
    },
    summary='Подтверждение сброса пароля',
    description='Устанавливает новый пароль пользователя с использованием токена из письма.',
    tags=['accounts']
)


# Схема для эндпоинта профиля
profile_list_schema = extend_schema(
    responses={
        200: UserSerializer,
        401: OpenApiResponse(
            description='Не авторизован',
            examples=[
                {
                    "detail": "Учетные данные не были предоставлены."
                }
            ]
        ),
    },
    summary='Получить профиль пользователя',
    description='Возвращает профиль текущего авторизованного пользователя с дашбордом в зависимости от роли.',
    tags=['accounts']
)

profile_update_schema = extend_schema(
    request=UserSerializer,
    responses={
        200: UserSerializer,
        400: OpenApiResponse(
            description='Ошибка валидации',
            examples=[
                {
                    "email": ["Пользователь с таким email уже существует."]
                }
            ]
        ),
        401: OpenApiResponse(
            description='Не авторизован',
            examples=[
                {
                    "detail": "Учетные данные не были предоставлены."
                }
            ]
        ),
    },
    summary='Обновить профиль пользователя',
    description='Обновляет данные профиля текущего авторизованного пользователя.',
    tags=['accounts']
)


# Схема для legacy endpoint профиля (GET, PUT, PATCH через api_view)
profile_legacy_get_schema = extend_schema(
    methods=['GET'],
    responses={
        200: UserSerializer,
        401: OpenApiResponse(
            description='Не авторизован',
            examples=[
                {
                    "detail": "Учетные данные не были предоставлены."
                }
            ]
        ),
    },
    summary='Получить профиль пользователя',
    description='Возвращает профиль текущего авторизованного пользователя с дашбордом в зависимости от роли.',
    tags=['accounts']
)

profile_legacy_update_schema = extend_schema(
    methods=['PUT', 'PATCH'],
    request=UserSerializer,
    responses={
        200: UserSerializer,
        400: OpenApiResponse(
            description='Ошибка валидации',
            examples=[
                {
                    "email": ["Пользователь с таким email уже существует."]
                }
            ]
        ),
        401: OpenApiResponse(
            description='Не авторизован',
            examples=[
                {
                    "detail": "Учетные данные не были предоставлены."
                }
            ]
        ),
    },
    summary='Обновить профиль пользователя',
    description='Обновляет данные профиля текущего авторизованного пользователя.',
    tags=['accounts']
)
