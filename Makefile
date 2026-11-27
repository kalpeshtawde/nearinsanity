# Near Insanity — common dev/deploy commands.
#
# Stack layout:
#   frontend+backend : docker-compose.prod.yml   (web :8087, backend :8001)
#   dev override    : docker-compose.dev.yml     (hot-reload runserver)
#   database        : backend/docker-compose.db.yml (postgres:15, host :5441)
#
# Usage: make <target>   (run `make` or `make help` to list targets)

PROD_COMPOSE   := docker-compose -f docker-compose.prod.yml
DEV_COMPOSE    := docker-compose -f docker-compose.prod.yml -f docker-compose.dev.yml
DB_COMPOSE     := docker-compose -f backend/docker-compose.db.yml
BACKEND_EXEC   := $(PROD_COMPOSE) exec backend python manage.py

.PHONY: help dev prod db migrate migrate-dev build build-dev up down logs shell superuser test

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

db: ## Start the postgres:15 dev database (host port 5441)
	$(DB_COMPOSE) up -d

# ---------------------------------------------------------------------------
# Stack lifecycle
# ---------------------------------------------------------------------------

dev: ## Start the stack in dev mode (hot-reload Django, frontend container)
	$(DEV_COMPOSE) up -d --build

prod: ## Start the stack in prod mode (gunicorn backend, nginx frontend)
	$(PROD_COMPOSE) up -d --build

up: prod ## Alias for `make prod`

down: ## Stop all nearinsanity containers (keeps volumes/data)
	$(PROD_COMPOSE) down
	$(DB_COMPOSE) down

logs: ## Tail backend logs (add SERVICE=web for frontend)
	$(PROD_COMPOSE) logs -f $(or $(SERVICE),backend)

shell: ## Django shell inside the backend container
	$(BACKEND_EXEC) shell

test: ## Run Django tests inside the backend container
	$(BACKEND_EXEC) test

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

build: ## Build prod images only (no start)
	$(PROD_COMPOSE) build

build-dev: ## Build dev images only (no start)
	$(DEV_COMPOSE) build

build-frontend: ## Build the React app locally to dist/ (npm run build)
	npm run build

# ---------------------------------------------------------------------------
# Django management
# ---------------------------------------------------------------------------

migrate: db ## Run migrations inside the backend container (starts DB first)
	$(BACKEND_EXEC) migrate

migrate-dev: ## Run migrations via the local .venv instead of Docker
	cd backend && .venv/bin/python manage.py migrate

superuser: ## Create a superuser (prompts for credentials)
	$(BACKEND_EXEC) createsuperuser

makemigrations: ## Generate migrations from model changes (local .venv)
	cd backend && .venv/bin/python manage.py makemigrations
