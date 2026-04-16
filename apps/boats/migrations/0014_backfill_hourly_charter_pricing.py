from decimal import Decimal

from django.db import migrations


def backfill_hourly_charter_pricing(apps, schema_editor):
    CharterPricing = apps.get_model('boats', 'CharterPricing')

    boat_ids = CharterPricing.objects.values_list('boat_id', flat=True).distinct()
    for boat_id in boat_ids:
        active_hourly_exists = CharterPricing.objects.filter(
            boat_id=boat_id,
            duration_hours=1,
            is_active=True
        ).exists()
        if active_hourly_exists:
            continue

        legacy_pricing = CharterPricing.objects.filter(
            boat_id=boat_id,
            duration_hours__gte=1,
            is_active=True
        ).order_by('duration_hours').first()
        if not legacy_pricing:
            continue

        hourly_price = (Decimal(str(legacy_pricing.total_price)) / Decimal(legacy_pricing.duration_hours)).quantize(Decimal('0.01'))
        CharterPricing.objects.update_or_create(
            boat_id=boat_id,
            duration_hours=1,
            defaults={
                'total_price': hourly_price,
                'is_active': True,
            }
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('boats', '0013_alter_charterpricing_duration_hours'),
    ]

    operations = [
        migrations.RunPython(backfill_hourly_charter_pricing, noop_reverse),
    ]
