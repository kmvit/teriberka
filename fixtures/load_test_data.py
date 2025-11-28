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
from apps.boats.models import Boat, SailingZone

def setup_test_data():
    """Настраивает тестовые данные после загрузки фикстур"""
    
    # Устанавливаем пароли для капитанов
    captains = [
        {'email': 'captain1@teriberka.ru', 'password': 'captain123'},
        {'email': 'captain2@teriberka.ru', 'password': 'captain123'},
        {'email': 'captain3@teriberka.ru', 'password': 'captain123'},
        {'email': 'captain4@teriberka.ru', 'password': 'captain123'},
    ]
    
    for captain_data in captains:
        try:
            user = User.objects.get(email=captain_data['email'])
            user.set_password(captain_data['password'])
            user.save()
            print(f"✓ Установлен пароль для {captain_data['email']}")
        except User.DoesNotExist:
            print(f"✗ Пользователь {captain_data['email']} не найден")
    
    # Настраиваем связи ManyToMany между судами и маршрутами
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
    except Exception as e:
        print(f"✗ Ошибка при настройке связей: {e}")
    
    print("\n✓ Тестовые данные успешно настроены!")
    print("\nДоступные аккаунты капитанов:")
    for captain_data in captains:
        print(f"  Email: {captain_data['email']}, Пароль: {captain_data['password']}")

if __name__ == '__main__':
    setup_test_data()

