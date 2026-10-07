// 그림의 빛깔. 한지 빛 바탕, 먹선, 계절마다 한 가지 색(spec 9절).

import type { Season } from '../engine/types';

export const PAPER = '#f4ecd9';
export const INK = '#2e2925';

export interface Tone {
  sky: string;
  far: string;
  ground: string;
  accent: string;
}

export const SEASON_TONES: Record<Season, Tone> = {
  spring: { sky: '#f2f1dc', far: '#dfe6c0', ground: '#cbdca6', accent: '#7fa650' },
  summer: { sky: '#e6f0e4', far: '#bfdcc4', ground: '#9fcfae', accent: '#2f8a76' },
  autumn: { sky: '#f7ead0', far: '#ecd49c', ground: '#e2bf78', accent: '#c07f24' },
  winter: { sky: '#edeff0', far: '#dde3e8', ground: '#cfd8df', accent: '#64809c' },
};
