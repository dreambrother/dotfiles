const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GioUnix = imports.gi.GioUnix;

const bus = Gio.bus_get_sync(Gio.BusType.SESSION, null);
print('READY');

const istream = new Gio.DataInputStream({
  base_stream: new GioUnix.InputStream({ fd: 0 }),
});

while (true) {
  const [line, err] = istream.read_line_utf8(null);
  if (line === null) break;
  const text = line.trim();
  if (text === 'exit') break;
  if (!text) continue;

  const parts = text.split('|');
  const summary = parts[0] || 'OpenCode';
  const body = parts[1] || '';
  const timeout = parseInt(parts[2] || '8000', 10);

  const tuple = GLib.Variant.new_tuple([
    new GLib.Variant('s', 'opencode'),
    new GLib.Variant('u', 0),
    new GLib.Variant('s', 'opencode'),
    new GLib.Variant('s', summary),
    new GLib.Variant('s', body),
    new GLib.Variant('as', ['default', 'Open']),
    new GLib.Variant('a{sv}', {}),
    new GLib.Variant('i', timeout),
  ]);

  const reply = bus.call_sync(
    'org.freedesktop.Notifications', '/org/freedesktop/Notifications',
    'org.freedesktop.Notifications', 'Notify',
    tuple, null, Gio.DBusCallFlags.NONE, 30000, null
  );
  const id = reply.get_child_value(0).get_uint32();
  print('ID ' + id);
}