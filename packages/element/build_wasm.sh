#!/usr/bin/env bash
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
OUT_DIR="${SCRIPT_DIR}/src/wasm"

mkdir -p "${OUT_DIR}"

if command -v emcc &> /dev/null; then
    echo "Compiling C++ engine in packages/element using Emscripten..."
    emcc "${SCRIPT_DIR}/cpp/element_engine.cpp" \
        -O3 \
        -s WASM=1 \
        -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall"]' \
        -s ALLOW_MEMORY_GROWTH=1 \
        -s ENVIRONMENT="web,worker" \
        -s MODULARIZE=1 \
        -s EXPORT_ES6=1 \
        -s EXPORT_NAME="PORenderModule" \
        -o "${OUT_DIR}/po_render.js"
    echo "WASM compilation successful."
else
    echo "Emscripten (emcc) not found in PATH; skipping C++ to WASM compilation."
fi
