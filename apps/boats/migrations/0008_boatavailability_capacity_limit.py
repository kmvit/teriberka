# Generated manually

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('boats', '0007_hotelboatcashback'),
    ]

    operations = [
        migrations.AddField(
            model_name='boatavailability',
            name='capacity_limit',
            field=models.PositiveIntegerField(
                blank=True,
                help_text='Если не указано, используется вместимость судна',
                null=True,
                validators=[
                    django.core.validators.MinValueValidator(1),
                    django.core.validators.MaxValueValidator(11)
                ],
                verbose_name='Ограничение мест на рейс'
            ),
        ),
    ]
