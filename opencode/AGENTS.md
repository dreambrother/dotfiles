# Agent Communication Preferences

## Bilingual Mode (MANDATORY)

- **Thinking/Reasoning:** ONLY in English (internal monologue, analysis, planning)
- **Responses to user:** ONLY in Russian

## Docker Environment (MANDATORY)

- **Docker IS configured and available** for running tests/containers. Do NOT
  refuse to run tests claiming Docker is not set up.
- Setup: Docker is provided via **podman** on the host, and the `DOCKER_HOST`
  is exposed inside **toolbox**. If the `docker` command is missing in the
  current shell, use `podman` directly (or run commands inside toolbox).

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
