const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GioUnix = imports.gi.GioUnix;

const DEBUG = ARGV.indexOf("--debug") >= 0;
const LOG = "/tmp/opencode/gnome-notify-daemon.log";
function dbg(...a) {
  if (!DEBUG) return;
  try {
    let prev = "";
    try { prev = GLib.file_get_contents(LOG)[1]?.toString() ?? ""; } catch (e) {}
    GLib.file_set_contents(LOG, prev + a.map(String).join(" ") + "\n");
  } catch (e) {}
}

const bus = Gio.bus_get_sync(Gio.BusType.SESSION, null);
const loop = new GLib.MainLoop(null, false);
let lastId = 0;

function activatePtyxis() {
  try {
    bus.call_sync(
      "org.gnome.Ptyxis", "/org/gnome/Ptyxis",
      "org.freedesktop.Application", "Activate",
      new GLib.Variant("(a{sv})", [{}]),
      null, Gio.DBusCallFlags.NONE, -1, null);
  } catch (e) { dbg("activate error", String(e)); }
}

bus.signal_subscribe(
  null, "org.freedesktop.Notifications", "ActionInvoked",
  "/org/freedesktop/Notifications", null, Gio.DBusSignalFlags.NONE,
  (conn, sender, path, iface, signal, params) => {
    try {
      const [id, action] = params.deep_unpack();
      dbg("ActionInvoked", String(id), String(action));
      if (action === "default") activatePtyxis();
    } catch (e) { dbg("signal error", String(e)); }
  });

function handle(line) {
  let msg;
  try { msg = JSON.parse(line); } catch (e) { dbg("bad json", line); return; }
  const summary = String(msg.summary ?? "OpenCode");
  const body = String(msg.body ?? "");
  const timeout = Math.max(1, parseInt(msg.timeout, 10) || 5000);
  dbg("send", summary, "timeout", timeout);
  const tuple = GLib.Variant.new_tuple([
    new GLib.Variant("s", "opencode"),
    new GLib.Variant("u", lastId),
    new GLib.Variant("s", "opencode"),
    new GLib.Variant("s", summary),
    new GLib.Variant("s", body),
    new GLib.Variant("as", ["default", "Open"]),
    new GLib.Variant("a{sv}", {}),
    new GLib.Variant("i", timeout),
  ]);
  try {
    const reply = bus.call_sync(
      "org.freedesktop.Notifications", "/org/freedesktop/Notifications",
      "org.freedesktop.Notifications", "Notify",
      tuple, null, Gio.DBusCallFlags.NONE, 30000, null);
    if (reply) lastId = reply.deep_unpack()[0];
  } catch (e) { dbg("notify error", String(e)); }
}

const stream = new Gio.DataInputStream({
  base_stream: new GioUnix.InputStream({ fd: 0 }),
});
function readNext() {
  stream.read_line_async(GLib.PRIORITY_DEFAULT, null, (s, res) => {
    let line = null;
    try { line = s.read_line_finish_utf8(res)[0]; } catch (e) {}
    if (line === null) { loop.quit(); return; }
    const text = line.trim();
    if (text === "exit") { loop.quit(); return; }
    if (text) handle(text);
    readNext();
  });
}
readNext();
loop.run();
