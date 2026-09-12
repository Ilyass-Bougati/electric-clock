/**
 * The alarm, synthesised rather than bundled.
 *
 * A file would have to be chosen, licensed and shipped, and would still need
 * an envelope to stop it sounding abrupt. Two sine tones with a soft decay
 * cost nothing, match the app's "nothing jarring" temperament, and can be
 * scheduled precisely.
 */

const NOTES = [880, 1174.66] // A5, D6
const GAP = 0.17
const REPEAT_EVERY = 1.75
/** Roughly a minute of ringing before it gives up on its own. */
const REPEATS = 34

let context: AudioContext | null = null
let voices: OscillatorNode[] = []

/**
 * Browsers only allow audio to start from a user gesture, so the context is
 * created when the countdown is started -- a click -- not when it fires.
 */
export function primeChime(): void {
  if (context) {
    if (context.state === 'suspended') void context.resume()
    return
  }
  try {
    context = new AudioContext()
  } catch (error) {
    console.warn('[chime] no audio available:', error)
  }
}

function ping(ctx: AudioContext, at: number, frequency: number): void {
  const oscillator = ctx.createOscillator()
  const envelope = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency

  // Attack just long enough to avoid a click, then a long exponential tail.
  envelope.gain.setValueAtTime(0.0001, at)
  envelope.gain.exponentialRampToValueAtTime(0.22, at + 0.015)
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + 1.1)

  oscillator.connect(envelope)
  envelope.connect(ctx.destination)
  oscillator.start(at)
  oscillator.stop(at + 1.2)

  voices.push(oscillator)
  oscillator.addEventListener('ended', () => {
    voices = voices.filter((voice) => voice !== oscillator)
  })
}

/**
 * Every repeat is scheduled up front against the audio clock. Driving this
 * from setInterval would be silenced by exactly the throttling the countdown
 * itself had to work around -- the window is rarely in front when a timer
 * goes off.
 */
export function startChime(): void {
  primeChime()
  if (!context) return

  stopChime()
  const start = context.currentTime + 0.05

  for (let repeat = 0; repeat < REPEATS; repeat += 1) {
    const at = start + repeat * REPEAT_EVERY
    NOTES.forEach((frequency, index) => ping(context as AudioContext, at + index * GAP, frequency))
  }
}

export function stopChime(): void {
  for (const voice of voices) {
    try {
      voice.stop()
    } catch {
      // Already stopped; nothing to do.
    }
  }
  voices = []
}
