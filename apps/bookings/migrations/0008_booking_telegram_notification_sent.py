# Generated manually to add telegram_notification_sent field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0007_booking_hotel_admin_booking_hotel_cashback_amount_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='telegram_notification_sent',
            field=models.BooleanField(
                default=False,
                verbose_name='Уведомление в Telegram отправлено',
                help_text='Флаг для предотвращения дублирования уведомлений в Telegram'
            ),
        ),
    ]
