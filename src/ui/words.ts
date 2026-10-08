// 화면 글을 짓는 작은 도구들.

import { statLabels } from '../content/labels';
import { missionProgress } from '../engine/game';
import type { GameState, Mission, Stat } from '../engine/types';

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

const COUNT_WORDS = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];

/** 수를 우리말로 센다(하나~열). 그 밖의 수는 "12가지"처럼 숫자로 적는다. */
export function countWord(n: number): string {
  return Number.isInteger(n) && n >= 1 && n <= 10 ? COUNT_WORDS[n] : `${n}가지`;
}

/**
 * 아직 풀리지 않은 미션을 어디까지 했는지 한 줄로: "셋 가운데 하나를 했어요. 나머지는 다른 계절에 해요."
 * 한 것이 없거나, 셀 수 없는 미션이거나, 이미 다 한 미션이면 null이다("해낸 일"은 풀린 미션에만 쓴다).
 * moreSeasons: 이 해에 계절이 더 남았는가(한 해 내내 푸는 미션의 꼬리말을 붙일지 가른다).
 */
export function progressLine(mission: Mission, state: GameState, moreSeasons: boolean): string | null {
  if (state.solved.includes(mission.id)) return null;
  const progress = missionProgress(mission, state);
  if (!progress || progress.have <= 0 || progress.have >= progress.need) return null;
  const tail = mission.season === 'year' && moreSeasons ? ' 나머지는 다른 계절에 해요.' : '';
  return `${countWord(progress.need)} 가운데 ${josa(countWord(progress.have), '을', '를')} 했어요.${tail}`;
}
