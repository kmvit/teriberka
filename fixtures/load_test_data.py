#!/usr/bin/env python
"""
Скрипт для загрузки тестовых данных после loaddata
Устанавливает правильные пароли для пользователей и связи ManyToMany
"""
import os
import sys
import django

# Настройка Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User
from apps.boats.models import Boat, SailingZone, Feature

def setup_test_data():
    """Настраивает тестовые данные после загрузки фикстур"""
    
    print("Проверка наличия данных в базе...")
    
    # Проверяем наличие пользователей
    user_count = User.objects.count()
    print(f"Пользователей в БД: {user_count}")
    
    # Проверяем наличие судов
    boat_count = Boat.objects.count()
    print(f"Судов в БД: {boat_count}")
    
    # Проверяем наличие особенностей
    feature_count = Feature.objects.count()
    print(f"Особенностей в БД: {feature_count}")
    
    # Проверяем наличие маршрутов
    route_count = SailingZone.objects.count()
    print(f"Маршрутов в БД: {route_count}")
    
    if user_count == 0 or boat_count == 0:
        print("\n⚠ ВНИМАНИЕ: Данные не найдены в базе!")
        print("Сначала выполните: python manage.py loaddata fixtures/test_boats_data.json")
        return
    
    # Устанавливаем пароли для капитанов
    captains = [
        {'email': 'captain1@teriberka.ru', 'password': 'captain123'},
        {'email': 'captain2@teriberka.ru', 'password': 'captain123'},
        {'email': 'captain3@teriberka.ru', 'password': 'captain123'},
        {'email': 'captain4@teriberka.ru', 'password': 'captain123'},
    ]
    
    print("\nУстановка паролей для капитанов...")
    for captain_data in captains:
        try:
            user = User.objects.get(email=captain_data['email'])
            user.set_password(captain_data['password'])
            user.save()
            print(f"✓ Установлен пароль для {captain_data['email']}")
        except User.DoesNotExist:
            print(f"✗ Пользователь {captain_data['email']} не найден")
    
    # Настраиваем связи ManyToMany между судами и маршрутами
    print("\nНастройка связей между судами и маршрутами...")
    try:
        boat1 = Boat.objects.get(pk=1)  # Михаил
        boat2 = Boat.objects.get(pk=2)  # Альбатрос
        boat3 = Boat.objects.get(pk=3)  # Баренцево
        boat4 = Boat.objects.get(pk=4)  # Северный ветер
        
        route1 = SailingZone.objects.get(pk=1)  # Поиски китов
        route2 = SailingZone.objects.get(pk=2)  # Береговые скалы
        route3 = SailingZone.objects.get(pk=3)  # Рыбалка в открытом море
        
        # Михаил - поиски китов
        boat1.sailing_zones.add(route1)
        
        # Альбатрос - береговые скалы
        boat2.sailing_zones.add(route2)
        
        # Баренцево - рыбалка
        boat3.sailing_zones.add(route3)
        
        # Северный ветер - поиски китов и береговые скалы
        boat4.sailing_zones.add(route1, route2)
        
        print("✓ Настроены связи между судами и маршрутами")
    except Boat.DoesNotExist as e:
        print(f"✗ Ошибка: Судно не найдено - {e}")
    except SailingZone.DoesNotExist as e:
        print(f"✗ Ошибка: Маршрут не найден - {e}")
    except Exception as e:
        print(f"✗ Ошибка при настройке связей: {e}")
        import traceback
        traceback.print_exc()
    
    # Настраиваем связи ManyToMany между судами и особенностями
    print("\nНастройка связей между судами и особенностями...")
    
    # Проверяем наличие всех необходимых особенностей
    required_features = {
        1: "Туалет на судне",
        2: "Теплые пледы",
        3: "Дождевики",
        4: "Чай и кофе",
        5: "Удочки для рыбалки"
    }
    
    features_dict = {}
    missing_features = []
    
    for pk, name in required_features.items():
        try:
            feature = Feature.objects.get(pk=pk)
            features_dict[pk] = feature
            print(f"  ✓ Найдена особенность ID {pk}: {name}")
        except Feature.DoesNotExist:
            missing_features.append(f"ID {pk}: {name}")
            print(f"  ✗ Особенность не найдена: ID {pk} ({name})")
    
    if missing_features:
        print(f"\n⚠ ВНИМАНИЕ: Не найдено {len(missing_features)} особенностей:")
        for missing in missing_features:
            print(f"  - {missing}")
        print("\nВыполните загрузку фикстур:")
        print("  python manage.py loaddata fixtures/test_boats_data.json")
        return
    
    try:
        boat1 = Boat.objects.get(pk=1)  # Михаил
        boat2 = Boat.objects.get(pk=2)  # Альбатрос
        boat3 = Boat.objects.get(pk=3)  # Баренцево
        boat4 = Boat.objects.get(pk=4)  # Северный ветер
        
        # Михаил - туалет, пледы, дождевики, чай/кофе
        boat1.features.add(features_dict[1], features_dict[2], features_dict[3], features_dict[4])
        
        # Альбатрос - туалет, пледы, чай/кофе
        boat2.features.add(features_dict[1], features_dict[2], features_dict[4])
        
        # Баренцево - удочки, дождевики
        boat3.features.add(features_dict[5], features_dict[3])
        
        # Северный ветер - туалет, пледы, чай/кофе
        boat4.features.add(features_dict[1], features_dict[2], features_dict[4])
        
        print("✓ Настроены связи между судами и особенностями")
    except Boat.DoesNotExist as e:
        print(f"✗ Ошибка: Судно не найдено - {e}")
    except Exception as e:
        print(f"✗ Ошибка при настройке особенностей: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n✓ Тестовые данные успешно настроены!")
    print("\nДоступные аккаунты капитанов:")
    for captain_data in captains:
        print(f"  Email: {captain_data['email']}, Пароль: {captain_data['password']}")

if __name__ == '__main__':
    setup_test_data()

