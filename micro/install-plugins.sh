#!/usr/bin/env bash
#
# Восстановление конфигурации и плагинов micro на чистой машине.
# Конфиги (settings.json, bindings.json) живут в этом каталоге и
# подключаются симлинками; плагины ставятся из своих репозиториев.
#
# Запуск: ./install-plugins.sh
#
# Состояние на 2026-09-08:
#   autofmt     3.0.0 — GitHub: a11ce/micro-autofmt
#                     (официальный канал отдаёт протухший 1.0.0 без команды fmt)
#   fzf         1.1.1 — официальный канал (там всё актуально)
#   lsp         0.6.3 — GitHub: AndCake/micro-plugin-lsp
#                     ВНИМАНИЕ: скрипт ставит чистый апстрим; локальные патчи
#                     (ветка on-demand, 4 коммита) сейчас живут только в
#                     локальном клоне ~/.config/micro/plug/lsp — форк на GitHub
#                     ещё не создан. Не потерять!
#   filemanager 4.0.0 — GitHub: HopperShell/filemanager-plugin
#                     (живой форк; оригинал мёртв с 2019)

set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${MICRO_CONFIG_DIR:-$HOME/.config/micro}"
PLUG_DIR="$CONFIG_DIR/plug"

mkdir -p "$PLUG_DIR"

link_config() {
	local name=$1
	if [[ -e "$CONFIG_DIR/$name" || -L "$CONFIG_DIR/$name" ]]; then
		echo "== $name: уже подключён, пропускаю"
	elif [[ -f "$DOTFILES_DIR/$name" ]]; then
		echo "== $name: симлинк из $DOTFILES_DIR"
		ln -s "$DOTFILES_DIR/$name" "$CONFIG_DIR/$name"
	fi
}

clone_if_missing() {
	local url=$1 dir=$2
	if [[ -d "$PLUG_DIR/$dir" ]]; then
		echo "== $dir: уже установлен, пропускаю"
	else
		echo "== $dir: клонирую $url"
		git clone --depth 1 "$url" "$PLUG_DIR/$dir"
	fi
}

# --- конфиги из dotfiles ---
link_config settings.json
link_config bindings.json

# --- плагины ---

# fzf — через официальный канал (менеджер плагинов micro)
if [[ -d "$PLUG_DIR/fzf" ]]; then
	echo "== fzf: уже установлен, пропускаю"
else
	echo "== fzf: ставлю из официального канала"
	micro -plugin install fzf
fi

clone_if_missing https://github.com/a11ce/micro-autofmt autofmt
clone_if_missing https://github.com/AndCake/micro-plugin-lsp lsp
clone_if_missing https://github.com/HopperShell/filemanager-plugin filemanager

echo
echo "Итог — $PLUG_DIR:"
ls -1 "$PLUG_DIR"
