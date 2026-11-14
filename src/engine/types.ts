export type Kind = 'P' | 'R' | 'H';
export type Stone = [x: number, y: number, kind: Kind];
export type Len = 1 | 2 | 3;
export type Dir = 1 | -1;

export type BandId =
  | 'K1' | 'K2' | 'K3' | 'K4'
  | 'O1' | 'O2' | 'O3' | 'O4'
  | 'Z1' | 'Z2' | 'Z3' | 'Z4';

export type LevelBand = BandId | 'T';

export interface Level {
  id: string;
  band: LevelBand;
  w: number;
  h: number;
  stones: Stone[];
  start: number | null;
  solution: number[];
  nodes: number;
  decisions: number;
}

export interface Rhythm {
  len: Len;
  dir: Dir;
}

/** Generator parameters for one difficulty band. */
export interface BandConfig {
  w: number;
  h: number;
  n: number;
  nR: number;
  nH: number;
  hidden: boolean;
  minDecisions: number;
  minNodes: number;
  maxNodes: number;
}
