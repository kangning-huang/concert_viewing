#!/bin/bash
set -euo pipefail
REPOS="/Users/kh3657/Documents/repos"
SRC="$REPOS/concert_viewing"
PAGES="$REPOS/concert_viewing_pages_only"
INCOMING="$REPOS/_incoming"
TAR="$INCOMING/xhs_inbox_150_2026-11-09.tar.gz"
SCAFFOLD_TAR="$INCOMING/concert_viewing_scaffold.tar.gz"

mkdir -p "$REPOS" "$INCOMING"

if [ -d "$SRC" ] && [ ! -d "$PAGES" ]; then
  # If current tree looks like Pages-only (no package.json), move aside
  if [ ! -f "$SRC/package.json" ]; then
    mv "$SRC" "$PAGES"
    echo "Moved Pages-only → concert_viewing_pages_only"
  fi
fi

if [ ! -d "$SRC" ]; then
  mkdir -p "$SRC"
fi

# Extract scaffold over empty/new source tree (does not delete pages_only)
if [ -f "$SCAFFOLD_TAR" ]; then
  tar -xzf "$SCAFFOLD_TAR" -C "$SRC" --strip-components=1
  echo "Extracted scaffold"
fi

cd "$SRC"

# Git: init source branch, remote to public repo (least destructive)
if [ ! -d .git ]; then
  git init
  git checkout -b source
  git remote add origin https://github.com/kangning-huang/concert_viewing.git || true
else
  git checkout -B source 2>/dev/null || git checkout source
fi

# Photos
mkdir -p assets/refs/xhs
if [ -f "$TAR" ]; then
  rm -rf /tmp/xhs_extract_cv
  mkdir -p /tmp/xhs_extract_cv
  tar -xzf "$TAR" -C /tmp/xhs_extract_cv
  rsync -a --delete /tmp/xhs_extract_cv/xhs_inbox/ nest_tmp_check 2>/dev/null || true
  rm -rf assets/refs/xhs
  mkdir -p assets/refs
  mv /tmp/xhs_extract_cv/xhs_inbox assets/refs/xhs
  rm -f docs/refs/GATE_WAITING.md
  echo "XHS photos installed"
  find assets/refs/xhs -type f \( -name '*.webp' -o -name '*.jpg' -o -name '*.png' \) | wc -l
elif [ -d assets/refs/xhs/nest ] && [ "$(find assets/refs/xhs -type f \( -name '*.webp' -o -name '*.jpg' -o -name '*.png' \) | wc -l)" -ge 100 ]; then
  echo "XHS photos already present"
  rm -f docs/refs/GATE_WAITING.md
else
  echo "GATE_WAITING — no photo tar"
fi

npm install
npm run build
echo "BUILD_OK"
