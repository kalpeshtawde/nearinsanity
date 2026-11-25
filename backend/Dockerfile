FROM python:3.9-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install Python dependencies first (better layer caching).
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy the Django project.
COPY . .

EXPOSE 8000

# Collect static files on boot (admin assets), then serve with gunicorn.
# Run migrations explicitly: docker-compose exec backend python manage.py migrate
CMD ["sh", "-c", "python manage.py collectstatic --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --access-logfile - --error-logfile -"]