---
name: validate-js
description: Run syntax checks on all JavaScript files in the project
user-invocable: true
disable-model-invocation: true
---

# /validate-js

Run `node --check` on every `.js` file in the project root to verify syntax.

## Steps

1. Find all `.js` files in the project root directory (non-recursive — this is a flat, no-build project).
2. Run `node --check <file>` on each file.
3. Report results per file: PASS or FAIL with the error message.
4. Print a summary line: `X/Y files passed`.

## Example output

```
background.js: PASS
constants.js: PASS
content.js: PASS
popup.js: FAIL — SyntaxError: Unexpected token (line 42)

Result: 3/4 files passed
```
