#!/bin/bash

# scripts/manage_deps.sh
# Helper script to manage Python dependencies seamlessly.

COMMAND=$1
PKG=$2

# Ensure we are in the AgenticServer directory
cd "$(dirname "$0")/.."

# Check for venv and activate it if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
elif [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "Warning: No virtual environment found and none active. It's recommended to use a venv."
fi

case $COMMAND in
    install)
        echo "Installing dependencies from requirements.txt..."
        pip install -r requirements.txt
        ;;
    add)
        if [ -z "$PKG" ]; then
            echo "Usage: $0 add <package_name>"
            exit 1
        fi
        echo "Installing $PKG..."
        pip install "$PKG"
        if [ $? -eq 0 ]; then
            # Get the exact package name and version as installed
            # We use grep with -i to handle case differences
            INSTALLED_PKG=$(pip freeze | grep -i "^${PKG}=" | head -n 1)
            
            if [ -z "$INSTALLED_PKG" ]; then
                # If not found in freeze (unusual for successfully installed pkg), use the input name
                INSTALLED_PKG=$PKG
            fi

            CLEAN_NAME=$(echo "$INSTALLED_PKG" | cut -d'=' -f1)
            
            # Check if it already exists in requirements.txt (case-insensitive)
            if grep -qi "^${CLEAN_NAME}[>=<]" requirements.txt || grep -qix "${CLEAN_NAME}" requirements.txt; then
                echo "Updating $CLEAN_NAME in requirements.txt..."
                # Use sed to replace the line. We use a temporary file for compatibility.
                sed -i "s/^${CLEAN_NAME}[>=<].*/${INSTALLED_PKG}/I" requirements.txt
                sed -i "s/^${CLEAN_NAME}$/${INSTALLED_PKG}/I" requirements.txt
            else
                echo "Adding $INSTALLED_PKG to requirements.txt..."
                echo "$INSTALLED_PKG" >> requirements.txt
            fi
        fi
        ;;
    freeze)
        echo "Updating requirements.txt based on currently installed top-level packages..."
        pip install pip-chill > /dev/null 2>&1
        # We use a safer approach: pip-chill lists top-level, but we manually 
        # ensure common libraries like django, langchain, etc. are kept if installed.
        # For now, let's just use pip-chill but avoid overwriting if it feels too destructive.
        
        # Backup current requirements
        cp requirements.txt requirements.txt.bak
        
        # Generate new ones
        pip-chill > requirements.txt
        
        echo "requirements.txt updated. (Backup saved as requirements.txt.bak)"
        echo "Note: If some libraries disappeared, they might be considered sub-dependencies."
        ;;
    *)
        echo "Usage: $0 {install|add|freeze}"
        echo "  install: Install all packages from requirements.txt"
        echo "  add <pkg>: Install a package and add it to requirements.txt"
        echo "  freeze: Update requirements.txt to match your current environment"
        exit 1
        ;;
esac
