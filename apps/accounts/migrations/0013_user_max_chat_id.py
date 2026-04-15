# Generated manually for max_chat_id field
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_user_telegram_chat_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='max_chat_id',
            field=models.BigIntegerField(
                blank=True,
                help_text='ID чата для личных уведомлений (привязка через MAX-бота)',
                null=True,
                unique=True,
                verbose_name='MAX Chat ID',
            ),
        ),
    ]
