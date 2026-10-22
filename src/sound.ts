let ctx: AudioContext | null = null

/** Safari's Audio Session API (iOS 17+); not in TypeScript's DOM types yet. */
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

/** Browsers only allow audio after a tap; call this from a tap handler. */
export function unlockAudio() {
  // Mix with other apps' audio (e.g. Spotify) instead of taking over the iOS audio session and pausing it.
  // Must be set before the AudioContext starts. Other browsers have no audioSession and already mix.
  const session = (navigator as AudioSessionNavigator).audioSession
  if (session) session.type = 'ambient'
  ctx ??= new AudioContext()
  void ctx.resume()
}

/** Longest wait for paused audio to restart before a beep is dropped rather than played late. */
const RESUME_TIMEOUT_MS = 1000

/**
 * Three short beeps at the given volume (0–1). Silent until a tap has unlocked audio in this page load.
 * iPhones pause a page's audio when you switch apps or lock the screen. Beeps scheduled on paused audio
 * would wait and sound on the next tap, so audio is restarted first, and the beep dropped if it can't be.
 */
function beep(volume: number) {
  const audio = ctx
  if (!audio || volume <= 0) return
  if (audio.state === 'running') return play(audio, volume)
  const asked = Date.now()
  void audio.resume().then(() => {
    if (Date.now() - asked <= RESUME_TIMEOUT_MS) play(audio, volume)
    else console.warn(`Rest beep dropped: audio was paused (${audio.state}) and only restarted on a later tap`)
  })
}

function play(audio: AudioContext, volume: number) {
  for (let i = 0; i < 3; i++) {
    const start = audio.currentTime + i * 0.3
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2)
    osc.connect(gain).connect(audio.destination)
    osc.start(start)
    osc.stop(start + 0.2)
  }
}

/** End of rest: beeps plus a vibration where supported. */
export function restDoneAlert(volume: number) {
  navigator.vibrate?.([200, 100, 200, 100, 200])
  beep(volume)
}

/** "Test beep" button in Settings (the tap itself unlocks audio). */
export function testBeep(volume: number) {
  unlockAudio()
  beep(volume)
}
