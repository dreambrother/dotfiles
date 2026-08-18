[[ "$TOOLBOX_NAME" == "java-dev" ]] || return 0

function jdkFind {
    find ~/.sdkman/ -maxdepth 3 -path "*java/*$1*"
}
alias jdk-find=jdkFind

#THIS MUST BE AT THE END OF THE FILE FOR SDKMAN TO WORK!!!
export SDKMAN_DIR="$HOME/.sdkman"
[[ -s "$HOME/.sdkman/bin/sdkman-init.sh" ]] && source "$HOME/.sdkman/bin/sdkman-init.sh"
