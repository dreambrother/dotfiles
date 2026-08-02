# bash history
shopt -s histappend
export HISTSIZE=10000
export HISTFILESIZE=20000
export HISTCONTROL=ignoredups:ignorespace:erasedups
export HISTIGNORE="ls:ls *:cd *:pwd:exit:clear:opencode:git status"
export PROMPT_COMMAND="history -a; $PROMPT_COMMAND"

# export PS1="\[\e[0;36m\]\\w \\$ \[\e[0m\]"
export EDITOR="nano"
export PATH="$PATH:$HOME/.local/bin"

function dockerClean {
  docker ps -a | tail -n +2 | awk '{ print $1 }' | xargs docker rm -f
}
alias docker-clean='dockerClean && yes | docker system prune --volumes'

function dockerImagesClean {
  docker image ls -a |  tail -n +2 | awk '{ print $3 }' | xargs docker rmi -f
}
alias docker-images-clean='dockerImagesClean'

function gitClean {
  git checkout master; git branch | grep -v master | grep -v release | grep -v develop | grep -v main | xargs git branch -D
}
alias git-clean=gitClean

function gitCommit {
  task=$(git branch --show-current | grep -Eo "DEV-[0-9]+") && git commit -m "$task $1"
}
alias git-commit=gitCommit

function gitAddAndCommit {
  task=$(git branch --show-current | grep -Eo "DEV-[0-9]+") && git add . && git commit -m "$task $1"
}
alias git-add-and-commit=gitAddAndCommit

alias ls="ls -lhG"

function proxyActivate {
  export HTTP_PROXY=http://127.0.0.1:10809
  export HTTPS_PROXY=http://127.0.0.1:10809
  export NO_PROXY=localhost,127.0.0.1
}
alias proxy-activate=proxyActivate

if [ -d "$HOME/.bashrc.d" ]; then
  for file in $HOME/.bashrc.d/*.bashrc; do source "$file"; done;
fi
