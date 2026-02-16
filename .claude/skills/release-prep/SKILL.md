---
name: release-prep
description: Prepare a new version release by updating all version references and documentation
user-invocable: true
---

# /release-prep <version> <changelog summary>

Prepare a release by updating version numbers and documentation across all files that track the version.

## Arguments

- `version` (required): The new semantic version number, e.g. `4.1.0`
- `changelog summary` (required): A brief description of what changed, e.g. "Add dark mode toggle, fix chat scroll bug"

## Steps

1. **Update `manifest.json`**: Set `"version"` to the new version.
2. **Update `CLAUDE.MD`**:
   - Update `**Current Version:**` in the Project Overview section.
   - Add a new version history entry at the top of the Version History section with today's date and the changelog summary.
   - Update the `**Last Updated:**` date at the bottom of the file to today's date.
   - Update `**Current Version:**` at the bottom of the file.
3. **Update `README.md`**: Update any version references to the new version.
4. **Run syntax validation**: Execute `node --check` on all `.js` files in the project root. If any file fails, report the errors and stop — do not proceed until syntax issues are fixed.
5. **Show summary**: Display all files modified and a diff summary for review. Do NOT commit — the user will commit when ready.

## Important

- Do NOT create a git commit. Only make the file edits and report.
- The changelog summary provided by the user is a starting point — expand it into a proper version history entry with bullet points describing each change.
- Use today's date (YYYY-MM-DD format) for the version history entry and Last Updated footer.
