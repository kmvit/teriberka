# Generated manually for CKEditor image upload in FAQ content

import ckeditor_uploader.fields
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('faq', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='faqpage',
            name='content',
            field=ckeditor_uploader.fields.RichTextUploadingField(verbose_name='Содержание'),
        ),
    ]
