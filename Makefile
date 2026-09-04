.PHONY: dev build clean test

dev:
	./dev.sh

db:
	docker compose up -d

backend:
	cd backend && ./venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd web && npm run dev

test:
	cd backend && ./venv/bin/python -m unittest discover -s tests
