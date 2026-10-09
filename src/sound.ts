let ctx: AudioContext | null = null

/** Browsers only allow audio after a tap; call this from a tap handler. */
export function unlockAudio() {
  ctx ??= new AudioContext()
  void ctx.resume()
}

/** Three short beeps at the given volume (0–1). Silent until a tap has unlocked audio in this page load. */
function beep(volume: number) {
  if (!ctx || volume <= 0) return
  for (let i = 0; i < 3; i++) {
    const start = ctx.currentTime + i * 0.3
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2)
    osc.connect(gain).connect(ctx.destination)
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
