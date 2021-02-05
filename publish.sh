#!/usr/bin/env bash
set -e
rm -rf dist
npx tsc -d
npm publish