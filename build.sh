#!/bin/sh

set -ex
cd ./wasm_rust
cargo build --target wasm32-unknown-unknown --release
mkdir -p ./pkg
rm -rf ./pkg/*
wasm-bindgen \
	target/wasm32-unknown-unknown/release/wasmusicorelectron.wasm \
	--out-dir ./pkg/ \
	--target web

cd ../
# 全部都在./wascore/pkg
# wasm-pack build ./wascore --target nodejs --dev
# wasm-pack build ./wascore --target bundler --dev
wasm-pack build ./wascore --target web --dev
# wasm-pack build ./wascore --target web --release
