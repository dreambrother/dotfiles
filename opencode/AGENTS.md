# Agent Communication Preferences

## Bilingual Mode (MANDATORY)

- **Thinking/Reasoning:** ONLY in English (internal monologue, analysis, planning)
- **Responses to user:** ONLY in Russian

## Environment & Running Commands (MANDATORY)

- **Do NOT investigate the environment** (searching for `docker`, `podman`,
  probing sockets, checking `JAVA_HOME`, listing toolboxes, etc.) before
  running build/test/lint commands. Just run the requested command directly
  (`mvn ...`, `npm ...`, `go ...`). Build tools (JDK, Maven, Go, Python, …)
  are installed on the host and available on `PATH`/`JAVA_HOME`.
- **Docker for tests:** there is no Docker on the host, but `DOCKER_HOST`
  points to the user podman socket
  (`unix://$XDG_RUNTIME_DIR/podman/podman.sock`, already exported in
  `~/.bashrc`). Testcontainers works out of the box — run tests directly, do
  not probe for Docker or create toolboxes for it.
- **Toolboxes:** when a check genuinely requires isolation or a container
  runtime missing on the host, creating a toolbox is allowed — but delete it
  after the work is done. Do NOT install anything into existing Fedora
  toolboxes without explicit user permission.
- **Heavy commands: full output to a file, context stays clean.** Any
  command that can potentially produce a large amount of output (tests,
  builds, lint runs, full logs, etc.) MUST be run with its entire output
  redirected to a file: `mvn test > /tmp/opencode/test-output.log 2>&1`
  (create the directory if needed). Two rules:
  1. **Do not lose output.** The complete log must land in the file;
     inspect it afterwards with the Grep/Read tools or `grep`/`tail`
     on the file. Never rely on output truncation — truncated logs hide
     the interesting lines and force a full re-run that wastes minutes
     of waiting.
  2. **Do not flood the context.** Do NOT use `tee` and do NOT let the
     raw log stream into stdout. How much of it to show is up to you:
     e.g. a final summary (`tail -n 50 <file>` to see test
     failure summaries / exit status), or nothing at all if you go
     straight to inspecting the file.

## Change Authorization (MANDATORY)

- **Do NOT make any code change** (edit, write, delete, rename, or run
  commands with side-effects like `git commit`) **unless** the user has
  **explicitly** requested that specific change in the current conversation
  turn.  Implicit requests or open-ended discussions (e.g. "what do you
  think about X?") do NOT authorize changes.
- When you identify a change you believe should be made, **ask first**
  with a brief summary: "Should I make change X?" — then wait for an
  explicit "yes", "давай", "go ahead", "do it", or equivalent before
  touching any files.
