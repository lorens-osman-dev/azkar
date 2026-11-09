#!/usr/bin/env bash
set -euo pipefail

readonly DOWNLOAD_URL='https://raw.githubusercontent.com/lorens-osman-dev/azkar/main/azkar%40lorens.com.zip'
readonly ARCHIVE_NAME='azkar@lorens.com.zip'

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
    readonly GREEN=$'\033[32m'
    readonly YELLOW=$'\033[33m'
    readonly RED=$'\033[31m'
    readonly BLUE=$'\033[97;44m'
    readonly RESET=$'\033[0m'
else
    readonly GREEN=''
    readonly YELLOW=''
    readonly RED=''
    readonly BLUE=''
    readonly RESET=''
fi

info() {
    printf '%s%s%s\n' "$GREEN" "$1" "$RESET"
}
success() {
    printf '%s%s%s\n' "$BLUE" "$1" "$RESET"
}

warn() {
    printf '%s%s%s\n' "$YELLOW" "$1" "$RESET"
}

error() {
    printf '%s%s%s\n' "$RED" "$1" "$RESET" >&2
}

for command in curl gnome-extensions; do
    if ! command -v "$command" >/dev/null 2>&1; then
        error "Required command not found: $command"
        exit 1
    fi
done

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

info 'Downloading Azkar extension...'
curl -fL "$DOWNLOAD_URL" -o "$tmpdir/$ARCHIVE_NAME"

info 'Installing Azkar extension...'
gnome-extensions install --force "$tmpdir/$ARCHIVE_NAME"
printf '\n' 
success 'AZKAR installed successfully ✓✓'
warn $'\nLog out and back in before enabling the extension.'
