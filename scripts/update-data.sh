#!/bin/bash
set -e

NEW_PDF="$1"

if [ -z "$NEW_PDF" ] || [ ! -f "$NEW_PDF" ]; then
    echo "Error: Please provide a valid path to the new PDF file."
    exit 1
fi

# Resolve the absolute path to the sibling parsing directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARSER_DIR="$PROJECT_ROOT/../hockey-draw"

if [ ! -d "$PARSER_DIR" ]; then
    echo "Error: Parser directory not found at $PARSER_DIR"
    exit 1
fi

echo "Copying $NEW_PDF to $PARSER_DIR/hockey2026.pdf..."
cp "$NEW_PDF" "$PARSER_DIR/hockey2026.pdf"

echo ""
echo "Running the python layout extraction engine..."
cd "$PARSER_DIR"
python3 parse_draw.py

echo ""
echo "Successfully extracted matches.json from the layout!"

APP_PUBLIC_DIR="$PROJECT_ROOT/public"
echo "Deploying fresh data to $APP_PUBLIC_DIR/matches.json..."
cp matches.json "$APP_PUBLIC_DIR/matches.json"

echo "The new data is now live and ready to be served by the web app."
