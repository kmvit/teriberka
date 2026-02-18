# Generated manually for guide_reminder_sent field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0008_booking_telegram_notification_sent'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='guide_reminder_sent',
            field=models.BooleanField(
                default=False,
                help_text='Флаг для предотвращения дублирования напоминания гиду за 3 часа до выхода',
                verbose_name='Напоминание гиду отправлено'
            ),
        ),
    ]
