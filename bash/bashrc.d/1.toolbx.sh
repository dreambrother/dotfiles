[[ -f "/run/.toolboxenv" ]] || return 0

TOOLBOX_NAME=$(cat /run/.containerenv | grep -oP "(?<=name=\")[^\";]+")
HISTFILE="$HOME/.bash_history.d/$TOOLBOX_NAME"
PROMPT_COMMAND='history -a; echo -ne "\033]0;$TOOLBOX_NAME\007"'
export DOCKER_HOST=unix://${XDG_RUNTIME_DIR}/podman/podman.sock
