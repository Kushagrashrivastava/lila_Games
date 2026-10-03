#!/usr/bin/env bash
# Stop: typecheck the web app before Claude finishes a turn. Exit 2 sends errors back so Claude fixes them.
input=$(cat)
# Avoid infinite loops: if we already blocked once this turn, let it stop.
[[ "$(jq -r '.stop_hook_active // false' <<<"$input")" == "true" ]] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
[[ -f "$root/web/tsconfig.json" && -x "$root/web/node_modules/.bin/tsc" ]] || exit 0

out=$(cd "$root/web" && ./node_modules/.bin/tsc -b --pretty false 2>&1)
if [[ $? -ne 0 ]]; then
  echo "TypeScript errors. Fix before finishing:" >&2
  echo "$out" | head -40 >&2
  exit 2
fi
exit 0
