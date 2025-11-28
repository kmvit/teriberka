#!/usr/bin/env python
"""
Скрипт для создания и настройки тестовых данных
Создает все необходимые данные, если их нет в БД, и устанавливает связи ManyToMany
"""
import os
import sys
import django
from datetime import datetime, date, time

# Настройка Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User
from apps.boats.models import Boat, SailingZone, Feature, BoatPricing, BoatAvailability

def create_or_get_feature(pk, name):
    """Создает или получает особенность"""
    feature, created = Feature.objects.get_or_create(
        pk=pk,
        defaults={
            'name': name,
            'is_active': True,
        }
    )
    if created:
        print(f"  ✓ Создана особенность ID {pk}: {name}")
    else:
        print(f"  ✓ Найдена особенность ID {pk}: {name}")
    return feature

def create_or_get_sailing_zone(pk, name, description):
    """Создает или получает маршрут"""
    zone, created = SailingZone.objects.get_or_create(
        pk=pk,
        defaults={
            'name': name,
            'description': description,
            'is_active': True,
        }
    )
    if created:
        print(f"  ✓ Создан маршрут ID {pk}: {name}")
    else:
        print(f"  ✓ Найден маршрут ID {pk}: {name}")
    return zone

def create_or_get_user(pk, email, first_name, last_name, phone, password):
    """Создает или получает пользователя"""
    try:
        # Сначала проверяем по pk
        user = User.objects.get(pk=pk)
        # Обновляем данные, если нужно
        user.email = email
        user.first_name = first_name
        user.last_name = last_name
        user.phone = phone
        user.role = 'boat_owner'
        user.verification_status = 'verified'
        user.set_password(password)
        user.save()
        print(f"  ✓ Обновлен пользователь ID {pk}: {email}")
    except User.DoesNotExist:
        try:
            # Проверяем по email
            user = User.objects.get(email=email)
            # Обновляем данные
            user.first_name = first_name
            user.last_name = last_name
            user.phone = phone
            user.role = 'boat_owner'
            user.verification_status = 'verified'
            user.set_password(password)
            user.save()
            print(f"  ✓ Обновлен пользователь: {email}")
        except User.DoesNotExist:
            # Создаем нового пользователя
            user = User.objects.create_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role='boat_owner',
                verification_status='verified',
                phone=phone,
                is_active=True,
                is_staff=False,
                is_superuser=False,
            )
            print(f"  ✓ Создан пользователь: {email} (ID: {user.pk})")
    return user

def create_or_get_boat(pk, name, boat_type, owner, capacity, description):
    """Создает или получает судно"""
    boat, created = Boat.objects.get_or_create(
        pk=pk,
        defaults={
            'name': name,
            'boat_type': boat_type,
            'owner': owner,
            'capacity': capacity,
            'description': description,
            'is_active': True,
        }
    )
    if created:
        print(f"  ✓ Создано судно ID {pk}: {name}")
    else:
        print(f"  ✓ Найдено судно ID {pk}: {name}")
    return boat

def create_or_get_pricing(boat, duration_hours, price_per_person):
    """Создает или получает цену"""
    pricing, created = BoatPricing.objects.get_or_create(
        boat=boat,
        duration_hours=duration_hours,
        defaults={
            'price_per_person': price_per_person,
        }
    )
    if created:
        print(f"    ✓ Создана цена: {duration_hours}ч - {price_per_person}₽")
    return pricing, created

def setup_test_data():
    """Создает и настраивает тестовые данные"""
    
    print("=" * 60)
    print("Создание и настройка тестовых данных")
    print("=" * 60)
    
    # 1. Создаем особенности
    print("\n1. Создание особенностей...")
    features = {}
    features[1] = create_or_get_feature(1, "Туалет на судне")
    features[2] = create_or_get_feature(2, "Теплые пледы")
    features[3] = create_or_get_feature(3, "Дождевики")
    features[4] = create_or_get_feature(4, "Чай и кофе")
    features[5] = create_or_get_feature(5, "Удочки для рыбалки")
    
    # 2. Создаем маршруты
    print("\n2. Создание маршрутов...")
    routes = {}
    routes[1] = create_or_get_sailing_zone(
        1, 
        "Поиски китов", 
        "Маршрут к местам обитания китов в Баренцевом море"
    )
    routes[2] = create_or_get_sailing_zone(
        2, 
        "Береговые скалы", 
        "Прогулка вдоль живописных скал Териберки"
    )
    routes[3] = create_or_get_sailing_zone(
        3, 
        "Рыбалка в открытом море", 
        "Маршрут для любителей рыбалки в открытом море"
    )
    
    # 3. Создаем пользователей-капитанов
    print("\n3. Создание пользователей-капитанов...")
    captains = [
        {
            'pk': 1,
            'email': 'captain1@teriberka.ru',
            'first_name': 'Иван',
            'last_name': 'Петров',
            'phone': '+79001234567',
            'password': 'captain123'
        },
        {
            'pk': 2,
            'email': 'captain2@teriberka.ru',
            'first_name': 'Сергей',
            'last_name': 'Иванов',
            'phone': '+79001234568',
            'password': 'captain123'
        },
        {
            'pk': 3,
            'email': 'captain3@teriberka.ru',
            'first_name': 'Алексей',
            'last_name': 'Сидоров',
            'phone': '+79001234569',
            'password': 'captain123'
        },
        {
            'pk': 4,
            'email': 'captain4@teriberka.ru',
            'first_name': 'Дмитрий',
            'last_name': 'Козлов',
            'phone': '+79001234570',
            'password': 'captain123'
        },
    ]
    
    users = {}
    for captain_data in captains:
        user = create_or_get_user(**captain_data)
        users[captain_data['pk']] = user
    
    # 4. Создаем суда
    print("\n4. Создание судов...")
    boats_data = [
        {
            'pk': 1,
            'name': 'Михаил',
            'boat_type': 'boat',
            'owner_pk': 1,
            'capacity': 11,
            'description': 'Надежный катер для морских прогулок. Идеально подходит для поиска китов и наблюдения за морскими обитателями.'
        },
        {
            'pk': 2,
            'name': 'Альбатрос',
            'boat_type': 'yacht',
            'owner_pk': 2,
            'capacity': 8,
            'description': 'Комфортабельная яхта для романтических прогулок и экскурсий вдоль береговых скал.'
        },
        {
            'pk': 3,
            'name': 'Баренцево',
            'boat_type': 'barkas',
            'owner_pk': 3,
            'capacity': 10,
            'description': 'Просторный баркас для рыбалки в открытом море. Оснащен всем необходимым для комфортной рыбалки.'
        },
        {
            'pk': 4,
            'name': 'Северный ветер',
            'boat_type': 'boat',
            'owner_pk': 4,
            'capacity': 11,
            'description': 'Быстрый катер для активных морских прогулок. Подходит для различных маршрутов.'
        },
    ]
    
    boats = {}
    for boat_data in boats_data:
        boat = create_or_get_boat(
            pk=boat_data['pk'],
            name=boat_data['name'],
            boat_type=boat_data['boat_type'],
            owner=users[boat_data['owner_pk']],
            capacity=boat_data['capacity'],
            description=boat_data['description']
        )
        boats[boat_data['pk']] = boat
    
    # 5. Создаем цены
    print("\n5. Создание цен...")
    pricing_data = [
        {'boat_pk': 1, 'duration': 2, 'price': 4000.00},
        {'boat_pk': 1, 'duration': 3, 'price': 5000.00},
        {'boat_pk': 2, 'duration': 2, 'price': 4500.00},
        {'boat_pk': 2, 'duration': 3, 'price': 5500.00},
        {'boat_pk': 3, 'duration': 2, 'price': 3500.00},
        {'boat_pk': 3, 'duration': 3, 'price': 4200.00},
        {'boat_pk': 4, 'duration': 2, 'price': 3800.00},
        {'boat_pk': 4, 'duration': 3, 'price': 4800.00},
    ]
    
    pricing_count = 0
    for pricing_info in pricing_data:
        pricing, created = create_or_get_pricing(
            boats[pricing_info['boat_pk']],
            pricing_info['duration'],
            pricing_info['price']
        )
        if created:
            pricing_count += 1
    
    if pricing_count > 0:
        print(f"  ✓ Создано {pricing_count} новых цен")
    else:
        print(f"  ✓ Все цены уже существуют")
    
    # 6. Настраиваем связи ManyToMany между судами и маршрутами
    print("\n6. Настройка связей между судами и маршрутами...")
    boats[1].sailing_zones.clear()
    boats[1].sailing_zones.add(routes[1])  # Михаил - поиски китов
    
    boats[2].sailing_zones.clear()
    boats[2].sailing_zones.add(routes[2])  # Альбатрос - береговые скалы
    
    boats[3].sailing_zones.clear()
    boats[3].sailing_zones.add(routes[3])  # Баренцево - рыбалка
    
    boats[4].sailing_zones.clear()
    boats[4].sailing_zones.add(routes[1], routes[2])  # Северный ветер - поиски китов и береговые скалы
    
    print("  ✓ Настроены связи между судами и маршрутами")
    
    # 7. Настраиваем связи ManyToMany между судами и особенностями
    print("\n7. Настройка связей между судами и особенностями...")
    boats[1].features.clear()
    boats[1].features.add(features[1], features[2], features[3], features[4])  # Михаил
    
    boats[2].features.clear()
    boats[2].features.add(features[1], features[2], features[4])  # Альбатрос
    
    boats[3].features.clear()
    boats[3].features.add(features[5], features[3])  # Баренцево
    
    boats[4].features.clear()
    boats[4].features.add(features[1], features[2], features[4])  # Северный ветер
    
    print("  ✓ Настроены связи между судами и особенностями")
    
    # 8. Создаем расписание (опционально)
    print("\n8. Создание расписания рейсов...")
    availability_data = [
        {'boat_pk': 1, 'date': date(2025, 11, 22), 'departure': time(11, 0), 'return': time(13, 0)},
        {'boat_pk': 1, 'date': date(2025, 11, 22), 'departure': time(14, 0), 'return': time(17, 0)},
        {'boat_pk': 2, 'date': date(2025, 11, 23), 'departure': time(10, 0), 'return': time(12, 0)},
        {'boat_pk': 2, 'date': date(2025, 11, 23), 'departure': time(13, 0), 'return': time(16, 0)},
        {'boat_pk': 3, 'date': date(2025, 11, 24), 'departure': time(9, 0), 'return': time(11, 0)},
        {'boat_pk': 3, 'date': date(2025, 11, 24), 'departure': time(12, 0), 'return': time(15, 0)},
        {'boat_pk': 4, 'date': date(2025, 11, 25), 'departure': time(11, 0), 'return': time(13, 0)},
        {'boat_pk': 4, 'date': date(2025, 11, 25), 'departure': time(15, 0), 'return': time(18, 0)},
        {'boat_pk': 1, 'date': date(2025, 11, 26), 'departure': time(11, 0), 'return': time(13, 0)},
        {'boat_pk': 2, 'date': date(2025, 11, 26), 'departure': time(14, 0), 'return': time(17, 0)},
    ]
    
    created_count = 0
    for avail_info in availability_data:
        avail, created = BoatAvailability.objects.get_or_create(
            boat=boats[avail_info['boat_pk']],
            departure_date=avail_info['date'],
            departure_time=avail_info['departure'],
            defaults={
                'return_time': avail_info['return'],
                'is_active': True,
            }
        )
        if created:
            created_count += 1
    
    print(f"  ✓ Создано/найдено {len(availability_data)} записей расписания")
    
    # Итоги
    print("\n" + "=" * 60)
    print("✓ Тестовые данные успешно созданы и настроены!")
    print("=" * 60)
    print("\nДоступные аккаунты капитанов:")
    for captain_data in captains:
        print(f"  Email: {captain_data['email']}, Пароль: {captain_data['password']}")
    print(f"\nСоздано:")
    print(f"  - Особенностей: {len(features)}")
    print(f"  - Маршрутов: {len(routes)}")
    print(f"  - Пользователей: {len(users)}")
    print(f"  - Судов: {len(boats)}")
    print(f"  - Записей расписания: {len(availability_data)}")

if __name__ == '__main__':
    setup_test_data()
