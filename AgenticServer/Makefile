.PHONY: install add freeze help

help:
	@echo "Available commands:"
	@echo "  make install         - Install all dependencies from requirements.txt"
	@echo "  make add PKG=<name>  - Install a new package and add it to requirements.txt"
	@echo "  make freeze          - Update requirements.txt based on current environment"

install:
	@./scripts/manage_deps.sh install

add:
	@if [ -z "$(PKG)" ]; then \
		echo "Error: Please specify the package name with PKG=<name>"; \
		exit 1; \
	fi
	@./scripts/manage_deps.sh add $(PKG)

freeze:
	@./scripts/manage_deps.sh freeze
