#!/usr/bin/env bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
OUT_DIR="${SCRIPT_DIR}/src/wasm"

mkdir -p "${OUT_DIR}"

if command -v emcc &> /dev/null; then
    echo "Compiling C++ engine in packages/common using Emscripten..."
    emcc "${SCRIPT_DIR}/cpp/common_engine.cpp" \
        -O3 \
        -s WASM=1 \
        -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall"]' \
        -s ALLOW_MEMORY_GROWTH=1 \
        -s ENVIRONMENT="web,worker" \
        -o "${OUT_DIR}/common_engine.js"
    echo "WASM compilation successful."
else
    echo "Emscripten (emcc) not found in PATH; using pre-configured JS engine wrapper."
fi
