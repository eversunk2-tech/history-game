// 화면 글을 짓는 작은 도구들.

import { statLabels } from '../content/labels';
import type { Stat } from '../engine/types';

/** 받침이 있으면 withBatchim, 없으면 without을 붙인다. 예: josa('살림', '이', '가') → '살림이' */
export function josa(word: string, withBatchim: string, without: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return word + withBatchim;
  return word + ((last - 0xac00) % 28 === 0 ? without : withBatchim);
}

/** '로/으로'를 붙인다. 받침이 없거나 ㄹ받침이면 '로'. 예: ro('농민 집 아이') → '농민 집 아이로' */
export function ro(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return word + '로';
  const jong = (last - 0xac00) % 28;
  return word + (jong === 0 || jong === 8 ? '로' : '으로');
}

export interface ChangeWords {
  stat: Stat;
  /** ▲ 늘었다, ▼ 줄었다, ■ 그대로 */
  arrow: '▲' | '▼' | '■';
  text: string;
  from: number;
  to: number;
}

/**
 * 수치 변화를 화살표와 글로 함께 말한다(색만으로 알리지 않는다).
 * requested = 자료에 적힌 변화, delta = 실제로 바뀐 만큼(0~10을 넘지 못한다).
 */
export function changeWords(stat: Stat, requested: number, delta: number, from: number, to: number): ChangeWords | null {
  const name = statLabels[stat].label;
  if (delta > 0) return { stat, arrow: '▲', text: `${josa(name, '이', '가')} ${delta} 늘었어요`, from, to };
  if (delta < 0) return { stat, arrow: '▼', text: `${josa(name, '이', '가')} ${-delta} 줄었어요`, from, to };
  if (requested < 0) return { stat, arrow: '■', text: `${josa(name, '은', '는')} 더 줄 것이 없어요`, from, to };
  if (requested > 0) return { stat, arrow: '■', text: `${josa(name, '은', '는')} 이미 가득해요`, from, to };
  return null;
}
