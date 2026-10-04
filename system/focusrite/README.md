# Focusrite Scarlett Solo 2nd Gen: не переживает sleep/resume

Карта Focusrite Scarlett Solo **2nd Gen** (`1235:8205`) после выхода из сна
(`s2idle`) периодически не поднимается: в логах вместо нормального

```
usb 5-1.2: reset high-speed USB device number N using xhci_hcd
```

появляется

```
usb 5-1.2: USB disconnect, device number N
```

и карта пропадает с шины до физического перетыка (снятия/подачи VBUS).
Остальные USB-устройства (клава/мышь/вебка/Bluetooth) всегда переживают сон
штатно — проблема именно в карте.

## Причина

Это баг USB-прошивки карты: она не способна корректно «мягко» продолжить работу
после resume. Воспроизводится и при подключении карты напрямую в ноутбук, и на
macOS. На Mac почти не проявляется только потому, что macOS во сне периодически
дёргает питание USB-портов (карта при этом «моргает» — включается/выключается);
этот power-cycle её и лечит. Linux в `s2idle` питание порта во сне не снимает,
карта залипает.

Ядро уже содержит аналогичный обходной путь для Scarlett Solo **3rd Gen**
(`1235:8211`) — `USB_QUIRK_DISCONNECT_SUSPEND` (`drivers/usb/core/quirks.c`), а
для 2nd Gen записи нет. Ставим тот же квирк вручную.

## Решение

Квирк ядра через параметр `usbcore.quirks=VID:PID:флаги`, где `m` =
`USB_QUIRK_DISCONNECT_SUSPEND` (BIT 12): при засыпании ядро выключает порт карты
(`usb_port_disable` → `hub_port_disable`), а после пробуждения карта
перечисляется заново с нуля — вместо кривого reset-resume.

### Рантайм (без перезагрузки, до выключения)

```bash
echo 1235:8205:m | sudo tee /sys/module/usbcore/parameters/quirks
 # переткнуть карту
cat /sys/bus/usb/devices/5-1.2/quirks            # ожидаем 0x1000
```

`0x1000` = BIT 12 (`USB_QUIRK_DISCONNECT_SUSPEND`) — флаг сел. Рантайм-значение
живёт до перезагрузки.

### Постоянно (Fedora Atomic / ostree, загрузчик GRUB)

`/etc/default/grub` и `grubby` на ostree-системе отсутствуют, параметры ядра
правятся через `rpm-ostree` (создаёт новый deployment, нужен ребут):

```bash
sudo rpm-ostree kargs --append-if-missing='usbcore.quirks=1235:8205:m'
sudo systemctl reboot

cat /proc/cmdline | tr ' ' '\n' | grep usbcore   # проверить после ребута
```

### Проверка

```bash
cat /sys/bus/usb/devices/5-1.2/quirks            # 0x1000
# усыпить/разбудить систему и убедиться, что карта на месте:
lsusb -d 1235:8205
```

Имя узла `5-1.2` зависит от порта/топологии; если карта подключена иначе —
уточнить через `lsusb -t` или `readlink -f /sys/bus/usb/devices/*/5-*`.

### Откат

```bash
# рантайм: сбросить список или просто перезагрузиться
echo -n '' | sudo tee /sys/module/usbcore/parameters/quirks

# постоянно:
sudo rpm-ostree kargs --delete='usbcore.quirks=1235:8205:m'
```

## Если не поможет

Попробовать `b` = `USB_QUIRK_RESET_RESUME` (BIT 1) — полный reset+перечислить
карты на каждом resume вместо выключения порта:

```
usbcore.quirks=1235:8205:b      # рантайм: ...:b, ожидаем quirks == 0x2
```

## Справочник флагов (буквы из `usbcore.quirks`)

| Буква | Бит | Флаг                       | Смысл                                        |
|-------|-----|----------------------------|----------------------------------------------|
| `b`   | 1   | `USB_QUIRK_RESET_RESUME`   | сбросить устройство на resume               |
| `m`   | 12  | `USB_QUIRK_DISCONNECT_SUSPEND` | отключить порт перед сном               |

Флаги конкатенируются: `usbcore.quirks=1235:8205:bm`. Динамические квирки
применяются через XOR со статическими (`quirks.c`), но у карты статических нет.
