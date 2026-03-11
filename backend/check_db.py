import os
import django
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "auralink.settings")
django.setup()

print("Using database:", settings.DATABASES['default']['ENGINE'])
if 'NAME' in settings.DATABASES['default']:
    print("Database NAME:", settings.DATABASES['default']['NAME'])
