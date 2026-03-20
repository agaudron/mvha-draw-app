.PHONY: build run stop up down update-data dev install

# Docker Image Variables
IMAGE_NAME := hockey-draw-frontend
PORT := 8080

# Local dev
install:
	npm install

dev:
	@if [ ! -d node_modules ]; then echo "node_modules not found, running npm install..."; npm install; fi
	npm run dev

build:
	docker build -t $(IMAGE_NAME) .

run:
	docker run -d --name $(IMAGE_NAME) -p $(PORT):8080 $(IMAGE_NAME)

stop:
	docker stop $(IMAGE_NAME) || true
	docker rm $(IMAGE_NAME) || true

up:
	docker compose up -d --build

down:
	docker compose down

restart:
	$(MAKE) stop
	$(MAKE) up
	

update-data:
	@if [ -z "$(PDF)" ]; then \
		echo "Error: No PDF specified."; \
		echo "Usage: make update-data PDF=/path/to/new_draw.pdf"; \
		exit 1; \
	fi
	@bash ./scripts/update-data.sh "$(PDF)"
