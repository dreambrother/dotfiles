#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
    cat <<'EOF'
Usage: apply-devcontainer.sh <template> <project> <lang> <target...>

  template - имя json-шаблона из этой папки (например go.json или go-sub.json)
  project  - значение плейсхолдера $project
  lang     - значение плейсхолдера $lang
  target   - целевые папки (поддерживается glob, например ~/sources/hms-*)

Скрипт копирует шаблон в <target>/.devcontainer/devcontainer.json,
заменяя в нём плейсхолдеры $project, $module и $lang.
$module берётся из имени целевой папки.
EOF
}

if [[ $# -lt 4 ]]; then
    usage
    exit 1
fi

template="$1"
project="$2"
lang="$3"
shift 3

src="$SCRIPT_DIR/$template"
if [[ ! -f "$src" ]]; then
    echo "error: template not found: $src" >&2
    exit 1
fi

apply() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        echo "skip: not a directory: $dir" >&2
        return
    fi
    mkdir -p "$dir/.devcontainer"
    local dst="$dir/.devcontainer/devcontainer.json"
    local module
    module="$(basename -- "$dir")"
    local content
    content="$(<"$src")"
    content="${content//\$project/$project}"
    content="${content//\$module/$module}"
    content="${content//\$lang/$lang}"
    printf '%s\n' "$content" > "$dst"
    echo "ok: $dst"
}

for arg in "$@"; do
    if [[ "$arg" == \~/* ]]; then
        arg="$HOME/${arg#\~/}"
    fi
    if [[ "$arg" == *['*?[']* ]]; then
        shopt -s nullglob
        matches=( $arg )
        shopt -u nullglob
        if (( ${#matches[@]} == 0 )); then
            echo "no matches for: $arg" >&2
            continue
        fi
        for dir in "${matches[@]}"; do
            apply "$dir"
        done
    else
        apply "$arg"
    fi
done
