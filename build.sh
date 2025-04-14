#!/bin/sh

set -ex
cd ./wasm_rust
cargo build --target wasm32-unknown-unknown --release
mkdir -p ../wasm_generated
rm -rf ../wasm_generated/*
wasm-bindgen \
	target/wasm32-unknown-unknown/release/wasmusicorelectron.wasm \
	--out-dir ../wasm_generated \
	--target web

