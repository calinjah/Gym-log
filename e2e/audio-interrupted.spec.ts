import { addExercise, expect, openApp, test } from './helpers'
import type { Page } from '@playwright/test'

type AudioWindow = { beeps: string[]; interrupt: (tapToRestart: boolean) => Promise<void> }

/**
 * iPhones pause a page's audio when you switch apps or lock the screen; restarting it may wait for the
 * next tap. This stands in for that in Chromium and records the audio state whenever a beep starts.
 */
async function simulateIosAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as AudioWindow & { audio: AudioContext }
    w.beeps = []
    let tapToRestart = false
    let waiting: (() => void)[] = []
    document.addEventListener('pointerdown', () => (tapToRestart = false), true) // a tap after the pause
    const resume = AudioContext.prototype.resume
    AudioContext.prototype.resume = function () {
      if (tapToRestart) return new Promise<void>((done) => waiting.push(done))
      // A tap restarts audio, and any restart that was waiting completes with it.
      return resume.call(this).then(() => {
        waiting.forEach((done) => done())
        waiting = []
      })
    }
    const start = AudioScheduledSourceNode.prototype.start
    AudioScheduledSourceNode.prototype.start = function (when?: number) {
      w.beeps.push(this.context.state)
      return start.call(this, when)
    }
    const Original = AudioContext
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options)
        w.audio = this
      }
    }
    w.interrupt = async (tap: boolean) => {
      tapToRestart = tap
      await w.audio.suspend()
    }
  })
}

const beeps = (page: Page) => page.evaluate(() => (window as unknown as AudioWindow).beeps)

/** Tick set 1 (unlocking audio), pause audio during the 5 s rest, and let the rest run out. */
async function restWithAudioPaused(page: Page, tapToRestart: boolean) {
  await simulateIosAudio(page)
  await openApp(page)
  await page.getByRole('button', { name: 'Start empty workout' }).click()
  await addExercise(page, 'Push-up')
  await page.getByRole('button', { name: '+ Add set' }).click()
  await page.getByLabel('Push-up rest seconds').fill('5')
  await page.getByLabel('Set 1 done').click()
  await page.evaluate((tap) => (window as unknown as AudioWindow).interrupt(tap), tapToRestart) // e.g. switched to Spotify
  // Fast-forward to just before the end, then let it end in real time: a fake jump past the end would
  // also jump the clock the beep uses to tell whether audio restarted promptly.
  await page.clock.runFor(4_800)
  await expect(page.getByRole('timer')).toBeHidden()
}

test.describe('rest beep when the phone paused the audio', () => {
  test('if audio can restart, the beep plays when the rest ends', async ({ page }) => {
    await restWithAudioPaused(page, false)
    await expect.poll(() => beeps(page)).toEqual(['running', 'running', 'running'])
  })

  test('if audio only restarts on a tap, the beep is dropped, never played late on that tap', async ({ page }) => {
    await restWithAudioPaused(page, true)
    await page.clock.runFor(3_000) // back in the app a few seconds later
    await page.getByLabel('Set 2 done').click() // this tap restarts audio
    await page.waitForTimeout(300)
    expect(await beeps(page)).toEqual([])
  })
})
