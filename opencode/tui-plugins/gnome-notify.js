import { spawn } from "node:child_process"
import { existsSync } from "node:fs"

export default {
  id: "gnome-notify",
  tui: async ({ renderer, event, state }) => {
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

const last = new Map()
let lastId = 0

function debounce(key, ms = 3000) {
  const now = Date.now()
  if (now - (last.get(key) ?? 0) < ms) return true
  last.set(key, now)
  return false
}

function which(bin) {
  for (const p of [`/run/host/usr/bin/${bin}`, `/usr/bin/${bin}`]) {
    if (existsSync(p)) return { path: p, host: p.startsWith("/run/host/") }
  }
  for (const d of (process.env.PATH ?? "").split(":").filter(Boolean)) {
    const p = `${d}/${bin}`
    if (existsSync(p)) return { path: p, host: false }
  }
  return null
}

function hostEnv() {
  return {
    ...process.env,
    LD_LIBRARY_PATH: "/run/host/usr/lib64:/run/host/usr/lib",
  }
}

function activatePtyxis() {
  const gdbus = which("gdbus")
  if (!gdbus) return
  const child = spawn(
    gdbus.path,
    [
      "call", "--session",
      "--dest", "org.gnome.Ptyxis",
      "--object-path", "/org/gnome/Ptyxis",
      "--method", "org.freedesktop.Application.Activate",
      "{}",
    ],
    { stdio: "ignore", env: gdbus.host ? hostEnv() : undefined },
  )
  child.on("error", () => {})
}

function notify(summary, body, timeout = 5000) {
  const ns = which("notify-send")
  if (!ns) return
  const args = [
    "-a", "opencode",
    "-i", "opencode",
    "-u", "normal",
    "-t", String(timeout),
    "-A", "default=Open",
    "--wait",
    "-p",
  ]
  if (lastId) args.push("-r", String(lastId))
  args.push(summary, body)

  const child = spawn(ns.path, args, {
    stdio: ["ignore", "pipe", "ignore"],
    env: ns.host ? hostEnv() : undefined,
  })
  let buf = ""
  child.stdout?.on("data", (d) => {
    buf += d
    let nl
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      if (/^\d+$/.test(line)) { lastId = Number(line); continue }
      if (line === "default") { activatePtyxis(); continue }
    }
  })
  child.on("error", () => {})
}
