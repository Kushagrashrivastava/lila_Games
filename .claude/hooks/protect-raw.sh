#!/usr/bin/env bash
# PreToolUse: keep data/raw/ read-only. Unzipping/copying INTO it is allowed; editing/deleting/moving is not.
input=$(cat)
tool=$(jq -r '.tool_name // ""' <<<"$input")

block() {
  echo "Blocked: data/raw/ is read-only source data. Write derived output to web/public/data/ or pipeline/debug/out/ instead." >&2
  exit 2
}

if [[ "$tool" == "Bash" ]]; then
  cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
  # Drop single-quoted text (sed/awk expressions, messages). Paths are usually double-quoted
  # here because the project dir has a space, so those are still checked.
  cmd=$(sed "s/'[^']*'//g" <<<"$cmd")
  [[ "$cmd" == *data/raw* ]] || exit 0
  # Only block when a destructive command targets data/raw within the same command segment,
  # not when "data/raw" merely appears as text (e.g. inside a quoted sed expression editing CLAUDE.md).
  destructive='(^|[;&|][[:space:]]*)(rm|mv|truncate|shred)[[:space:]][^;&|]*data/raw'
  redirect='>[[:space:]]*[^[:space:]]*data/raw/'
  sed_target="sed[[:space:]]+-i[^;&|]*[[:space:]][^[:space:]'\"]*data/raw/[^[:space:]'\"]*([[:space:]]|$)"
  for re in "$destructive" "$redirect" "$sed_target"; do
    grep -Eq -- "$re" <<<"$cmd" && block
  done
  exit 0
fi

path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' <<<"$input")
[[ "$path" == *"/data/raw/"* || "$path" == data/raw/* ]] && block
exit 0
