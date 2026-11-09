#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${TMPDIR:=$HOME/.hermes/cache/scratch}"
mkdir -p "$TMPDIR"
stage=$(mktemp -d "$TMPDIR/azkar-prefs-test.XXXXXX")
trap 'rm -rf "$stage"' EXIT
cp -r dist/. "$stage/"
cp metadata.json src/stylesheet.css "$stage/"
cp -r schemas assets "$stage/"
mkdir -p "$stage/src"
cp -r src/sounds "$stage/src/"
glib-compile-schemas "$stage/schemas"
export GI_TYPELIB_PATH="/usr/lib/gnome-shell/girepository-1.0${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH}"
export GSETTINGS_BACKEND=keyfile
export XDG_CONFIG_HOME="$stage/config"
timeout 30s gjs -m tests/preferences.gjs.js "$stage"
