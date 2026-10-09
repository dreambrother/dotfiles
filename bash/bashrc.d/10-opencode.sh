opencode() {
    command opencode "$@"
    stty -echo -icanon min 0 time 0 2>/dev/null                                       # swallow leftovers without echo
    printf '\e[?1000l\e[?1002l\e[?1003l\e[?1004l\e[?1005l\e[?1006l\e[?1015l\e[?2004l' # disable mouse/focus/paste modes
    tput reset 2>/dev/null                                                            # full terminal reset
    sleep 0.05                                                                        # let terminal apply the reset
    while read -rs -t 0.02 -N 512 oc_trash; do :; done                                # drop late mouse reports
    stty sane 2>/dev/null                                                             # restore terminal settings
}

if [ -d "$HOME/dotfiles/opencode/profiles" ]; then
    for profile in "$HOME/dotfiles/opencode/profiles"/*/; do
        [ -d "$profile" ] || continue
        profile="${profile%/}"
        profile="${profile##*/}"
        eval "oc-${profile}() { OPENCODE_CONFIG_DIR=\"\$HOME/dotfiles/opencode/profiles/${profile}\" opencode \"\$@\"; }"
    done
    unset profile
fi
