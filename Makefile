.PHONY: dev build down logs migrate shell clean test lint

dev:
	docker compose -f docker/docker-compose.yml up

build:
	docker compose -f docker/docker-compose.yml build

down:
	docker compose -f docker/docker-compose.yml down

logs:
	docker compose -f docker/docker-compose.yml logs -f

migrate:
	docker compose -f docker/docker-compose.yml exec api alembic upgrade head

shell:
	docker compose -f docker/docker-compose.yml exec api bash

clean:
	docker compose -f docker/docker-compose.yml down -v --remove-orphans
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

test:
	docker compose -f docker/docker-compose.yml exec api pytest

lint:
	docker compose -f docker/docker-compose.yml exec api ruff check .
	docker compose -f docker/docker-compose.yml exec frontend npm run lint
