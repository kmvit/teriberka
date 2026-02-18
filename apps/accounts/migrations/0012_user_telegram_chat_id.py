# Generated manually for telegram_chat_id field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_alter_userverification_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='telegram_chat_id',
            field=models.BigIntegerField(
                blank=True,
                help_text='ID чата для личных уведомлений (привязка через бота)',
                null=True,
                unique=True,
                verbose_name='Telegram Chat ID'
            ),
        ),
    ]
