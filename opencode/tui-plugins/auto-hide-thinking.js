export default {
  id: "auto-hide-thinking",
  tui: async ({ event, kv, route }) => {
    const set = (mode) => {
      if (kv.get("thinking_mode", "hide") === mode) return
      kv.set("thinking_mode", mode)
    }

    event.on("message.part.updated", (e) => {
      const part = e?.properties?.part
      if (part?.type !== "reasoning") return
      const current = route.current
      if (current?.name !== "session" || current.params?.sessionID !== part.sessionID) return
      set(part.time?.end === undefined ? "show" : "hide")
    })
  },
}