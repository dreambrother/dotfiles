#!/usr/bin/env python3
"""Снимает HID scancode с input-устройства.

Использование:
    scancap.py /dev/input/event13 [секунд]

В течение заданного времени (по умолчанию 12 с) печатает MSC_SCAN (hex)
и keycode каждого нажатия. Нужно для подбора scancode в hwdb-правилах.
Запуск требует прав root (чтение /dev/input/eventX).
"""
import struct, sys, time

path = sys.argv[1]
duration = int(sys.argv[2]) if len(sys.argv) > 2 else 12
fmt = struct.Struct("=llHHi")  # sec, usec, type, code, value (24 байта input_event на 64-bit)
scan = None

print(f"Listening {path} for {duration}s. Press the target key several times now.")
with open(path, "rb") as f:
    end = time.time() + duration
    while time.time() < end:
        data = f.read(fmt.size)
        if len(data) < fmt.size:
            continue
        _, _, etype, code, value = fmt.unpack(data)
        if etype == 4 and code == 4:          # EV_MSC / MSC_SCAN
            scan = value
            print(f"  MSC_SCAN = 0x{value:x}")
        elif etype == 1:                       # EV_KEY
            s = f"0x{scan:x}" if scan is not None else "none"
            print(f"    KEY code={code} value={value}  (last scan={s})")
print("Done.")
