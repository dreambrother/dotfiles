import { spawn } from "node:child_process"
import { existsSync } from "node:fs"

export default {
  id: "gnome-notify",
  tui: async ({ renderer, event, state }) => {
    const daemon = startDaemon()
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
        notify(daemon, "OpenCode — запрос доступа", `Инструмент: ${tool}${patterns ? `\n${patterns}` : ""}`, 10000)
      })
    })

    event.on("question.asked", (e) => {
      const p = e?.properties ?? {}
      if (debounce(`q:${p.sessionID}`)) return
      send(() => {
        const q = p.questions?.[0]
        notify(
          daemon,
          `OpenCode — вопрос${q?.header ? `: ${q.header}` : ""}`,
          (q?.question ?? "Агент ждёт ответа").slice(0, 300),
          15000,
        )
      })
    })

    event.on("session.idle", (e) => {
      const p = e?.properties ?? {}
      const s = state.session.get(p.sessionID)
      if (s?.parentID) return
      if (debounce(`idle:${p.sessionID}`)) return
      send(() => notify(daemon, "OpenCode — ответ готов", "Ассистент завершил работу", 5000))
    })

    event.on("session.error", (e) => {
      const p = e?.properties ?? {}
      const s = state.session.get(p.sessionID)
      if (s?.parentID) return
      if (debounce(`error:${p.sessionID}`)) return
      send(() => {
        const err = p.error
        const text = typeof err === "string" ? err : (err?.data?.message ?? err?.message ?? err?.name ?? "В сессии произошла ошибка")
        notify(daemon, "OpenCode — ошибка", String(text).slice(0, 500), 8000)
      })
    })
  },
}

const last = new Map()

function debounce(key, ms = 3000) {
  const now = Date.now()
  if (now - (last.get(key) ?? 0) < ms) return true
  last.set(key, now)
  return false
}

function findGjs() {
  for (const p of ["/run/host/usr/bin/gjs", "/usr/bin/gjs"]) {
    if (existsSync(p)) return { path: p, host: p.startsWith("/run/host/") }
  }
  return null
}

function startDaemon() {
  const gjs = findGjs()
  if (!gjs) return null
  const daemonPath = `${import.meta.dirname}/gnome-notify-daemon.js`
  const child = spawn(gjs.path, [daemonPath], {
    stdio: ["pipe", "ignore", "ignore"],
    env: gjs.host
      ? {
          ...process.env,
          LD_LIBRARY_PATH: "/run/host/usr/lib64:/run/host/usr/lib64/gjs:/usr/lib64:/usr/lib64/gjs",
          GI_TYPELIB_PATH: "/run/host/usr/lib64/girepository-1.0:/run/host/usr/lib64/gjs/girepository-1.0:/usr/lib64/girepository-1.0:/usr/lib64/gjs/girepository-1.0",
        }
      : undefined,
  })
  child.on("error", () => {})
  return child
}

function notify(daemon, summary, body, timeout = 5000) {
  if (daemon) {
    try {
      daemon.stdin.write(JSON.stringify({ summary, body, timeout }) + "\n")
      return
    } catch {}
  }
  const ns = which("notify-send")
  if (!ns) return
  const child = spawn(
    ns.path,
    [
      "-a", "opencode",
      "-i", "opencode",
      "-u", "normal",
      "-t", String(timeout),
      summary,
      body,
    ],
    { stdio: "ignore", env: ns.host ? hostEnv() : undefined },
  )
  child.on("error", () => {})
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
