// 엔진 시험에 쓰는 작은 가짜 상황. 실제 콘텐츠와 상관없이 규칙만 시험하려고 만든 것이다.
// 농민 집과 양반 집 아들만 장면이 있다(딸·노비는 비어 있다).

import { advance, choose, newGame, openChoiceIds } from '../src/engine/game';
import { mulberry32, pickOne, rollDraw } from '../src/engine/rng';
import {
  SEASONS,
  type Choice,
  type GameState,
  type RoleDef,
  type RoleId,
  type Scene,
  type Season,
  type Situation,
  type SituationPack,
} from '../src/engine/types';

function role(label: string, living: number, body: number, trust: number): RoleDef {
  return {
    label,
    intro: `${label}의 소개`,
    start: { living, body, trust },
    wish: `${label}의 바람`,
    wishOutcomes: [
      { when: { min: { living: 5 } }, fulfilled: true, reason: '살림이 넉넉했다' },
      { fulfilled: false, reason: '살림이 모자랐다' },
    ],
  };
}

export const testSituation: Situation = {
  id: 't0001',
  group: 'early',
  year: 1,
  title: '시험 상황',
  lessons: '0',
  calendar: 'lunar',
  draw: { kind: 'weather', season: 'summer' },
  statusLocks: true,
  roles: {
    son: role('아들', 7, 6, 6),
    daughter: role('딸', 7, 6, 6),
    farmer: role('농민', 4, 6, 5),
    nobi: role('노비', 2, 6, 4),
  },
  themes: {
    farming: '가',
    paying: '나',
    marriage: '다',
    inheritance: '라',
    learning: '마',
    duty: '바',
    play: '사',
  },
  epilogue: '뒷이야기',
  openQuestion: '끝 물음',
  endings: [
    { id: 'empty', title: '빈 한 해', line: '살림이 바닥났다', when: { max: { living: 0 } } },
    { id: 'rich', title: '넉넉한 한 해', line: '살림이 가득했다', when: { min: { living: 10 } } },
    { id: 'flagged', title: '표시한 한 해', line: '표시를 남겼다', when: { flags: ['f1'] } },
    { id: 'plain', title: '여느 한 해', line: '그저 그랬다' },
  ],
};

const drain: Choice = { id: 'drain', label: '다 깎는다', effects: { living: -3, body: -3, trust: -3 }, result: '깎였다' };
const gain: Choice = { id: 'gain', label: '다 늘린다', effects: { living: 3, body: 3, trust: 3 }, result: '늘었다' };
const rest: Choice = { id: 'rest', label: '그대로 둔다', result: '그대로다' };

function scene(season: Season, kind: 'world' | 'mine', who: RoleId | undefined, choices: Choice[], extra: Partial<Scene> = {}): Scene {
  return {
    id: `t-${season}-${kind === 'world' ? 'world' : who}`,
    situation: 't0001',
    season,
    kind,
    role: who,
    order: kind === 'world' ? 1 : 2,
    theme: 'farming',
    place: 'field',
    text: `${season} ${kind} 지문`,
    choices,
    note: '쪽지',
    facts: ['F00'],
    ...extra,
  };
}

const worldScenes: Scene[] = [
  // 봄 세상: 범위를 넘는 변화(+5)와 표시·카드 남기기
  scene('spring', 'world', undefined, [
    { id: 'over', label: '너무 큰 변화', effects: { living: 5 }, result: '+5라고 적었다' },
    { id: 'flag', label: '표시를 남긴다', setFlags: ['f1'], cards: ['c1'], result: '표시와 카드' },
    drain,
  ]),
  // 여름 세상: 신분으로 잠기는 선택지
  scene('summer', 'world', undefined, [
    {
      id: 'sonOnly',
      label: '글방에 간다',
      lock: { unless: { roles: ['son'] }, reason: '양반 집 아들만 글방에 다닐 수 있었어요' },
      result: '글방에 갔다',
    },
    drain,
    gain,
  ]),
  scene('autumn', 'world', undefined, [drain, gain, rest]),
  scene('winter', 'world', undefined, [drain, gain, rest]),
];

function mineScenes(who: RoleId): Scene[] {
  return [
    // 봄 내 장면: 수치·앞선 선택으로 잠기는 선택지
    scene('spring', 'mine', who, [
      rest,
      {
        id: 'needLiving',
        label: '살림이 있어야 하는 일',
        lock: { unless: { min: { living: 6 } }, reason: '살림이 6은 되어야 해요' },
        result: '살림으로 했다',
      },
      {
        id: 'needFlag',
        label: '앞에서 표시를 남겨야 하는 일',
        lock: { unless: { flags: ['f1'] }, reason: '봄에 표시를 남겨야 해요' },
        setFlags: ['f2'],
        result: '표시 덕에 했다',
      },
    ]),
    // 여름 내 장면: 뽑기와 앞선 선택에 따라 지문과 결과가 갈린다
    scene(
      'summer',
      'mine',
      who,
      [
        {
          id: 'crop',
          label: '농사를 짓는다',
          effects: { living: 1 },
          result: 'normal',
          variants: [
            { when: { flags: ['f1'], draw: 'drought' }, effects: { living: -2 }, result: 'f1+drought' },
            { when: { draw: 'drought' }, effects: { living: -1 }, result: 'drought' },
            { when: { draw: 'bumper' }, effects: { living: 2 }, result: 'bumper' },
          ],
        },
        drain,
        gain,
      ],
      {
        text: '여느 여름',
        textVariants: [
          { when: { draw: 'drought' }, text: '가문 여름' },
          { when: { draw: 'bumper' }, text: '넉넉한 여름' },
        ],
      },
    ),
    scene('autumn', 'mine', who, [drain, gain, rest]),
    scene('winter', 'mine', who, [drain, gain, rest]),
  ];
}

export const testPack: SituationPack = {
  situation: testSituation,
  scenes: [...worldScenes, ...mineScenes('farmer'), ...mineScenes('son')],
};

/** 정해 둔 선택지 id 차례대로 끝까지 한다. 차례가 모자라면 마지막 것을 되풀이한다. */
export function playWith(pack: SituationPack, role: RoleId, seed: number, picks: string[]): GameState {
  let state = newGame(pack, role, seed);
  let turn = 0;
  while (state.phase !== 'done') {
    if (state.phase === 'scene') {
      state = choose(pack, state, picks[Math.min(turn, picks.length - 1)]);
      turn++;
    } else {
      state = advance(pack, state);
    }
  }
  return state;
}

/** 열려 있는 선택지 가운데 아무거나 골라 끝까지 한다(고르는 난수도 씨앗을 받는다). */
export function playRandom(pack: SituationPack, role: RoleId, seed: number, pickSeed = seed): GameState {
  const rng = mulberry32(pickSeed * 7919 + 13);
  let state = newGame(pack, role, seed);
  let steps = 0;
  while (state.phase !== 'done') {
    if (++steps > 200) throw new Error('판이 끝나지 않는다');
    if (state.phase === 'scene') state = choose(pack, state, pickOne(rng, openChoiceIds(pack, state)));
    else state = advance(pack, state);
  }
  return state;
}

/** 그 날씨가 뽑히는 씨앗을 하나 찾는다. */
export function seedFor(weather: string): number {
  for (let seed = 1; seed < 10000; seed++) {
    if (rollDraw('weather', seed) === weather) return seed;
  }
  throw new Error(`${weather}가 뽑히는 씨앗을 찾지 못했다`);
}

export { SEASONS };
