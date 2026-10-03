#!/usr/bin/env bash
# PreToolUse: keep data/raw/ read-only. Unzipping INTO it is allowed; editing/deleting/moving is not.
input=$(cat)
tool=$(jq -r '.tool_name // ""' <<<"$input")

if [[ "$tool" == "Bash" ]]; then
  cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
  if [[ "$cmd" == *"data/raw"* ]] && grep -Eq '(^|[;&| ])(rm|mv|truncate|shred)[[:space:]]|sed[[:space:]]+-i|>[[:space:]]*[^ ]*data/raw' <<<"$cmd"; then
    echo "Blocked: data/raw/ is read-only source data. Write derived output to web/public/data/ or pipeline/debug/out/ instead." >&2
    exit 2
  fi
  exit 0
fi

path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' <<<"$input")
if [[ "$path" == *"/data/raw/"* || "$path" == data/raw/* ]]; then
  echo "Blocked: data/raw/ is read-only source data. Write derived output elsewhere." >&2
  exit 2
fi
exit 0
