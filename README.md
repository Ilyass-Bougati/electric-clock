# Electric Clock

A desktop clock and weather dashboard. It shows two things: the current time
and today's weather. Nothing else.

Pick a city, pick a typeface and a background, leave it full screen on a spare
monitor.

## Install

Download from the [releases
page](https://github.com/Ilyass-Bougati/electric-clock/releases), or build it
yourself (see below).

**Linux**

- **AppImage** — make it executable and run it. Nothing to install.

  ```bash
  chmod +x electric-clock-1.0.0-x86_64.AppImage
  ./electric-clock-1.0.0-x86_64.AppImage
  ```

- **.deb** — installs a launcher entry and icon, removes cleanly.

  ```bash
  sudo apt install ./electric-clock_1.0.0_amd64.deb
  ```

**Windows**

- **`-setup-x64.exe`** — the usual installer wizard. Lets you choose where it
  goes, and adds Start menu and desktop shortcuts.
- **`-x64.msi`** — same app, for deploying with Group Policy or Intune.

The Windows builds are not code-signed, so SmartScreen will warn the first
time you run one. Click **More info**, then **Run anyway**. Signing needs a
paid certificate; there is no way around the warning without one.

## Using it

Everything lives behind the gear icon in the top strip.

- **Location** — search for a city. Results show the region and country, so
  there is no guessing which Springfield you meant.
- **Time zone** — follows your system by default. Override it with any IANA
  zone, or switch to your chosen city's time.
- **Background** — a plain wash, one of five animated shaders, or your own
  image. Shader colours follow the weather, or pick your own. A wallpaper gets
  a **Dim** slider, because a bright photo will otherwise swallow the date.
- **Typeface** — four monospaced faces for the clock.
- **Display** — 12/24-hour, °C/°F, light/dark/system, and a **Zoom**
  that scales the whole window between 75% and 150%.
- **Google Calendar** — **Connect** signs you in through your browser, then
  your Google events show up in the planning and under today's weather,
  beside your own entries. Pick which calendars to show. It is read-only:
  clicking a Google event opens it in Google Calendar to edit, and nothing
  you add in the clock is ever sent to Google. Events from four weeks back to
  sixteen weeks ahead are kept, refreshed every ten minutes.

The top strip switches between three modes:

- **Clock** — the time and today's weather.
- **Stopwatch** — Space starts and pauses, `R` resets.
- **Timer** — pick 1, 5, 10 or 25 minutes, or set any duration by typing:
  digits fill from the right, so `2`, `5`, `0`, `0` is 25 minutes and
  `1`, `3`, `0`, `0`, `0`, `0` is 1 hour 30. Backspace corrects, Enter or
  Space starts, `R` resets.

When a timer finishes it chimes for about a minute, the digits pulse, and the
taskbar entry flashes if the window is not in front. Any key stops it. Both
the stopwatch and the timer keep running if you switch back to the clock.

Full screen is the button in the top strip, or `F11`; `Escape` leaves it.
After a few seconds without mouse movement the window controls fade away, so
what you are left with is just the clock.

Every setting is remembered, including the window's size, position, and
whether you left it maximised or full screen. They survive upgrades. A running
stopwatch or timer is not kept across a restart — those are deliberately
in-the-moment.

## Building it yourself

You need [Node.js](https://nodejs.org). Then:

```bash
npm install
npm run dev      # run it with live reload while you poke at it
```

To produce the installable files:

```bash
npm run dist          # builds for the machine you are on
npm run dist:linux    # AppImage + .deb
npm run dist:win      # installer .exe + .msi
```

Whatever you are on builds natively. Making Windows installers *from* Linux
additionally needs wine, so it is easier to let CI do it — tagging a version
builds both platforms on their own runners and attaches everything to the
GitHub release. A macOS build genuinely needs a Mac.

### Google Calendar

A build only offers Google Calendar if it was made with an OAuth client ID;
without one the section is simply absent. To make your own:

1. In the [Google Cloud console](https://console.cloud.google.com), create a
   project and enable the **Google Calendar API**.
2. Under **OAuth consent screen**, choose *External*, fill in the app name
   and your address, and add the
   `https://www.googleapis.com/auth/calendar.readonly` scope. While the app
   is in *Testing*, add every Google account that will use it under
   **Test users**.
3. Under **Credentials**, create an **OAuth client ID** of type
   **Desktop app**.
4. Copy `.env.example` to `.env` and paste in the client ID and secret.

The secret of a desktop client is not actually secret — Google says as much,
since anything inside an installer can be read out — so it is fine to bake
in. For release builds, set the same two values as the `GOOGLE_CLIENT_ID`
and `GOOGLE_CLIENT_SECRET` repository secrets.

Until Google verifies the app, sign-in shows an "unverified app" warning
(click **Advanced**, then **Go to Electric Clock**), and only the listed test
users can connect, up to 100 of them.

To change the app icon, drop your artwork at `build/icon-source.png` and run:

```bash
npm run icon     # rounds the corners, writes build/icon.png and build/icon.ico
```

## Weather data

Weather and city search come from [Open-Meteo](https://open-meteo.com), which
is free and needs no API key or account. Readings refresh every 15 minutes. If
the network drops, the last reading stays on screen with a quiet
`Last updated HH:MM` next to it — click that to retry immediately.

If you connect Google Calendar, the clock talks to Google directly — there is
no server of ours in between — and asks only for read access. The sign-in is
kept in your OS keychain where there is one (on Linux without a keyring, in
a file only your user can read). **Disconnect** revokes it with Google and
deletes it.

Nothing else leaves your machine, and there is no account, telemetry or
tracking of any kind.
