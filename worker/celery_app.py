from celery import Celery
import os

# Configure Celery to use Redis
app = Celery('reading_list', broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
app.conf.update(
    result_backend=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)