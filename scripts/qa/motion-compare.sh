#!/bin/sh
# Comparison strip for motion fidelity: each reference frame above the matching render, side by side across the phases.
# Usage: scripts/qa/motion-compare.sh <video> <ffmpeg filter for the reference, e.g. crop=600:600:240:60[,hflip]> <out.jpg> <frame>=<render.jpg> ...
# The strip contains reference frames, so it is for the critic only: never commit it (.gitignore keeps compare* out; commit the renders).
set -e
video=$1; filt=$2; out=$3; shift 3
tmp=$(mktemp -d); i=0; inputs=""
for pair in "$@"; do
  f=${pair%%=*}; r=${pair#*=}
  ffmpeg -v error -y -i "$video" -vf "select=eq(n\,$f),$filt,scale=320:320" -frames:v 1 "$tmp/ref$i.png"
  ffmpeg -v error -y -i "$tmp/ref$i.png" -i "$r" -filter_complex "[1:v]scale=320:320[b];[0:v][b]vstack" "$tmp/pair$i.png"
  inputs="$inputs -i $tmp/pair$i.png"; i=$((i + 1))
done
ffmpeg -v error -y $inputs -filter_complex "hstack=inputs=$i" -q:v 3 "$out"
rm -rf "$tmp"
