[[ -f "/run/.toolboxenv" ]] || return 0

TOOLBOX_NAME=$(cat /run/.containerenv | grep -oP "(?<=name=\")[^\";]+")
HISTFILE="$HOME/.bash_history.d/$TOOLBOX_NAME"
PROMPT_COMMAND='history -a; echo -ne "\033]0;$TOOLBOX_NAME\007"'

alias edit="flatpak-spawn --host flatpak run org.gnome.TextEditor"
