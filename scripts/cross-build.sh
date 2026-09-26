#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PWD/.local/toolchain/bin:$PWD/.local/toolchain/usr/lib/llvm-18/bin:$PWD/.local/toolchain/usr/bin:$HOME/.cargo/bin:$PATH"
export LD_LIBRARY_PATH="$PWD/.local/toolchain/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export NSISDIR="$PWD/.local/toolchain/usr/share/nsis"
export XWIN_CACHE_DIR="$PWD/.local/xwin"
export CARGO_BUILD_JOBS=4
npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
