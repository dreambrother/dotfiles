# Переназначение клавиш на внешней клавиатуре (udev hwdb)

Решает задачу переназначения клавиш **только на конкретной внешней клавиатуре**, не затрагивая встроенную клавиатуру ноутбука. Работает на уровне ядра (evdev), поэтому применяется везде: в Wayland/GNOME, в TTY, на экране входа — в отличие от X11-утилит (`xev`, `setxkbmap`), которые не действуют в Wayland-сессии.

Текущее правило: **правый Ctrl → Home** на клавиатуре *YJS MicroChip MKEY NOVA*.

## Куда положить

Файл `61-keyboard-local.hwdb` должен лежать в:

```
/etc/udev/hwdb.d/61-keyboard-local.hwdb
```

`/etc/` на Fedora Silverblue доступен для записи — `rpm-ostree` не нужен.

## Установка / применение

```bash
sudo cp 61-keyboard-local.hwdb /etc/udev/hwdb.d/
sudo systemd-hwdb update
sudo udevadm trigger /dev/input/event13   # event-узел клавиатуры (см. ниже, как найти)
```

Изменения вступают в силу сразу, перезагрузка не требуется.

## Как это работает

1. Ядро при подключении клавиатуры создаёт input-устройство с **modalias** вида `input:b0003v5566p000Ae0110-...`, где закодированы bus/vendor/product.
2. udev-правило `60-evdev.rules` передаёт modalias во встроенную hwdb-базу (`IMPORT{builtin}="hwdb --subsystem=input --lookup-prefix=evdev:"`).
3. При совпадении ключа `evdev:input:b...` udev читает строки `KEYBOARD_KEY_<scancode>=<action>` и через `EVIOCSKEYCODE` ioctl перепрограммирует keycode прямо в ядре.
4. Результат: нажатие физической клавиши сразу генерирует нужный `KEY_*` код, до любого пользовательского композитора.

Проверить, что правило применилось:

```bash
udevadm info -q property -n /dev/input/event13 | grep KEYBOARD_KEY
# должно показать: KEYBOARD_KEY_e4=home
```

## Структура правила

```
evdev:input:b<bus>v<vend>p<prod>*
 KEYBOARD_KEY_<scancode>=<действие>
```

- **`<bus>`** — тип шины из 4 hex-цифр:
  - `0003` — **USB** (провод / 2.4 ГГц донгл)
  - `0005` — **Bluetooth** (HID)
  - `0011` — встроенная AT-клавиатура (i8042) — здесь не используется.
- **`<vend>` / `<prod>`** — vendor ID и product ID (4 hex-цифры каждый, в верхнем регистре).
- `*` в конце — wildcard; можно уточнять по версии/возможностям, но обычно не нужно.
- Перед строкой `KEYBOARD_KEY_*` **обязателен один пробел** (синтаксис hwdb).
- Один блок `evdev:` может содержать несколько строк `KEYBOARD_KEY_*`.

### Как узнать bus/vendor/product своей клавиатуры

```bash
# Все input-устройства с их modalias и именами:
grep -H . /sys/class/input/event*/device/id/{vendor,product,bustype} 2>/dev/null
# или для конкретного узла (пример — event13):
cat /sys/class/input/event13/device/modalias
# → input:b0003v5566p000Ae0110-...     (b=0003 USB, v=5566, p=000A)
```

### Как узнать scancode нужной клавиши

Самый надёжный способ — снять реальный код с устройства. Скрипт `scancap.py` из этой же папки:

```bash
sudo ./scancap.py /dev/input/event13        # слушает 12 с (по умолчанию)
sudo ./scancap.py /dev/input/event13 20     # произвольная длительность, сек
```

При нажатии клавиши виден `MSC_SCAN = 0x700e4`. Либо вручную через `libinput`:

```bash
sudo libinput debug-events --device /dev/input/event13
# при нажатии клавиши виден MSC_SCAN=0x700e4
```

Формат scancode для **USB/Bluetooth HID-клавиатур**: `700` + HID usage-код (страница 0x07 «Keyboard»). Примеры:

| Клавиша            | HID usage | Scancode в hwdb |
|--------------------|-----------|-----------------|
| Левый Ctrl         | 0xe0      | `700e0`         |
| **Правый Ctrl**    | 0xe4      | **`700e4`**     |
| Левый Shift        | 0xe1      | `700e1`         |
| Правый Shift       | 0xe5      | `700e5`         |
| Левый Alt          | 0xe2      | `700e2`         |
| Правый Alt (AltGr) | 0xe6      | `700e6`         |
| Левый Win          | 0xe3      | `700e3`         |
| Правый Win         | 0xe7      | `700e7`         |
| CapsLock           | 0x39      | `70039`         |

> Примечание: hwdb также принимает сокращённую форму без префикса `700` (например `e4`), но полная форма `700e4` предпочтительна — она однозначна и совпадает с реальным `MSC_SCAN`.

### Действия (target keycode)

Имена берутся из Linux `input-event-codes.h` в нижнем регистре без префикса `KEY_`. Часто используемые: `home`, `end`, `pageup`, `pagedown`, `leftctrl`, `rightctrl`, `leftalt`, `rightalt`, `capslock`, `esc`, `insert`, `delete`, `f1`–`f24`, `space`, `enter`, `tab`, `backspace`.

## Несколько устройств / несколько клавиш

Эта клавиатура (MKEY NOVA) определяется по-разному в зависимости от транспорта:

```hwdb
# USB (провод / 2.4 ГГц донгл) — есть vendor:product (5566:000a)
evdev:input:b0003v5566p000A*
 KEYBOARD_KEY_700e4=home

# Bluetooth — vendor:product нулевые (0000:0000), но modalias-матч по bus
# (b0005) всё равно срабатывает: это первый lookup в 60-evdev.rules,
# работает для любого event-устройства безусловно.
evdev:input:b0005v0000p0000*
 KEYBOARD_KEY_700e4=home
```

> Нюанс BT: дешёвые BT-HID клавиатуры часто не передают meaningful vendor/product (ядро видит `0000:0000`). Матч `evdev:input:b0005v0000p0000*` широковат (любое BT-HID с нулевым ID), но на практике нулевые ID встречаются редко; если на одной машине окажется несколько таких устройств, дополнительно сузить можно через name+DMI-матч (см. ниже). Матч только по имени (`evdev:name:<имя>:*`) **не работает** — name-lookup в `60-evdev.rules` требует `:dmi:`-часть, формат: `evdev:name:<имя>:dmi:bvn*:bvr*:bd*:svn<вендор>:*`.

Можно перечислять сколько угодно блоков (для каждого устройства — свой) и сколько угодно строк `KEYBOARD_KEY_*` внутри блока.

## Откат

```bash
sudo rm /etc/udev/hwdb.d/61-keyboard-local.hwdb
sudo systemd-hwdb update
sudo udevadm trigger /dev/input/event13
```
