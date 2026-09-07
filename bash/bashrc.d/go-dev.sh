[[ "$TOOLBOX_NAME" == "go-dev" ]] || return 0

export GOPATH="$HOME/.go"
PATH="$HOME/.go/bin:$PATH"
