import type { Level, Stone } from '../engine/types';

const t = (id: string, stones: Stone[], solution: number[], hidden = false): Level => ({
  id,
  band: 'T',
  w: 4,
  h: 4,
  stones,
  start: hidden ? null : 0,
  solution,
  nodes: 0,
  decisions: 0,
});

/** Tutorial levels (design §6). All single-solution; verified by tests. Guide text lives in i18n (tut.T1…). */
export const TUTORIAL: Level[] = [
  t('T1', [[0, 1, 'P'], [1, 1, 'P'], [3, 1, 'P']], [0, 1, 2]),
  t('T2', [[0, 0, 'P'], [1, 0, 'P'], [3, 0, 'P'], [3, 3, 'P']], [0, 1, 2, 3]),
  t('T3', [[0, 0, 'P'], [1, 0, 'P'], [3, 0, 'P'], [3, 3, 'P'], [2, 3, 'P']], [0, 1, 2, 3, 4]),
  t('T4', [[2, 3, 'P'], [3, 3, 'P'], [1, 3, 'P'], [3, 0, 'P'], [1, 1, 'P'], [3, 1, 'P']], [0, 2, 1, 3, 5, 4]),
  t('T5', [[0, 0, 'P'], [1, 0, 'H'], [1, 1, 'P'], [3, 1, 'P'], [0, 1, 'P'], [0, 2, 'P']], [0, 1, 2, 3, 4, 5]),
  t('T6', [[0, 0, 'P'], [1, 0, 'P'], [3, 0, 'R'], [3, 1, 'P'], [0, 1, 'P'], [0, 3, 'P']], [0, 1, 2, 3, 4, 5]),
  t('T7', [[2, 3, 'P'], [2, 2, 'P'], [0, 2, 'P'], [3, 2, 'P'], [3, 1, 'P']], [0, 1, 2, 3, 4], true),
];

export const FIRST_RUN_TUTORIAL = ['T1', 'T2', 'T3', 'T4'];

export const tutorialLevel = (id: string) => TUTORIAL.find((l) => l.id === id)!;
