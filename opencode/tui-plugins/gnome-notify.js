import { spawn } from "node:child_process"
import { existsSync } from "node:fs"

const last = new Map()
const notified = new Set()
let daemon = null

function debounce(key, ms = 3000) {
  const now = Date.now()
  if (now - (last.get(key) ?? 0) < ms) return true
  last.set(key, now)
  return false
}

function findGjs() {
  for (const p of ["/run/host/usr/bin/gjs", "/usr/bin/gjs"]) {
    if (existsSync(p)) return p
  }
  return null
}

function startDaemon() {
  const gjs = findGjs()
  if (!gjs) return
  const daemonPath = existsSync("/var/home/nvs/dotfiles/opencode/tui-plugins/gnome-notify-daemon.js")
    ? "/var/home/nvs/dotfiles/opencode/tui-plugins/gnome-notify-daemon.js"
    : existsSync(import.meta.dirname + "/gnome-notify-daemon.js")
      ? import.meta.dirname + "/gnome-notify-daemon.js"
      : null
  if (!daemonPath) return
  daemon = spawn(gjs, [daemonPath], {
    env: {
      ...process.env,
      LD_LIBRARY_PATH: "/run/host/usr/lib64:/run/host/usr/lib64/gjs:/usr/lib64:/usr/lib64/gjs",
      GI_TYPELIB_PATH: "/run/host/usr/lib64/girepository-1.0:/run/host/usr/lib64/gjs/girepository-1.0:/usr/lib64/girepository-1.0:/usr/lib64/gjs/girepository-1.0",
    },
    stdio: ["pipe", "pipe", "ignore"],
  })
  daemon.stdout?.on("data", (d) => {
    const m = d.toString().match(/ID\s+(\d+)/)
    if (m) notified.add(Number(m[1]))
  })
  daemon.on("close", () => { daemon = null })
}

function notify(summary, body, timeout = 5000) {
  if (!daemon) startDaemon()
  if (!daemon) return
  try {
    daemon.stdin.write(`${summary}|${body}|${timeout}\n`)
  } catch {
    daemon = null
  }
}

function monitorActionInvoked() {
  const child = spawn(
    "gdbus",
    ["monitor", "--session", "--dest", "org.gnome.Shell", "--object-path", "/org/freedesktop/Notifications"],
    { stdio: ["ignore", "pipe", "ignore"] },
  )
  let buf = ""
  child.stdout?.on("data", (d) => {
    buf += d
    let idx
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line) continue
      const m = line.match(/ActionInvoked\s+\(uint32\s+(\d+),\s*'default'\)/)
      if (m && notified.has(Number(m[1]))) {
        notified.delete(Number(m[1]))
        activatePtyxis()
      }
    }
  })
  child.on("error", () => {})
}

function activatePtyxis() {
  const child = spawn(
    "gdbus",
    [
      "call", "--session",
      "--dest", "org.gnome.Ptyxis",
      "--object-path", "/org/gnome/Ptyxis",
      "--method", "org.freedesktop.Application.Activate",
      "{}",
    ],
    { stdio: "ignore" },
  )
  child.on("error", () => {})
}

export default {
  id: "gnome-notify",
  tui: async ({ renderer, event, state }) => {
    monitorActionInvoked()
    let focused = true
    renderer.on("focus", () => { focused = true })
    renderer.on("blur", () => { focused = false })

    const send = (fn) => {
      if (focused) return
      fn()
    }

    event.on("permission.asked", (e) => {
      const p = e?.properties ?? {}
      if (debounce(`perm:${p.sessionID}:${p.permission}`)) return
      send(() => {
        const tool = p.permission ?? "инструмент"
        const patterns = (p.patterns ?? []).join(", ")
        notify("OpenCode — запрос доступа", `Инструмент: ${tool}${patterns ? `\n${patterns}` : ""}`, 10000)
      })
    })

    event.on("session.idle", (e) => {
      const p = e?.properties ?? {}
      const s = state.session.get(p.sessionID)
      if (s?.parentID) return
      if (debounce(`idle:${p.sessionID}`)) return
      send(() => notify("OpenCode — ответ готов", "Ассистент завершил работу", 5000))
    })

    event.on("session.error", (e) => {
      const p = e?.properties ?? {}
      const s = state.session.get(p.sessionID)
      if (s?.parentID) return
      if (debounce(`error:${p.sessionID}`)) return
      send(() => {
        const err = p.error
        const text = typeof err === "string" ? err : (err?.data?.message ?? err?.message ?? err?.name ?? "В сессии произошла ошибка")
        notify("OpenCode — ошибка", String(text).slice(0, 500), 8000)
      })
    })
  },
}