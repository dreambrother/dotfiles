#!/usr/bin/env python3
"""Удаление секрета из Secret Service (gnome-keyring) без OpenSession.

Обход бага gnome-keyring: OpenSession падает по SIGABRT, если одноразовый
клиент вызывает его сразу после установки D-Bus-соединения (запись
ServiceClient создаётся отложенным idle). Тикет #190, фикс в MR !112.
https://gitlab.gnome.org/GNOME/gnome-keyring/-/work_items/190

Обычные клиенты (secret-tool, gdbus, secretstorage.search_items) всегда
открывают сессию и могут уронить демон. Здесь мы перебираем коллекции и
элементы через свойства (Service.Collections -> Collection.Items ->
Item.Attributes) и удаляем нужные через Item.Delete — ни один из этих
вызовов сессии не требует, багованный путь не задействуется.

Использование:
    clear-openconnect-otp.py [-n] <vpn_uuid> [label]

label по умолчанию — secondary_password. -n/--dry-run только показывает,
что было бы удалено, и ничего не трогает.
"""

import sys

import gi

gi.require_version("Gio", "2.0")
from gi.repository import Gio, GLib  # noqa: E402

BUS_NAME = "org.freedesktop.secrets"
SERVICE_PATH = "/org/freedesktop/secrets"
PROPERTIES_IFACE = "org.freedesktop.DBus.Properties"
SERVICE_IFACE = "org.freedesktop.Secret.Service"
COLLECTION_IFACE = "org.freedesktop.Secret.Collection"
ITEM_IFACE = "org.freedesktop.Secret.Item"


def usage(ret=2):
    print(__doc__.strip(), file=sys.stderr)
    sys.exit(ret)


def get_property(bus, path, iface, prop):
    variant = bus.call_sync(
        BUS_NAME,
        path,
        PROPERTIES_IFACE,
        "Get",
        GLib.Variant("(ss)", (iface, prop)),
        GLib.VariantType("(v)"),
        Gio.DBusCallFlags.NONE,
        -1,
        None,
    )
    return variant.unpack()[0]


def main(argv):
    dry_run = False
    args = []
    for arg in argv[1:]:
        if arg in ("-h", "--help"):
            usage(0)
        elif arg in ("-n", "--dry-run"):
            dry_run = True
        else:
            args.append(arg)

    if len(args) not in (1, 2):
        usage(2)
    vpn_uuid = args[0]
    label = args[1] if len(args) == 2 else "secondary_password"
    wanted = {"vpn_uuid": vpn_uuid, "label": label}

    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)

    try:
        collections = get_property(bus, SERVICE_PATH, SERVICE_IFACE, "Collections")
        items = []
        for collection in collections:
            for item in get_property(bus, collection, COLLECTION_IFACE, "Items"):
                attrs = get_property(bus, item, ITEM_IFACE, "Attributes")
                if all(attrs.get(key) == value for key, value in wanted.items()):
                    items.append(item)
    except GLib.Error as err:
        print(f"clear-openconnect-otp: {err.message}", file=sys.stderr)
        return 1

    removed = 0
    for item in items:
        if dry_run:
            print(f"clear-openconnect-otp: would delete {item}")
            removed += 1
            continue
        try:
            bus.call_sync(
                BUS_NAME,
                item,
                ITEM_IFACE,
                "Delete",
                None,
                None,
                Gio.DBusCallFlags.NONE,
                -1,
                None,
            )
            removed += 1
        except GLib.Error as err:
            print(f"clear-openconnect-otp: {item}: {err.message}", file=sys.stderr)

    verb = "would delete" if dry_run else "deleted"
    print(
        f"clear-openconnect-otp: {verb} {removed} item(s) "
        f"for vpn_uuid={vpn_uuid} label={label}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
