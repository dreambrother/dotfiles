#!/usr/bin/env bash
# Проверяет, нужен ли USB-wakeup для пробуждения из сна, и при необходимости
# устанавливает udev-правило.
#
# Что делает:
#   1. Ищет любую USB-мышь в /sys/bus/usb/devices — по интерфейсу
#      bInterfaceClass=03 (HID) + bInterfaceProtocol=02 (mouse).
#   2. Собирает цепочку: мышь -> промежуточные USB-хабы -> root-хаб.
#   3. Смотрит текущее значение power/wakeup у каждого узла.
#   4. Если все узлы уже wakeup=enabled и правило установлено — выходит,
#      ничего не меняя (полезно для новых Fedora, где проблема может отпасть).
#   5. Иначе генерирует правило для найденной мыши, показывает что к чему
#      применяется, спрашивает подтверждение и применяет через sudo
#      (пароль спросит).
#
# Запуск от обычного пользователя (не root):
#     ./enable-mouse-wakeup.sh
set -euo pipefail

RULES_PATH="/etc/udev/rules.d/70-wakeusb.rules"

info() { printf '\033[1;34m%s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m%s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }

# --- 1. Ищем USB-мышь (интерфейс HID protocol 02 = mouse) ---
find_mouse() {
    for dev in /sys/bus/usb/devices/*/; do
        base=$(basename "$dev")
        [[ "$base" == usb* ]] && continue       # root-хаб
        [[ "$base" == *:* ]] && continue        # узел интерфейса
        [[ -f "${dev}power/wakeup" ]] || continue
        for iface in /sys/bus/usb/devices/"$base":*/; do
            cls=$(cat "$iface/bInterfaceClass" 2>/dev/null || true)
            proto=$(cat "$iface/bInterfaceProtocol" 2>/dev/null || true)
            if [[ "$cls" == "03" && "$proto" == "02" ]]; then
                echo "${dev%/}"
                return 0
            fi
        done
    done
    return 1
}

mouse=$(find_mouse) || {
    warn "USB-мышь не найдена — пропускаю (она не подключена?)."
    exit 0
}

MOUSE_VENDOR=$(cat "$mouse/idVendor")
MOUSE_PRODUCT=$(cat "$mouse/idProduct")

# --- 2. Собираем цепочку мышь -> хабы -> root-хаб ---
chain=()
node=$(readlink -f "$mouse")
while [[ -n "$node" ]]; do
    chain+=("$node")
    base=$(basename "$node")
    [[ "$base" == usb* ]] && break
    node=$(dirname "$node")
done

# --- 3. Текущее состояние ---
echo
info "Цепочка USB-узлов для мыши:"
disabled=0
declare -A state_of
for n in "${chain[@]}"; do
    wf="$n/power/wakeup"
    if [[ ! -f "$wf" ]]; then
        printf '  %-8s %-8s %s\n' "$(basename "$n")" "-" "$(cat "$n/product" 2>/dev/null || echo unknown)"
        continue
    fi
    st=$(cat "$wf")
    state_of["$n"]="$st"
    if [[ "$st" != "enabled" ]]; then
        disabled=1
        printf '  %-8s \033[1;31m%-8s\033[0m %s\n' "$(basename "$n")" "$st" "$(cat "$n/product" 2>/dev/null || echo unknown)"
    else
        printf '  %-8s \033[1;32m%-8s\033[0m %s\n' "$(basename "$n")" "$st" "$(cat "$n/product" 2>/dev/null || echo unknown)"
    fi
done

# --- 4. Генерируем правило ---
gen_rule() {
    cat <<EOF
# USB wakeup для пробуждения из сна (s2idle) движением мыши.
# Ресивер мыши часто воткнут в USB-хаб монитора: без wakeup на хабах
# сигнал от мыши не доходит до root-хаба. Правило:
#   1) включает wakeup только у самой мыши (листовое устройство);
#   2) включает wakeup у всех USB-хабов и root-хабов (class 09) —
#      чтобы сигнал от мыши мог пройти по цепочке. Остальные листовые
#      устройства остаются выключенными и не будут будить систему.
ACTION=="add", SUBSYSTEM=="usb", ATTRS{idVendor}=="$MOUSE_VENDOR", ATTRS{idProduct}=="$MOUSE_PRODUCT", ATTR{power/wakeup}="enabled"
ACTION=="add", SUBSYSTEM=="usb", ATTR{bDeviceClass}=="09", ATTR{power/wakeup}="enabled"
EOF
}
rule=$(gen_rule)

# --- 5. Проверяем, нужно ли что-то делать ---
rule_installed=0
if [[ -f "$RULES_PATH" ]] && [[ "$(cat "$RULES_PATH")" == "$rule" ]]; then
    rule_installed=1
fi

if [[ "$disabled" -eq 0 && "$rule_installed" -eq 1 ]]; then
    echo
    ok "Пробуждение уже настроено (все узлы wakeup=enabled, правило на месте). Ничего не делаю."
    exit 0
fi

echo
info "Обнаружено: $([ "$disabled" -eq 1 ] && echo "у части узлов wakeup выключен" || echo "правило не установлено")."
echo "Будет применено следующее правило:"
echo
sed 's/^/    /' <<<"$rule"
echo

# --- 6. Спрашиваем подтверждение ---
read -r -p "Применить? [y/N] " ans
if [[ ! "$ans" =~ ^[yYдД]$ ]]; then
    warn "Отменено, ничего не изменено."
    exit 0
fi

# --- 7. Применяем через sudo ---
echo "$rule" | sudo -p "Пароль для sudo: " tee "$RULES_PATH" >/dev/null
sudo chmod 644 "$RULES_PATH"
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=usb

echo
ok "Правило установлено: $RULES_PATH"
