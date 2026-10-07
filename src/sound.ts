let ctx: AudioContext | null = null

/** Browsers only allow audio after a tap; call this from a tap handler. */
export function unlockAudio() {
  ctx ??= new AudioContext()
  void ctx.resume()
}

/** Three short beeps (and a vibration where supported) to end the rest timer. */
export function restDoneAlert() {
  navigator.vibrate?.([200, 100, 200, 100, 200])
  if (!ctx) return // no tap yet in this page load, so audio is not allowed
  for (let i = 0; i < 3; i++) {
    const start = ctx.currentTime + i * 0.3
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.4, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.2)
  }
}
