#!/bin/bash
# Pre-commit hook: block git commit if manifest.json and CLAUDE.MD versions don't match

COMMAND="$TOOL_INPUT_command"

# Only check git commit commands
if ! echo "$COMMAND" | grep -q "git commit"; then
  exit 0
fi

# Extract version from manifest.json
MANIFEST_VERSION=$(grep -oP '"version"\s*:\s*"\K[^"]+' manifest.json 2>/dev/null)
if [ -z "$MANIFEST_VERSION" ]; then
  # Try macOS-compatible grep if -P not available
  MANIFEST_VERSION=$(grep '"version"' manifest.json 2>/dev/null | head -1 | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
fi

# Extract version from CLAUDE.MD
CLAUDE_VERSION=$(grep 'Current Version:' CLAUDE.MD 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')

# If either version can't be found, allow the commit (don't block on parse failure)
if [ -z "$MANIFEST_VERSION" ] || [ -z "$CLAUDE_VERSION" ]; then
  exit 0
fi

# Block if versions don't match
if [ "$MANIFEST_VERSION" != "$CLAUDE_VERSION" ]; then
  echo "BLOCKED: Version mismatch — manifest.json ($MANIFEST_VERSION) != CLAUDE.MD ($CLAUDE_VERSION). Update both to the same version before committing."
  exit 2
fi
