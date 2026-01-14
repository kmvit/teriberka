"""
Сервис для работы с API Т-Банка (эквайринг)
Документация: https://developer.tbank.ru/eacq/intro/
"""

import hashlib
import requests
from decimal import Decimal
from typing import Dict, Optional
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class TBankAPIException(Exception):
    """Исключение при работе с API Т-Банка"""
    pass


class TBankService:
    """Сервис для интеграции с API Т-Банка"""
    
    def __init__(self):
        self.terminal_key = settings.TBANK_TERMINAL_KEY
        self.password = settings.TBANK_PASSWORD
        self.api_url = settings.TBANK_API_URL
        self.notification_url = settings.TBANK_NOTIFICATION_URL
        
        if not self.terminal_key or not self.password:
            raise ValueError("TBANK_TERMINAL_KEY и TBANK_PASSWORD должны быть установлены в настройках")
    
    def generate_token(self, data: Dict) -> str:
        """
        Генерация токена для подписи запроса
        
        Алгоритм:
        1. Берем значения полей (исключая Token, DATA и Receipt)
        2. Добавляем Password
        3. Сортируем по ключам
        4. Конкатенируем значения
        5. Вычисляем SHA-256
        
        Args:
            data: Словарь с параметрами запроса
            
        Returns:
            Хеш SHA-256 в виде строки
        """
        # Поля, которые НЕ участвуют в генерации токена
        excluded_fields = ['Token', 'DATA', 'Receipt', 'Shops', 'Items']
        
        # Создаем копию данных, исключая специальные поля
        token_data = {k: v for k, v in data.items() if k not in excluded_fields}
        token_data['Password'] = self.password
        
        # Сортируем по ключам и конкатенируем значения
        sorted_values = [str(token_data[key]) for key in sorted(token_data.keys())]
        concatenated = ''.join(sorted_values)
        
        # Вычисляем SHA-256
        token = hashlib.sha256(concatenated.encode('utf-8')).hexdigest()
        
        logger.debug(f"Generated token for fields: {list(token_data.keys())}")
        logger.debug(f"Token concatenated string: {concatenated}")
        return token
    
    def _make_request(self, endpoint: str, data: Dict) -> Dict:
        """
        Выполнение запроса к API Т-Банка
        
        Args:
            endpoint: Конечная точка API (например, 'Init', 'GetState')
            data: Данные запроса
            
        Returns:
            JSON ответ от API
            
        Raises:
            TBankAPIException: При ошибке запроса
        """
        url = f"{self.api_url}/{endpoint}"
        
        # Добавляем TerminalKey и генерируем Token
        data['TerminalKey'] = self.terminal_key
        data['Token'] = self.generate_token(data)
        
        try:
            logger.info(f"Making request to T-Bank API: {endpoint}")
            # Логируем данные без пароля для безопасности
            safe_data = {k: v for k, v in data.items() if k not in ['Token']}
            logger.info(f"Request data: {safe_data}")
            
            response = requests.post(
                url,
                json=data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            logger.info(f"Response status: {response.status_code}")
            logger.info(f"Response text: {response.text}")
            
            response.raise_for_status()
            
            result = response.json()
            
            # Проверяем успешность операции
            if not result.get('Success', False):
                error_code = result.get('ErrorCode', 'UNKNOWN')
                error_message = result.get('Message', 'Unknown error') or result.get('Details', 'No details')
                logger.error(f"T-Bank API error: {error_code} - {error_message}")
                logger.error(f"Full response: {result}")
                raise TBankAPIException(f"T-Bank API Error [{error_code}]: {error_message}")
            
            return result
            
        except requests.RequestException as e:
            logger.error(f"Network error while calling T-Bank API: {str(e)}")
            raise TBankAPIException(f"Network error: {str(e)}")
        except ValueError as e:
            logger.error(f"Invalid JSON response from T-Bank API: {str(e)}")
            raise TBankAPIException(f"Invalid response: {str(e)}")
    
    def init_payment(
        self,
        amount: Decimal,
        order_id: str,
        description: str,
        success_url: str,
        fail_url: str,
        customer_email: Optional[str] = None,
        customer_phone: Optional[str] = None
    ) -> Dict:
        """
        Инициализация платежа (метод Init)
        
        Args:
            amount: Сумма платежа в рублях (будет конвертирована в копейки)
            order_id: Уникальный идентификатор заказа
            description: Описание платежа
            success_url: URL для перенаправления при успешной оплате
            fail_url: URL для перенаправления при неудачной оплате
            customer_email: Email клиента (опционально)
            customer_phone: Телефон клиента (опционально)
            
        Returns:
            Словарь с данными платежа:
            {
                'PaymentId': str,  # ID платежа в системе Т-Банка
                'PaymentURL': str,  # URL для перенаправления на оплату
                'Status': str,  # Статус платежа
                ...
            }
        """
        # Конвертируем рубли в копейки
        amount_in_kopecks = int(amount * 100)
        
        # Базовые параметры
        data = {
            'Amount': amount_in_kopecks,
            'OrderId': order_id,
            'Description': description,
        }
        
        # Добавляем URLs если они не пустые
        if self.notification_url:
            data['NotificationURL'] = self.notification_url
        
        if success_url:
            data['SuccessURL'] = success_url
            
        if fail_url:
            data['FailURL'] = fail_url
        
        # Добавляем данные клиента через поле DATA (если есть)
        # Важно: DATA не участвует в генерации токена!
        receipt_data = {}
        if customer_email:
            receipt_data['Email'] = customer_email
        if customer_phone:
            receipt_data['Phone'] = customer_phone
            
        # Только если есть данные, добавляем поле DATA
        if receipt_data:
            data['DATA'] = receipt_data
        
        logger.info(f"Initializing payment: order_id={order_id}, amount={amount} RUB ({amount_in_kopecks} kopecks)")
        result = self._make_request('Init', data)
        
        return {
            'PaymentId': result.get('PaymentId'),
            'PaymentURL': result.get('PaymentURL'),
            'Status': result.get('Status'),
            'OrderId': result.get('OrderId'),
            'Amount': amount,
            'raw_response': result
        }
    
    def get_payment_state(self, payment_id: str) -> Dict:
        """
        Получение статуса платежа (метод GetState)
        
        Args:
            payment_id: ID платежа в системе Т-Банка
            
        Returns:
            Словарь с информацией о платеже
        """
        data = {'PaymentId': payment_id}
        
        logger.info(f"Getting payment state: payment_id={payment_id}")
        result = self._make_request('GetState', data)
        
        return {
            'Status': result.get('Status'),
            'PaymentId': result.get('PaymentId'),
            'OrderId': result.get('OrderId'),
            'raw_response': result
        }
    
    def confirm_payment(self, payment_id: str, amount: Optional[Decimal] = None) -> Dict:
        """
        Подтверждение платежа (метод Confirm)
        Используется для двухстадийных платежей
        
        Args:
            payment_id: ID платежа в системе Т-Банка
            amount: Сумма подтверждения (если отличается от исходной)
            
        Returns:
            Словарь с результатом подтверждения
        """
        data = {'PaymentId': payment_id}
        
        if amount:
            amount_in_kopecks = int(amount * 100)
            data['Amount'] = amount_in_kopecks
        
        logger.info(f"Confirming payment: payment_id={payment_id}")
        result = self._make_request('Confirm', data)
        
        return {
            'Status': result.get('Status'),
            'PaymentId': result.get('PaymentId'),
            'OrderId': result.get('OrderId'),
            'raw_response': result
        }
    
    def cancel_payment(self, payment_id: str, amount: Optional[Decimal] = None) -> Dict:
        """
        Отмена платежа (метод Cancel)
        
        Args:
            payment_id: ID платежа в системе Т-Банка
            amount: Сумма отмены (для частичной отмены)
            
        Returns:
            Словарь с результатом отмены
        """
        data = {'PaymentId': payment_id}
        
        if amount:
            amount_in_kopecks = int(amount * 100)
            data['Amount'] = amount_in_kopecks
        
        logger.info(f"Cancelling payment: payment_id={payment_id}")
        result = self._make_request('Cancel', data)
        
        return {
            'Status': result.get('Status'),
            'PaymentId': result.get('PaymentId'),
            'OrderId': result.get('OrderId'),
            'OriginalAmount': result.get('OriginalAmount'),
            'NewAmount': result.get('NewAmount'),
            'raw_response': result
        }
    
    def verify_notification(self, notification_data: Dict) -> bool:
        """
        Проверка подлинности уведомления от Т-Банка
        
        Args:
            notification_data: Данные уведомления (webhook)
            
        Returns:
            True, если уведомление подлинное
        """
        received_token = notification_data.get('Token')
        if not received_token:
            logger.warning("No token in notification data")
            return False
        
        # Генерируем токен на основе полученных данных
        expected_token = self.generate_token(notification_data)
        
        is_valid = received_token == expected_token
        if not is_valid:
            logger.warning(f"Invalid notification token. Expected: {expected_token}, got: {received_token}")
        
        return is_valid
