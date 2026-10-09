import type { Equipment, Level, Pattern } from './types'

export const PATTERN_LABELS: Record<Pattern, string> = {
  warmup: 'Warm-up',
  skill: 'Skill',
  squat: 'Squat',
  lunge: 'Lunge / single leg',
  hinge: 'Hinge (hips)',
  hpush: 'Horizontal push',
  vpush: 'Vertical push / dip',
  hpull: 'Horizontal pull (row)',
  vpull: 'Vertical pull',
  core: 'Core',
}

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  bar: 'Pull-up bar',
  rings: 'Rings',
  dip: 'Dip bars',
  band: 'Bands',
  weights: 'Weights / kettlebell',
}

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}
