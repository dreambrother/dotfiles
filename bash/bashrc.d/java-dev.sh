[[ "$TOOLBOX_NAME" == "java-dev" ]] || return 0

jdk-find() {
    find ~/.sdkman/ -maxdepth 3 -path "*java/*$1*"
}

#THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"
