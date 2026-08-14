import { spawn } from "node:child_process"

const last = new Map()

function debounce(key, ms = 3000) {
  const now = Date.now()
  if (now - (last.get(key) ?? 0) < ms) return true
  last.set(key, now)
  return false
}

function notify(summary, body, timeout = 5000) {
  const child = spawn(
    "notify-send",
    [
      "-a", "opencode",
      "-i", "opencode",
      "-u", "normal",
      "-t", String(timeout),
      "-A", "default=Open",
      "--wait",
      summary,
      body,
    ],
    { stdio: ["ignore", "pipe", "ignore"] },
  )
  let out = ""
  child.stdout?.on("data", (d) => { out += d })
  child.on("error", () => {})
  child.on("close", () => {
    if (out.trim() === "default") activatePtyxis()
  })
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
