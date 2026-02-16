#!/bin/bash
# Pre-edit hook: block direct edits to binary image files

FILE="$TOOL_INPUT_file_path"

case "$FILE" in
  *.png|*.ico)
    echo "BLOCKED: Do not edit binary files directly. Run python3 create_icons.py to regenerate icons."
    exit 2
    ;;
esac
