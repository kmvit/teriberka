# Generated manually for PromoCode discount_type and discount_percent

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0009_booking_guide_reminder_sent'),
    ]

    operations = [
        migrations.AddField(
            model_name='promocode',
            name='discount_type',
            field=models.CharField(
                choices=[('percent', 'Процент (%)'), ('amount', 'Сумма (₽)')],
                default='amount',
                help_text='Процент от суммы или фиксированная сумма в рублях',
                max_length=10,
                verbose_name='Тип скидки'
            ),
        ),
        migrations.AddField(
            model_name='promocode',
            name='discount_percent',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Процент скидки (0–100). Используется при типе «Процент»',
                max_digits=5,
                null=True,
                validators=[
                    django.core.validators.MinValueValidator(0),
                    django.core.validators.MaxValueValidator(100)
                ],
                verbose_name='Скидка (%)'
            ),
        ),
        migrations.AlterField(
            model_name='promocode',
            name='discount_amount',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Фиксированная сумма скидки в рублях. Используется при типе «Сумма»',
                max_digits=10,
                null=True,
                validators=[django.core.validators.MinValueValidator(0)],
                verbose_name='Сумма скидки (₽)'
            ),
        ),
    ]
