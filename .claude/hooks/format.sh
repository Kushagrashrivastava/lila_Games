#!/usr/bin/env bash
# PostToolUse: auto-format the edited file. Silently skips if the toolchain isn't installed yet.
input=$(cat)
file=$(jq -r '.tool_input.file_path // ""' <<<"$input")
[[ -z "$file" || ! -f "$file" ]] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
bin="$root/web/node_modules/.bin"

case "$file" in
  "$root"/web/*.ts|"$root"/web/*.tsx|"$root"/web/*.js|"$root"/web/*.jsx)
    [[ -x "$bin/prettier" ]] && "$bin/prettier" --write --log-level=warn "$file"
    if [[ -x "$bin/eslint" ]]; then
      out=$(cd "$root/web" && "$bin/eslint" --fix "$file" 2>&1) || {
        echo "ESLint issues in $file:" >&2; echo "$out" >&2; exit 2
      }
    fi
    ;;
  "$root"/web/*.css|"$root"/web/*.json|"$root"/web/*.html)
    [[ -x "$bin/prettier" ]] && "$bin/prettier" --write --log-level=warn "$file"
    ;;
  *.py)
    if command -v uv >/dev/null && [[ -f "$root/pipeline/pyproject.toml" ]]; then
      (cd "$root/pipeline" && uv run --quiet ruff format "$file" && uv run --quiet ruff check --fix --quiet "$file") >&2 || exit 2
    elif command -v ruff >/dev/null; then
      ruff format -q "$file" && ruff check --fix -q "$file" >&2 || exit 2
    fi
    ;;
esac
exit 0
