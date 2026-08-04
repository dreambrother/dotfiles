if [ -f "/run/.toolboxenv" ]
then
    TOOLBOX_NAME=$(cat /run/.containerenv | grep -oP "(?<=name=\")[^\";]+")
    HISTFILE="$HOME/.bash_history.d/$TOOLBOX_NAME"
    PROMPT_COMMAND='history -a; echo -ne "\033]0;$TOOLBOX_NAME\007"'
fi
