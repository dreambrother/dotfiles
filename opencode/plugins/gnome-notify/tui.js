import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { Plugin } from "@opencode/plugin/tui"

// Desktop notifications through the host GNOME session (ptytui/VTE has no
// support for OpenCode's built-in OSC 777/9 notifications, so we drive the
// gjs DBus daemon that lives next to this file instead).
export default Plugin.define({
  id: "gnome-notify",
  setup(context) {
    const daemon = startDaemon()

    // "unknown" until the renderer reports focus/blur, mirroring the host
    // attention provider: notify only when we positively know we are blurred.
    let focus = "unknown"
    const onFocus = () => {
      focus = "focused"
    }
    const onBlur = () => {
      focus = "blurred"
    }
    context.renderer.on("focus", onFocus)
    context.renderer.on("blur", onBlur)

    const send = (fn) => {
      if (focus !== "blurred") return
      fn()
    }

    // Root-session only: subagent sessions stay quiet.
    const isRoot = (sessionID) => {
      if (!sessionID) return true
      const session = context.data.session.get(sessionID)
      return !session?.parentID
    }

    const stops = [
      context.data.on("permission.asked", (event) => {
        const p = event?.data ?? {}
        if (debounce(`perm:${p.sessionID}:${p.action}`)) return
        send(() => {
          const tool = p.action ?? "инструмент"
          const patterns = (p.resources ?? []).join(", ")
          notify(
            daemon,
            "OpenCode — запрос доступа",
            `Инструмент: ${tool}${patterns ? `\n${patterns}` : ""}`,
            10000,
          )
        })
      }),

      // V1 `question.asked` is a form in V2: the question tool creates a form
      // tagged with metadata.kind === "question".
      context.data.on("form.created", (event) => {
        const form = event?.data?.form
        if (!form) return
        const kind = form.metadata?.kind
        if (kind !== "question" && form.title !== "Questions") return
        if (debounce(`q:${form.sessionID}`)) return
        send(() => {
          const field = form.fields?.[0]
          const header = field?.title
          const question = field?.description ?? field?.placeholder ?? "Агент ждёт ответа"
          notify(
            daemon,
            `OpenCode — вопрос${header ? `: ${header}` : ""}`,
            String(question).slice(0, 300),
            15000,
          )
        })
      }),

      context.data.on("session.execution.succeeded", (event) => {
        const sessionID = event?.data?.sessionID
        if (!isRoot(sessionID)) return
        if (debounce(`idle:${sessionID}`)) return
        send(() => notify(daemon, "OpenCode — ответ готов", "Ассистент завершил работу", 5000))
      }),

      context.data.on("session.execution.failed", (event) => {
        const p = event?.data ?? {}
        if (!isRoot(p.sessionID)) return
        if (debounce(`error:${p.sessionID}`)) return
        send(() => {
          const err = p.error
          const text =
            typeof err === "string"
              ? err
              : (err?.message ?? err?.type ?? "В сессии произошла ошибка")
          notify(daemon, "OpenCode — ошибка", String(text).slice(0, 500), 8000)
        })
      }),
    ]

    return () => {
      for (const stop of stops) {
        try {
          stop()
        } catch {}
      }
      try {
        context.renderer.off("focus", onFocus)
      } catch {}
      try {
        context.renderer.off("blur", onBlur)
      } catch {}
      stopDaemon(daemon)
    }
  },
})

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
  if (!existsSync(daemonPath)) return null

  let child = null
  let broken = false
  let closed = false

  const launch = () => {
    broken = false
    try {
      child = spawn(gjs.path, [daemonPath], {
        stdio: ["pipe", "ignore", "ignore"],
        env: gjs.host ? gjsHostEnv() : undefined,
      })
    } catch {
      child = null
      broken = true
      return false
    }
    // Writes before "spawn" are buffered by the pipe, not dropped.
    const die = () => {
      broken = true
    }
    child.on("error", die)
    child.on("exit", die)
    child.stdin.on("error", die)
    return true
  }

  launch()

  return {
    write(line) {
      if (closed) return false
      // gjs died (e.g. session bus restart): bring it back on the next
      // notification instead of silently degrading to notify-send.
      if (!child || broken) {
        if (!launch()) return false
      }
      try {
        child.stdin.write(line)
        return true
      } catch {
        broken = true
        return false
      }
    },
    close() {
      closed = true
      try {
        if (child && !broken) child.stdin.write("exit\n")
      } catch {}
    },
  }
}

function stopDaemon(daemon) {
  if (!daemon) return
  try {
    daemon.close()
  } catch {}
}

function notify(daemon, summary, body, timeout = 5000) {
  if (daemon?.write(JSON.stringify({ summary, body, timeout }) + "\n")) return
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

function gjsHostEnv() {
  return {
    ...process.env,
    LD_LIBRARY_PATH: "/run/host/usr/lib64:/run/host/usr/lib64/gjs:/usr/lib64:/usr/lib64/gjs",
    GI_TYPELIB_PATH:
      "/run/host/usr/lib64/girepository-1.0:/run/host/usr/lib64/gjs/girepository-1.0:/usr/lib64/girepository-1.0:/usr/lib64/gjs/girepository-1.0",
  }
}

function hostEnv() {
  return {
    ...process.env,
    LD_LIBRARY_PATH: "/run/host/usr/lib64:/run/host/usr/lib",
  }
}
