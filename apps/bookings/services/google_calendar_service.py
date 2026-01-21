import os
import logging
from datetime import datetime
from decimal import Decimal
from django.conf import settings
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)


class GoogleCalendarService:
    """Сервис для синхронизации бронирований с Google Calendar админа"""
    
    SCOPES = ['https://www.googleapis.com/auth/calendar']
    
    def __init__(self):
        self.service_account_file = getattr(settings, 'GOOGLE_CALENDAR_SERVICE_ACCOUNT_FILE', None)
        self.calendar_id = getattr(settings, 'GOOGLE_CALENDAR_ID', None)
        self.service = None
        
        logger.info(f"=== GoogleCalendarService initialized ===")
        logger.info(f"Service account file configured: {bool(self.service_account_file)}")
        logger.info(f"Calendar ID configured: {bool(self.calendar_id)}")
        
        if not self.service_account_file:
            logger.warning("❌ GOOGLE_CALENDAR_SERVICE_ACCOUNT_FILE not configured")
        if not self.calendar_id:
            logger.warning("❌ GOOGLE_CALENDAR_ID not configured")
        
        # Инициализируем сервис, если настройки есть
        if self.service_account_file and self.calendar_id:
            try:
                self._initialize_service()
            except Exception as e:
                logger.error(f"❌ Failed to initialize Google Calendar service: {str(e)}", exc_info=True)
    
    def _initialize_service(self):
        """Инициализация Google Calendar API сервиса"""
        if not os.path.exists(self.service_account_file):
            logger.error(f"❌ Service account file not found: {self.service_account_file}")
            return
        
        try:
            credentials = service_account.Credentials.from_service_account_file(
                self.service_account_file,
                scopes=self.SCOPES
            )
            self.service = build('calendar', 'v3', credentials=credentials)
            logger.info("✅ Google Calendar service initialized successfully")
        except Exception as e:
            logger.error(f"❌ Error initializing Google Calendar service: {str(e)}", exc_info=True)
            raise
    
    def _format_price(self, amount):
        """Форматирует цену с пробелами для тысяч"""
        if amount is None:
            return "0"
        return f"{amount:,.0f}".replace(',', ' ')
    
    def _format_event_description(self, booking):
        """Форматирует описание события для календаря"""
        description_parts = [
            f"Гость: {booking.guest_name}",
            f"Телефон: {booking.guest_phone}",
            f"Количество людей: {booking.number_of_people}",
            f"Длительность: {booking.duration_hours} ч",
            f"Судно: {booking.boat.name}",
            f"Ставка за человека: {self._format_price(booking.price_per_person)} ₽",
            f"Общая стоимость: {self._format_price(booking.total_price)} ₽",
            f"Внесена предоплата: {self._format_price(booking.deposit)} ₽",
            f"Остаток: {self._format_price(booking.remaining_amount)} ₽",
        ]
        
        if booking.notes:
            description_parts.append(f"Примечания: {booking.notes}")
        
        return "\n".join(description_parts)
    
    def create_event(self, booking):
        """
        Создание события в Google Calendar
        
        Args:
            booking: Объект Booking
            
        Returns:
            str: ID созданного события или None в случае ошибки
        """
        logger.info(f"=== create_event called for booking #{booking.id} ===")
        
        if not self.service or not self.calendar_id:
            logger.warning("❌ Google Calendar not configured, skipping event creation")
            return None
        
        # Проверяем, что событие еще не создано
        if booking.google_calendar_event_id:
            logger.warning(f"⚠️ Booking {booking.id} already has calendar event: {booking.google_calendar_event_id}")
            return booking.google_calendar_event_id
        
        try:
            event = {
                'summary': f"{booking.event_type} - {booking.guest_name} ({booking.boat.name}, {booking.number_of_people} чел.)",
                'description': self._format_event_description(booking),
                'start': {
                    'dateTime': booking.start_datetime.isoformat(),
                    'timeZone': str(booking.start_datetime.tzinfo) if booking.start_datetime.tzinfo else 'Europe/Moscow',
                },
                'end': {
                    'dateTime': booking.end_datetime.isoformat(),
                    'timeZone': str(booking.end_datetime.tzinfo) if booking.end_datetime.tzinfo else 'Europe/Moscow',
                },
            }
            
            logger.info(f"Creating calendar event for booking #{booking.id}")
            logger.debug(f"Event data: summary={event['summary']}, start={event['start']['dateTime']}")
            
            created_event = self.service.events().insert(
                calendarId=self.calendar_id,
                body=event
            ).execute()
            
            event_id = created_event.get('id')
            logger.info(f"✅ Calendar event created successfully for booking #{booking.id}, event_id={event_id}")
            
            return event_id
            
        except HttpError as e:
            logger.error(f"❌ Google Calendar API error creating event for booking #{booking.id}: {str(e)}")
            logger.error(f"Error details: {e.content if hasattr(e, 'content') else 'N/A'}")
            return None
        except Exception as e:
            logger.error(f"❌ Error creating calendar event for booking #{booking.id}: {str(e)}", exc_info=True)
            return None
    
    def update_event(self, booking):
        """
        Обновление существующего события в Google Calendar
        
        Args:
            booking: Объект Booking
            
        Returns:
            bool: True если обновление успешно, False в противном случае
        """
        logger.info(f"=== update_event called for booking #{booking.id} ===")
        
        if not self.service or not self.calendar_id:
            logger.warning("❌ Google Calendar not configured, skipping event update")
            return False
        
        if not booking.google_calendar_event_id:
            logger.warning(f"⚠️ Booking {booking.id} has no calendar event ID, cannot update")
            return False
        
        try:
            # Получаем существующее событие
            event = self.service.events().get(
                calendarId=self.calendar_id,
                eventId=booking.google_calendar_event_id
            ).execute()
            
            # Обновляем данные события
            event['summary'] = f"{booking.event_type} - {booking.guest_name} ({booking.boat.name}, {booking.number_of_people} чел.)"
            event['description'] = self._format_event_description(booking)
            event['start'] = {
                'dateTime': booking.start_datetime.isoformat(),
                'timeZone': str(booking.start_datetime.tzinfo) if booking.start_datetime.tzinfo else 'Europe/Moscow',
            }
            event['end'] = {
                'dateTime': booking.end_datetime.isoformat(),
                'timeZone': str(booking.end_datetime.tzinfo) if booking.end_datetime.tzinfo else 'Europe/Moscow',
            }
            
            logger.info(f"Updating calendar event {booking.google_calendar_event_id} for booking #{booking.id}")
            
            updated_event = self.service.events().update(
                calendarId=self.calendar_id,
                eventId=booking.google_calendar_event_id,
                body=event
            ).execute()
            
            logger.info(f"✅ Calendar event updated successfully for booking #{booking.id}")
            return True
            
        except HttpError as e:
            if e.resp.status == 404:
                logger.warning(f"⚠️ Calendar event {booking.google_calendar_event_id} not found for booking #{booking.id}, may have been deleted")
            else:
                logger.error(f"❌ Google Calendar API error updating event for booking #{booking.id}: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"❌ Error updating calendar event for booking #{booking.id}: {str(e)}", exc_info=True)
            return False
    
    def delete_event(self, booking):
        """
        Удаление события из Google Calendar
        
        Args:
            booking: Объект Booking
            
        Returns:
            bool: True если удаление успешно, False в противном случае
        """
        logger.info(f"=== delete_event called for booking #{booking.id} ===")
        
        if not self.service or not self.calendar_id:
            logger.warning("❌ Google Calendar not configured, skipping event deletion")
            return False
        
        if not booking.google_calendar_event_id:
            logger.warning(f"⚠️ Booking {booking.id} has no calendar event ID, cannot delete")
            return False
        
        try:
            logger.info(f"Deleting calendar event {booking.google_calendar_event_id} for booking #{booking.id}")
            
            self.service.events().delete(
                calendarId=self.calendar_id,
                eventId=booking.google_calendar_event_id
            ).execute()
            
            logger.info(f"✅ Calendar event deleted successfully for booking #{booking.id}")
            return True
            
        except HttpError as e:
            if e.resp.status == 404:
                logger.warning(f"⚠️ Calendar event {booking.google_calendar_event_id} not found for booking #{booking.id}, may have been already deleted")
                return True  # Считаем успешным, если событие уже удалено
            else:
                logger.error(f"❌ Google Calendar API error deleting event for booking #{booking.id}: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"❌ Error deleting calendar event for booking #{booking.id}: {str(e)}", exc_info=True)
            return False
