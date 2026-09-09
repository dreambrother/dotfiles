# [[ "$TOOLBOX_NAME" == "java-dev" ]] || return 0

jdk-find() {
    find ~/.sdkman/ -maxdepth 3 -path "*java/*$1*"
}

export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"
