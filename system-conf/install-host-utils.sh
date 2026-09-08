#!/usr/bin/env bash
#
# Install standalone CLI utilities into ~/.local/bin on a clean host.
#
# To add a new utility, append one line to the UTILS array:
#   ["<name>|<binary-name>"]="<archive-url>|<binary-path-inside-archive>|<version-cmd>"
# where:
#   name        package name (used for messages/tmp files)
#   binary-name name of the command to create in ~/.local/bin (usually same as name)
#   archive-url URL of the release archive, with two %s placeholders:
#               first — release tag (with leading 'v', e.g. v0.26.1),
#               second — version number without 'v' (0.26.1)
#   binary-path path to the binary inside the extracted archive
#               (matched with find -path, so use e.g. "ripgrep-*/rg")
#   version-cmd command that prints the latest release tag (e.g. v0.26.1)
#
set -euo pipefail

INSTALL_DIR="${HOME}/.local/bin"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# GitHub release tag lookup via the releases.atom feed
# (the REST API is rate-limited to 60 req/h per IP and fails with 403).
# Returns the full tag including any leading 'v', e.g. "v0.26.1" or "15.2.0".
gh_tag() {
  curl -s "https://github.com/$1/releases.atom" \
    | grep -o 'tag/v\?[0-9][0-9.]*' | head -n1 | cut -d/ -f2
}

declare -A UTILS=(
  # ripgrep: https://github.com/BurntSushi/ripgrep (tag has no 'v' prefix)
  ["ripgrep|rg"]="https://github.com/BurntSushi/ripgrep/releases/download/%s/ripgrep-%s-x86_64-unknown-linux-musl.tar.gz|ripgrep-*/rg|gh_tag BurntSushi/ripgrep"  # bat: https://github.com/sharkdp/bat
  ["bat|bat"]="https://github.com/sharkdp/bat/releases/download/%s/bat-v%s-x86_64-unknown-linux-musl.tar.gz|bat-v*/bat|gh_tag sharkdp/bat"
  # fzf: https://github.com/junegunn/fzf
  ["fzf|fzf"]="https://github.com/junegunn/fzf/releases/download/%s/fzf-%s-linux_amd64.tar.gz|fzf|gh_tag junegunn/fzf"
  # micro editor: https://github.com/zyedidia/micro (redirects to micro-editor/micro)
  ["micro|micro"]="https://github.com/micro-editor/micro/releases/download/%s/micro-%s-linux64.tar.gz|micro-*/micro|gh_tag micro-editor/micro"
)
installed=0
for key in "${!UTILS[@]}"; do
  name="${key%%|*}"
  bin_name="${key##*|}"
  IFS='|' read -r url_tpl bin_path version_cmd <<<"${UTILS[$key]}"

  printf '==> %s: ' "$name"
  if command -v "${INSTALL_DIR}/${bin_name}" >/dev/null 2>&1; then
    echo "already installed, skipping"
    continue
  fi

  version="$(eval "$version_cmd")"
  ver_num="${version#v}"
  url="$(printf "$url_tpl" "$version" "$ver_num")"
  archive="$TMP_DIR/${name}.tar.gz"

  echo "downloading $url"
  curl -fsSL -o "$archive" "$url"

  extract_dir="$TMP_DIR/${name}"
  mkdir -p "$extract_dir"
  case "$archive" in
    *.tar.gz|*.tgz) tar -xzf "$archive" -C "$extract_dir" ;;
    *.tar.xz) tar -xJf "$archive" -C "$extract_dir" ;;
    *.zip) unzip -q "$archive" -d "$extract_dir" ;;
    *) echo "unknown archive type for $name, skipping"; continue ;;
  esac

  bin_file="$(find "$extract_dir" -path "*/$bin_path" -type f | head -n1)"
  if [[ -z "$bin_file" ]]; then
    echo "binary matching '$bin_path' not found, skipping"
    continue
  fi

  install -m755 "$bin_file" "$INSTALL_DIR/${bin_name}"
  echo "installed $name $version -> $INSTALL_DIR/${bin_name}"
  installed=$((installed + 1))
done

echo "Done. $installed utility(ies) installed into $INSTALL_DIR."
