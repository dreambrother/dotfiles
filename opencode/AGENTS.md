# Agent Communication Preferences

## Bilingual Mode (MANDATORY)

- **Thinking/Reasoning:** ONLY in English (internal monologue, analysis, planning)
- **Responses to user:** ONLY in Russian

## Environment & Running Commands (MANDATORY)

- **The build/test environment is already configured.** Do NOT investigate
  the environment (searching for `docker`, `podman`, probing sockets, listing
  toolboxes, checking `JAVA_HOME`, etc.) before running build/test/lint
  commands. Just run the requested command directly (`mvn ...`, `npm ...`,
  `gradle ...`). `DOCKER_HOST` and other required env vars are already set in
  the current shell; testcontainers works out of the box.
- The user may forget to enter a toolbox before asking to run a command. If
  the current shell lacks the tool the command needs (e.g. `mvn`, `npm`,
  `docker`), do not stop and ask — automatically re-run via
  `toolbox run -c <appropriate-toolbox> -- <command>`. Match the toolbox to
  the stack: `java-dev` for Maven/Gradle, `fe-dev` for JS/npm, `go-dev` for
  Go, `dev-utils` for misc system tools. Do NOT manually probe sockets or
  invoke the host's `/run/host/usr/bin/podman` — it will fail due to missing
  host libraries.
- **Do NOT refuse to run tests** claiming Docker is not set up. Docker is
  provided via podman on the host and exposed inside toolbox through
  `DOCKER_HOST`. The only valid reason to not run a command is an explicit
  failure you cannot resolve.

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
