// 한 해 이름(끝맺음) 가운데 어느 상황에나 쓸 수 있는 것들.
// 상황은 이것들과 그 상황만의 이름을 섞어 차례를 정한다(위에서부터 처음 맞는 것이 뽑힌다).
// 어느 이름도 "잘했다·못했다"를 말하지 않는다. 수치가 바닥나도 한 해는 끝까지 간다(5절 6번).

import type { Ending } from '../engine/types';

export const commonEndings = {
  /** 살림이 바닥났을 때 */
  hard: {
    id: 'hard',
    title: '허리띠를 졸라맨 한 해',
    line: '곳간이 바닥을 보였지만 식구들은 한 해를 끝까지 살아 냈어요.',
    when: { max: { living: 1 } },
  },
  /** 기력이 바닥났을 때 */
  worn: {
    id: 'worn',
    title: '몸이 고단했던 한 해',
    line: '몸을 아끼지 않고 일한 한 해였어요. 이제는 좀 쉬어야 해요.',
    when: { max: { body: 1 } },
  },
  /** 인심을 많이 쌓았을 때 */
  neighbors: {
    id: 'neighbors',
    title: '이웃 덕에 넘긴 한 해',
    line: '힘든 일이 있을 때마다 이웃과 손을 맞잡고 넘긴 한 해였어요.',
    when: { min: { trust: 9 } },
  },
  /** 살림을 넉넉히 남겼을 때 */
  full: {
    id: 'full',
    title: '곳간이 든든한 한 해',
    line: '부지런히 일하고 아껴서 곳간에 곡식이 넉넉히 남았어요.',
    when: { min: { living: 6 } },
  },
  /** 그 밖의 모든 때. 목록의 마지막에 둔다. */
  steady: {
    id: 'steady',
    title: '묵묵히 일군 한 해',
    line: '큰일 작은 일을 하나씩 넘기며 제 몫을 해 나간 한 해였어요.',
  },
} satisfies Record<string, Ending>;
