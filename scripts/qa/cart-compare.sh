#!/bin/sh
# Side-by-side QA composites: reference photo | generated body render | code body render, into assets/qa/motion/cart/compare/.
# The composites contain the reference photos: never commit them (only the pure renders beside them are committed).
# Usage: sh scripts/qa/cart-compare.sh <refs/cart dir>
set -e
D=$(dirname "$0")/../../assets/qa/motion/cart; mkdir -p "$D/compare"
for n in 1 3 4; do
  ffmpeg -v error -y -i "$1/genesis-$n.jpg" -i "$D/gen-genesis-$n.jpg" -i "$D/code-genesis-$n.jpg" \
    -filter_complex "[0]scale=-2:400[a];[1]scale=-2:400[b];[2]scale=-2:400[c];[a][b][c]hstack=3" "$D/compare/genesis-$n-vs-renders.jpg"
done
