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
  the stack: `java-dev` for Maven/Gradle, `go-dev` for
  Go, etc. Do NOT manually probe sockets or
  invoke the host's `/run/host/usr/bin/podman` — it will fail due to missing
  host libraries.
- **Do NOT refuse to run tests** claiming Docker is not set up. Docker is
  provided via podman on the host and exposed inside toolbox through
  `DOCKER_HOST`. The only valid reason to not run a command is an explicit
  failure you cannot resolve.
- **Do NOT install anything** (packages, tools, binaries, etc.) into existing
  Fedora toolboxes **without explicit user permission**. If a command needs a
  missing dependency, ask the user first before installing it. Creating a
  new toolbox for experiments is allowed, but remember to delete it afterwards.
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
     e.g. a short final summary (`tail -n 50 <file>` to see test
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
