#!/usr/bin/env bash
#
# Rounds a square source image into build/icon.png for packaging.
#
# Nothing on Linux masks an app icon for you -- GNOME and KDE draw exactly the
# pixels you ship -- so the corner radius has to be baked into the file.
#
#   npm run icon                  # uses build/icon-source.png
#   npm run icon -- artwork.png   # or any path
#
# Requires ImageMagick (`convert`).
set -euo pipefail

SOURCE="${1:-build/icon-source.png}"
OUTPUT="${2:-build/icon.png}"
SIZE=512
# 22% of the edge: the proportion Apple's squircle and most Linux themes land
# on. Large enough to read as rounded at 32px, not so large it looks like a pill.
RADIUS=114

if ! command -v convert >/dev/null 2>&1; then
  echo "error: ImageMagick not found (need 'convert')." >&2
  echo "  Debian/Ubuntu: sudo apt install imagemagick" >&2
  exit 1
fi

if [ ! -f "$SOURCE" ]; then
  echo "error: no source image at '$SOURCE'." >&2
  echo "  Put your artwork there, or pass a path: npm run icon -- artwork.png" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Cover-fit to a square, cropping the overflow rather than distorting.
# -colorspace sRGB is not cosmetic: a near-monochrome icon gets detected as
# grayscale, and ImageMagick then writes a PNG with no alpha channel at all --
# the rounded corners come out opaque black instead of transparent.
convert "$SOURCE" -colorspace sRGB -alpha set -background none \
  -resize "${SIZE}x${SIZE}^" -gravity center -extent "${SIZE}x${SIZE}" \
  "$WORK/scaled.png"

# A transparent canvas with an opaque rounded rect: used as alpha, not as a
# colour layer, so any transparency already in the artwork is preserved.
convert -size "${SIZE}x${SIZE}" xc:none \
  -fill white -draw "roundrectangle 0,0 $((SIZE - 1)),$((SIZE - 1)) ${RADIUS},${RADIUS}" \
  "$WORK/mask.png"

# png:color-type=6 pins the output to RGBA so the alpha survives the encoder.
convert "$WORK/scaled.png" "$WORK/mask.png" -compose DstIn -composite \
  -colorspace sRGB -alpha on -define png:color-type=6 -depth 8 "$OUTPUT"

if [ "$(identify -format '%[channels]' "$OUTPUT")" != "srgba" ]; then
  echo "error: '$OUTPUT' has no alpha channel; the corners would render opaque." >&2
  exit 1
fi

# Windows wants a real multi-size .ico. Generating it here, next to the PNG,
# means the two can never drift and electron-builder is not left to guess.
# -type TrueColorAlpha for the same reason as above: without it a
# near-monochrome source collapses to grayscale and the transparent corners
# come back opaque.
ICO="${OUTPUT%.png}.ico"
convert "$OUTPUT" -colorspace sRGB -alpha on -type TrueColorAlpha -filter point \
  -define png:color-type=6 \
  -define icon:auto-resize=256,128,64,48,32,16 "$ICO"

for layer in $(identify -format '%[channels] ' "$ICO"); do
  if [ "$layer" != "srgba" ]; then
    echo "error: '$ICO' has a layer without alpha ($layer); corners would render opaque." >&2
    exit 1
  fi
done

echo "wrote $OUTPUT ($(identify -format '%wx%h' "$OUTPUT"), ${RADIUS}px radius)"
echo "wrote $ICO ($(identify -format '%wx%h ' "$ICO"))"
