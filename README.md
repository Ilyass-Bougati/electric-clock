# Electric Clock

A desktop clock and weather dashboard. It shows two things: the current time
and today's weather. Nothing else.

Pick a city, pick a typeface and a background, leave it full screen on a spare
monitor.

## Install

Download from the [releases
page](https://github.com/Ilyass-Bougati/electric-clock/releases), or build it
yourself (see below).

- **AppImage** — make it executable and run it. Nothing to install.

  ```bash
  chmod +x electric-clock-1.0.0-x86_64.AppImage
  ./electric-clock-1.0.0-x86_64.AppImage
  ```

- **.deb** — installs a launcher entry and icon, removes cleanly.

  ```bash
  sudo apt install ./electric-clock_1.0.0_amd64.deb
  ```

## Using it

Everything lives behind the gear icon in the top strip.

- **Location** — search for a city. Results show the region and country, so
  there is no guessing which Springfield you meant.
- **Time zone** — follows your system by default. Override it with any IANA
  zone, or switch to your chosen city's time.
- **Background** — a plain wash, or one of five animated shaders. Colours
  follow the weather, or pick your own.
- **Typeface** — four monospaced faces for the clock.
- **Display** — 12/24-hour, °C/°F, light/dark/system.

Full screen is the button in the top strip, or `F11`; `Escape` leaves it.
After a few seconds without mouse movement the window controls fade away, so
what you are left with is just the clock.

Your settings are remembered, including the window's size and position, and
survive upgrades.

## Building it yourself

You need [Node.js](https://nodejs.org). Then:

```bash
npm install
npm run dev      # run it with live reload while you poke at it
```

To produce the installable files:

```bash
npm run dist     # writes an AppImage and a .deb into release/
```

Linux builds work out of the box. A Windows installer needs wine, and a macOS
build genuinely needs a Mac.

To change the app icon, drop your artwork at `build/icon-source.png` and run:

```bash
npm run icon     # rounds the corners and writes build/icon.png
```

## Weather data

Weather and city search come from [Open-Meteo](https://open-meteo.com), which
is free and needs no API key or account. Readings refresh every 15 minutes. If
the network drops, the last reading stays on screen with a quiet
`Last updated HH:MM` next to it — click that to retry immediately.

Nothing else leaves your machine, and there is no account, telemetry or
tracking of any kind.
