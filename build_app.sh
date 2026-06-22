#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=== Build SAT XML Conversor ==="

# Ensure Playwright browsers are installed
./venv/bin/python -c "from playwright.sync_api import sync_playwright; print('Playwright OK')" 2>/dev/null || {
    echo "Installing Playwright browsers..."
    ./venv/bin/playwright install chromium
}

# Build with PyInstaller
echo "Building .app..."
./venv/bin/python -m PyInstaller --clean --noconfirm build.spec

echo ""
echo "=== Build complete ==="
echo "App: ./dist/SAT XML Conversor.app"
echo "Size: $(du -sh ./dist/SAT XML Conversor.app | cut -f1)"
