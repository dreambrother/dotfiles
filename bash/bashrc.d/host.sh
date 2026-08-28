[[ -f "/run/.toolboxenv" ]] && return 0

toolbox_cmds=(bat rg htop)
for cmd in "${toolbox_cmds[@]}"; do
    command -v "$cmd" >/dev/null 2>&1 || alias "$cmd"="toolbox run -c sys-utils -- $cmd"
done
