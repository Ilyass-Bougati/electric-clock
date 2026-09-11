# Electric Clock

A desktop clock and weather dashboard. It shows two things: the current time
and today's weather. Nothing else.

## Running it

```bash
npm install
npm run dev      # electron-vite dev server with HMR
```

```bash
npm run build    # typecheck both projects, then bundle to out/
npm start        # run the bundled app
```

`out/` is bundled JavaScript, not a distributable -- it still needs the
Electron runtime from `node_modules`. For something you can hand to someone:

```bash
npm run dist     # AppImage + .deb into release/
npm run dist:dir # unpacked directory only, for a quick check
```

The AppImage is a single executable: `chmod +x` and run it, no install. The
`.deb` installs to `/opt`, registers a launcher entry and an icon, and removes
cleanly. Linux targets build natively; a Windows installer would need wine and
a macOS `.dmg` genuinely needs a Mac.

The app icon is `build/icon.png` (512x512, RGBA). Nothing on Linux masks an
app icon for you -- GNOME and KDE draw exactly the pixels you ship -- so the
corner radius has to be baked into the file:

```bash
npm run icon                  # rounds build/icon-source.png -> build/icon.png
npm run icon -- artwork.png   # or any path
```

`scripts/round-icon.sh` cover-fits to 512x512 and applies a 22% radius. Keep
the unrounded artwork at `build/icon-source.png` so it can be re-run. It needs
ImageMagick, and it forces sRGB + `png:color-type=6` on the way out: a
near-monochrome icon gets detected as grayscale otherwise, and ImageMagick
then writes a PNG with no alpha at all -- the rounded corners come out opaque
black rather than transparent.

Two details worth knowing:

- **The config path is pinned.** A packaged build carries electron-builder's
  `productName` ("Electric Clock"), and Electron prefers that over `name` when
  deriving `userData` -- so an installed app would read a *different* config
  file from the one `npm run dev` writes, and settings would appear to vanish
  on install. `src/main/index.ts` calls `app.setPath('userData', ...)` at
  module scope to make both agree on `electric-clock`.
- **The `desktopName` warning during a build is benign.** Window association
  works because `linux.desktop.entry.StartupWMClass` is set to
  `electric-clock`, which is the WM_CLASS Electron actually reports (verified
  with `xwininfo`). Taking electron-builder's suggested fix would change the
  app_id to something that no longer matches.

## Stack

electron-vite, React, TypeScript, Tailwind CSS v4. Weather and city search come
from [Open-Meteo](https://open-meteo.com), which needs no API key.

## How it is put together

```
src/
  shared/types.ts         every value that crosses the process boundary
  shared/weather-codes.ts WMO 0-99 -> label + icon key
  main/                   window, config file, network, polling
  preload/                the contextBridge surface exposed as window.api
  renderer/               React UI
```

**All network calls happen in the main process.** The renderer has no fetch of
its own -- `contextIsolation` is on, `nodeIntegration` is off, and the preload
exposes a typed `window.api` whose shape lives in `src/shared/types.ts`, the one
file both sides import.

**Two TypeScript projects.** `tsconfig.node.json` covers main and preload
(CommonJS, node types); `tsconfig.web.json` covers the renderer (DOM lib, no
node types). Both include `src/shared`, so a change to the contract breaks
whichever side stopped matching.

**The clock re-renders only itself.** A single timer in
`renderer/src/lib/ticker.ts` drives a `useSyncExternalStore` subscription.
Because the store bails out on an unchanged snapshot, the time element repaints
every second while the date line -- which reformats just as often -- re-renders
once a day. Nothing above them in the tree re-renders at all.

**Weather is polled every 15 minutes** and the last successful reading is kept
in memory with its timestamp. A failed refresh never clears it: the strip keeps
showing the cached reading and grows a quiet `Last updated HH:MM` label, which
doubles as a retry button. Changing city is the one case that does drop the
snapshot, since a reading for the previous city would be a wrong answer under a
new heading.

The strip shows five readings and no more -- condition, temperature, what it
feels like, UV index, humidity -- and the request asks for exactly those five.

**Time is always formatted through `Intl.DateTimeFormat` with an explicit
`timeZone`.** No offset is ever added by hand. The zone is detected once per
launch and an explicit override in settings wins over it.

## Configuration

Settings live in a JSON file in Electron's `userData` directory
(`~/.config/electric-clock/config.json` on Linux): location, time-zone
override, theme, unit preferences and window bounds. It is written with a
write-then-rename so an interrupted save cannot truncate it, and every field is
validated on load -- a missing or corrupt file falls back to defaults rather
than crashing, and one bad field costs only that field.

The weather cache is deliberately **not** persisted; it lives in the main
process for the lifetime of the session.

## The look

**The clock is dead centre of the window**, always. A
`grid-rows-[1fr_auto_1fr]` puts it there and keeps it there, so the weather
strip below can change height without nudging it.

**Nothing is layered on a surface of its own.** The weather strip and the
settings panel have no background colour at all -- they lift off the page by
blurring and brightening what is behind them. That needs a backdrop worth
blurring, which is what the background layer is for.

**Backgrounds** are selectable in settings: `ambient` is a pair of CSS washes
and costs nothing, and five live WebGL shaders (mesh, warp, grain, swirl,
dither) come from `@paper-design/shaders-react`. Each preview tile in the
picker is the real shader running the real palette, held still.

**Palettes** are picked separately from the background: `Weather` (accents
follow the conditions -- the default), `Ember`, `Tide`, or `Custom` with two
colour wells. The *ground* colour is deliberately not adjustable; it stays the
theme's, which is what keeps a 16rem clock readable over whatever is chosen.

The whole mechanism is two CSS variables. A non-weather palette is installed
by writing `--tone-a` / `--tone-b` onto the document element, and the CSS
washes, every shader and every preview tile already read those -- so a palette
change reaches all of them without any of them knowing palettes exist.

Colours are then flattened for the shaders, which need solid values:
`lib/shader-palette.ts` composites `--bg` with the two tones on a 1x1 canvas,
using the browser's own parser and blending, so any colour syntax works and
there is only ever one palette. Because a shader fills the window where a wash
was a soft radial falloff, the tone goes on below full strength: enough to read
as "warm today" or "grey today", not enough to become a colour scheme of its
own. The picker tiles show those composited results rather than the raw preset
hex -- otherwise the fixed palettes would look vivid beside a washed-out
Weather tile and the four would not be comparable.

Shader cost is capped by `maxPixelCount` (these are low-frequency fields;
full resolution buys nothing), and the library already stops rendering on
`visibilitychange` and when the canvas scrolls out of view, so a minimised
window is free.

> One trap worth knowing about: hand-writing both `backdrop-filter` and
> `-webkit-backdrop-filter` makes Lightning CSS keep only the prefixed one,
> which Chromium ignores -- the glass silently does nothing. Write the
> unprefixed property alone and let it add the prefix.

**Typefaces.** Four bundled variable fonts -- Inter, Space Grotesk, Fraunces
and JetBrains Mono -- each with its own letter-spacing, because the tracking
that tightens a grotesque wrecks a serif. Fraunces additionally drives its
optical-size, SOFT and WONK axes at clock scale. The choice applies to the
dashboard; the settings panel stays in Inter, which is a UI font's job. Only
the selected face is ever downloaded.

**Icons are hand-built**, not a generic line-icon pack: a filled cloud, a sun
disc, a streak and a pellet, composed into the full WMO range and coloured per
element -- warm sun, blue rain, pale snow. Lucide is still used for window
chrome.

**Type scales with the smaller window dimension** (`min(15vw, 26vh)`), so full
screen on a wide monitor grows the clock instead of stranding it in an empty
16:9 field.

## Full screen

The title-bar button, or F11; Escape leaves it. After a few seconds without
mouse movement the whole top strip fades out, and the first movement brings it
back -- a clock left on a spare screen should be a clock, not a window.

## Theming

Light and dark only, following the OS through Electron's `nativeTheme`, with a
manual override in settings. Every colour is a CSS variable in
`renderer/src/styles.css` -- there are no hardcoded colours in components. The
main process passes the resolved theme on the command line at window creation,
so the first paint is already correct.
