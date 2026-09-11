/*
 * Reports, for every installed @fontsource-variable face, whether its digits
 * all share one advance width.
 *
 * A clock that ticks every second must not reflow. `font-variant-numeric:
 * tabular-nums` only does anything if the font actually ships tabular
 * figures -- when it does not, the browser silently ignores it and the time
 * shifts sideways as the digits change. That failure is invisible in code
 * review, so it is measured instead.
 *
 *   npx electron scripts/check-digit-widths.js
 *
 * Exits non-zero if any face jitters, so it can gate a release.
 */
const { app, BrowserWindow } = require('electron')
const { readdirSync, writeFileSync, rmSync } = require('node:fs')
const { join } = require('node:path')

app.disableHardwareAcceleration()

const ROOT = join(__dirname, '..')
const FONT_DIR = join(ROOT, 'node_modules', '@fontsource-variable')
const PAGE = join(ROOT, '.digit-width-probe.html')

/** One representative latin file per installed family. */
function installedFaces() {
  return readdirSync(FONT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      let files = []
      try {
        files = readdirSync(join(FONT_DIR, entry.name, 'files'))
      } catch {
        return []
      }
      const file =
        files.find((name) => /-latin-wght-normal\.woff2$/.test(name)) ??
        files.find((name) => /-latin-full-normal\.woff2$/.test(name)) ??
        files.find((name) => /-latin-[a-z]+-normal\.woff2$/.test(name))
      return file ? [{ family: entry.name, path: join(FONT_DIR, entry.name, 'files', file) }] : []
    })
}

function buildPage(faces) {
  const rules = faces
    .map(
      (face, index) =>
        `@font-face{font-family:F${index};src:url("file://${face.path}") format("woff2-variations")}`
    )
    .join('\n')

  return `<!doctype html><meta charset="utf-8"><style>${rules}
span{position:absolute;font-size:100px;font-variant-numeric:tabular-nums;white-space:pre}
</style><div id="out">measuring</div><script>
const faces = ${JSON.stringify(faces.map((face) => face.family))};
(async () => {
  await document.fonts.ready;
  const probe = document.createElement('span');
  document.body.appendChild(probe);
  const rows = [];
  for (let i = 0; i < faces.length; i++) {
    await document.fonts.load('100px F' + i, '0123456789');
    probe.style.fontFamily = 'F' + i;
    const widths = [];
    for (const digit of '0123456789') {
      probe.textContent = digit;
      widths.push(probe.getBoundingClientRect().width);
    }
    const spread = Math.max(...widths) - Math.min(...widths);
    rows.push({ family: faces[i], spread: Number(spread.toFixed(2)) });
  }
  probe.remove();
  document.getElementById('out').textContent = JSON.stringify(rows);
})();
</script>`
}

app.whenReady().then(async () => {
  const faces = installedFaces()
  writeFileSync(PAGE, buildPage(faces), 'utf-8')

  const window = new BrowserWindow({ show: false, width: 800, height: 400 })
  try {
    await window.loadFile(PAGE)
    const raw = await window.webContents.executeJavaScript(
      `new Promise((resolve) => {
         const timer = setInterval(() => {
           const el = document.getElementById('out')
           if (el && el.textContent !== 'measuring') { clearInterval(timer); resolve(el.textContent) }
         }, 100)
         setTimeout(() => resolve('[]'), 15000)
       })`
    )

    const rows = JSON.parse(raw)
    let failed = 0
    console.log('')
    for (const { family, spread } of rows.sort((a, b) => a.spread - b.spread)) {
      // Sub-pixel differences are rounding, not reflow.
      const stable = spread < 0.01
      if (!stable) failed += 1
      console.log(
        `  ${stable ? 'ok  ' : 'JITTERS'}  ${family.padEnd(18)} digit spread ${spread.toFixed(2)}px @100px`
      )
    }
    console.log('')
    app.exit(failed > 0 ? 1 : 0)
  } finally {
    rmSync(PAGE, { force: true })
  }
})
