// 시험에 쓰는 작은 견본 이야기. 실제 콘텐츠와 상관없이 규칙만 시험하려고 만든 것이다(글은 모두 꾸민 것).
//
// 역할 셋: 농민 집 아이(두 모습, 해 셋) · 노비 집 아이(남자아이 모습만, 해 둘) · 양반 집 아들(미션이 없어 "준비 중").
// 봄과 여름이 만들어져 있고 날씨는 여름에 뽑는다. 쓰는 것: 잠김, 숨김(only), 결과 갈림, "또는"(anyOf), 물건(items),
// 모습(look), 일 놀이의 표시, 갈 자리(goTo), 도움의 일(rescue), 나중에 나타나는 결과(later), 뽑기.
// 이 견본은 콘텐츠 검사기를 잘못 없이 통과한다(검사기 시험이 한 군데씩 망가뜨려 본다).

import { groups } from '../src/content/groups';
import { themes } from '../src/content/themes';
import type { ContentBundle, MapRef } from '../src/content/validate';
import {
  canCloseSeason,
  closeSeason,
  doHappening,
  newGame,
  nextSeason,
  openChoiceIds,
  openHappenings,
  type DoInput,
} from '../src/engine/game';
import { mulberry32, pickOne, rollDraw, type Rng } from '../src/engine/rng';
import {
  SEASONS,
  type GameState,
  type Happening,
  type Line,
  type Look,
  type Mission,
  type RoleDef,
  type RoleId,
  type Situation,
  type SituationPack,
  type Stats,
} from '../src/engine/types';

const SID = 't0001';

function role(id: RoleId, label: string, start: [number, number, number], suns: number, looks: Look[]): RoleDef {
  return {
    id,
    label,
    intro: `나는 시험 마을에 사는 ${label}다.`,
    start: { living: start[0], body: start[1], trust: start[2] },
    wish: '식구 모두 겨울 나기',
    wishOutcomes: [
      { when: { min: { living: 5 } }, fulfilled: true, reason: '살림이 넉넉했어요.' },
      { fulfilled: false, reason: '살림이 모자랐어요.' },
    ],
    kind: 'status',
    age: 15,
    map: 'testmap',
    suns,
    looks,
  };
}

export const testSituation: Situation = {
  id: SID,
  group: 'early',
  year: 1,
  title: '시험 이야기',
  lessons: '0',
  calendar: 'lunar',
  roles: [
    role('farmer', '농민 집 아이', [4, 6, 5], 3, ['boy', 'girl']),
    role('nobi', '노비 집 아이', [2, 6, 4], 2, ['boy']),
    role('son', '양반 집 아들', [7, 6, 6], 3, ['boy']),
  ],
  pickBy: 'draw',
  draw: {
    kind: 'weather',
    season: 'summer',
    labels: {
      drought: { label: '큰비가 온 해', line: '여름 내내 비가 쏟아진다.' },
      normal: { label: '여느 해', line: '비와 볕이 알맞다.' },
      bumper: { label: '비가 알맞은 해', line: '비가 알맞게 온다.' },
    },
  },
  statusLocks: true,
  seasons: {
    spring: { line: '얼었던 땅이 풀린다.' },
    summer: { line: '볕이 뜨겁다.', lineVariants: [{ when: { draw: 'drought' }, line: '큰비가 그치지 않는다.' }] },
    autumn: { line: '들판이 익어 간다.' },
    winter: { line: '찬 바람이 분다.' },
  },
  later: [
    { at: 'spring', when: { flags: ['news.help'] }, effects: { trust: 1 }, line: '거들어 준 이웃이 고마워했다.' },
    { at: 'summer', when: { flags: ['sow.low'], draw: 'drought' }, effects: { living: -3 }, cards: ['c2'], line: '낮은 논이 큰비에 잠겼다.' },
    {
      at: 'summer',
      when: { flags: ['sow.low'], anyOf: [{ draw: 'normal' }, { draw: 'bumper' }] },
      effects: { living: 1 },
      line: '낮은 논의 벼가 잘 자랐다.',
    },
    { at: 'summer', when: { flags: ['sow.split'], draw: 'drought' }, effects: { living: -1 }, line: '높은 논의 벼는 남았다.' },
  ],
  legacy: [{ id: 'tree', label: '느티나무', kind: 'tree' }],
  people: {
    elder: { label: '이웃 어른', sex: 'm', age: 'adult' },
    monk: { label: '스님', sex: 'm', age: 'adult' },
    father: { label: '아버지', sex: 'm', age: 'adult' },
    mother: { label: '어머니', sex: 'f', age: 'adult' },
    granny: { label: '할머니', sex: 'f', age: 'old' },
    friend: { label: '동무', sex: 'f', age: 'child' },
  },
  themes: { farming: '가', paying: '나', marriage: '다', inheritance: '라', learning: '마', duty: '바', play: '사' },
  epilogue: '뒷이야기',
  openQuestion: '끝 물음',
  endings: [
    { id: 'empty', title: '빈 한 해', line: '살림이 바닥났다', when: { max: { living: 0 } } },
    { id: 'rich', title: '넉넉한 한 해', line: '살림이 가득했다', when: { min: { living: 10 } } },
    { id: 'helped', title: '이웃을 거든 한 해', line: '이웃을 거들었다', when: { flags: ['news.help'] } },
    { id: 'plain', title: '여느 한 해', line: '그저 그랬다' },
  ],
  proof: { themes: {}, epilogue: [] },
};

const me = (text: string): Line => ({ text });
const say = (who: string, text: string, pose?: Line['pose']): Line => (pose ? { who, pose, text } : { who, text });

function happening(id: string, extra: Omit<Happening, 'id' | 'situation' | 'note' | 'facts'> & Partial<Pick<Happening, 'note' | 'facts'>>): Happening {
  return { id, situation: SID, note: '시험에 쓰는 배움 쪽지예요.', facts: ['F00'], ...extra };
}

// ── 봄 ───────────────────────────────────────────────────────

const spring: Happening[] = [
  // 꼭 푸는 미션 「돌아온 사람들」: 듣고 고른 뒤, 고른 일을 그 자리에 가서 마친다
  happening('t-news', {
    season: 'spring',
    roles: ['farmer', 'nobi'],
    theme: 'duty',
    spot: 'tree',
    cost: 0,
    stage: { place: 'entrance', cast: [{ who: 'elder', at: 'left' }, { who: 'monk', at: 'right' }] },
    lines: [me('마을 어귀에 사람들이 모여 있다.'), say('elder', '공사에서 돌아왔단다.'), say('monk', '우리는 내일 떠난다.', 'worried')],
    lineVariants: [{ when: { look: 'girl' }, lines: [me('물동이를 이고 마을 어귀를 지난다.'), say('elder', '공사에서 돌아왔단다.')] }],
    choices: [
      { id: 'help', label: '이웃의 밀린 일을 거든다', setFlags: ['news.go.help'], goTo: 'neighbor', lines: [me('이웃집 논으로 가자.')] },
      { id: 'own', label: '우리 집 일부터 한다', only: ['farmer'], setFlags: ['news.go.own'], goTo: 'yard', lines: [me('우리 집 마당으로 가자.')] },
      {
        id: 'give',
        label: '스님께 길양식을 보탠다',
        lock: { unless: { min: { living: 3 } }, reason: '보탤 곡식이 남아 있지 않아요' },
        setFlags: ['news.go.give'],
        items: ['bundle'],
        goTo: 'templeRoad',
        lines: [me('곡식을 싸서 절 가는 길로 가자.')],
      },
      {
        id: 'errand',
        label: '주인댁 심부름으로 짐을 나른다',
        only: ['nobi'],
        setFlags: ['news.go.help'],
        goTo: 'neighbor',
        lines: [me('짐을 지고 이웃집 논으로 간다.')],
      },
    ],
  }),
  happening('t-help', {
    season: 'spring',
    roles: ['farmer', 'nobi'],
    theme: 'duty',
    spot: 'neighbor',
    shows: { flags: ['news.go.help'] },
    cost: 0,
    stage: { place: 'paddy', cast: [{ who: 'elder' }] },
    lines: [me('이웃집 논은 갈이가 한참 밀려 있다.')],
    after: { effects: { body: -1, trust: 1 }, setFlags: ['news.help'], lines: [say('elder', '고맙구나.', 'glad')] },
  }),
  happening('t-own', {
    season: 'spring',
    roles: ['farmer'],
    theme: 'duty',
    spot: 'yard',
    shows: { flags: ['news.go.own'] },
    cost: 0,
    stage: { place: 'yard', cast: [{ who: 'father' }] },
    lines: [say('father', '우리 일도 밀렸다.')],
    after: { effects: { living: 1, trust: -1 }, setFlags: ['news.own'], lines: [me('우리 집 봄 일을 먼저 마쳤다.')] },
  }),
  happening('t-give', {
    season: 'spring',
    roles: ['farmer', 'nobi'],
    theme: 'duty',
    spot: 'templeRoad',
    shows: { flags: ['news.go.give'], items: ['bundle'] },
    cost: 0,
    stage: { place: 'temple', cast: [{ who: 'monk' }] },
    lines: [say('monk', '먼 길을 떠난다.')],
    after: {
      effects: { living: -1, trust: 1 },
      setFlags: ['news.give'],
      cards: ['c1'],
      lines: [say('monk', '잘 먹겠다.', 'glad')],
      variants: [
        {
          when: { min: { trust: 8 } },
          effects: { living: -1, trust: 1 },
          setFlags: ['news.give'],
          cards: ['c1'],
          lines: [say('monk', '마을 사람들이 너를 칭찬하더구나.', 'glad')],
        },
      ],
    },
  }),

  // 꼭 푸는 미션 「볍씨 뿌리기」(농민 집): 고르고, 일 놀이를 하고, 기력이 바닥이면 이웃이 거든다(도움의 일)
  happening('t-sow', {
    season: 'spring',
    roles: ['farmer'],
    theme: 'farming',
    spot: 'paddy',
    cost: 0,
    stage: { place: 'paddy', cast: [{ who: 'father' }] },
    lines: [say('father', '볍씨를 어디에 뿌릴까?')],
    choices: [
      {
        id: 'low',
        label: '낮은 논에 몰아 뿌린다',
        lock: { unless: { min: { body: 2 } }, reason: '몸이 지쳐 논에 들어갈 수 없어요' },
        effects: { body: -1 },
        setFlags: ['sow.low'],
        lines: [me('낮은 논에 볍씨를 고루 뿌렸다.')],
        variants: [
          { when: { flags: ['sow.heaped'] }, effects: { body: -1, living: -1 }, setFlags: ['sow.low'], lines: [me('볍씨가 한쪽에 몰렸다.')] },
          {
            when: { flags: ['sow.left'] },
            setFlags: ['sow.low'],
            lines: [say('father', '남은 것은 내가 뿌리마.')],
            note: '힘든 일은 어른이 맡기도 했어요.',
          },
        ],
      },
      {
        id: 'split',
        label: '높은 논에도 나눠 뿌린다',
        lock: { unless: { min: { body: 2 } }, reason: '몸이 지쳐 논에 들어갈 수 없어요' },
        effects: { body: -2 },
        setFlags: ['sow.split'],
        lines: [me('두 논에 볍씨를 나눠 뿌렸다.')],
      },
    ],
    play: { game: 'sow', rules: 'direct', flags: { even: 'sow.even', heaped: 'sow.heaped', left: 'sow.left' } },
  }),
  happening('t-sow-rescue', {
    season: 'spring',
    roles: ['farmer'],
    theme: 'farming',
    spot: 'paddyEdge',
    cost: 0,
    stage: { place: 'paddy', cast: [{ who: 'elder' }] },
    lines: [say('elder', '몸이 안 좋구나. 내가 거들어 주마.')],
    after: { effects: { trust: -1 }, setFlags: ['sow.split', 'sow.helped'], lines: [me('이웃 어른이 볍씨를 나눠 뿌려 주셨다.')] },
  }),

  // 꼭 푸는 미션 「주인댁 심부름」(노비 집)
  happening('t-errand', {
    season: 'spring',
    roles: ['nobi'],
    theme: 'marriage',
    spot: 'yard',
    cost: 0,
    stage: { place: 'yard', cast: [{ who: 'mother' }] },
    lines: [say('mother', '잔치 심부름이 많구나.')],
    choices: [
      { id: 'quick', label: '서둘러 다 나른다', effects: { body: -1, trust: 1 }, setFlags: ['errand.done'], lines: [me('심부름을 일찍 마쳤다.')] },
      { id: 'slow', label: '쉬엄쉬엄 나른다', effects: { trust: -1 }, setFlags: ['errand.done'], lines: [me('해가 질 때에야 마쳤다.')] },
    ],
  }),

  // 덤으로 하는 일(해 ☀ 하나씩)
  happening('t-well', {
    season: 'spring',
    theme: 'duty',
    spot: 'well',
    cost: 1,
    stage: { place: 'well', cast: [{ who: 'mother' }] },
    lines: [say('mother', '우물가에 소문이 돈다.')],
    choices: [
      {
        id: 'listen',
        label: '이야기를 듣는다',
        effects: { trust: 1 },
        lines: [me('공사 이야기를 들었다.')],
        variants: [{ when: { look: 'girl' }, effects: { trust: 1 }, lines: [me('물을 길으며 공사 이야기를 들었다.')] }],
      },
      {
        id: 'carry',
        label: '물동이를 날라 드린다',
        lock: { unless: { min: { body: 3 } }, reason: '몸이 지쳐 물동이를 들 수 없어요' },
        effects: { body: -1, trust: 1 },
        lines: [me('물동이를 집까지 날라 드렸다.')],
      },
    ],
  }),
  happening('t-temple', {
    season: 'spring',
    theme: 'play',
    spot: 'temple',
    cost: 1,
    stage: { place: 'temple' },
    lines: [me('스님들이 떠난 절은 조용하다.')],
    after: { setFlags: ['story.temple'], cards: ['c2'], lines: [me('빈 마당에 바람만 분다.')] },
  }),
  happening('t-granny', {
    season: 'spring',
    theme: 'play',
    spot: 'granny',
    cost: 1,
    stage: { place: 'entrance', cast: [{ who: 'granny' }] },
    lines: [say('granny', '옛이야기를 들려주랴?')],
    choices: [
      {
        id: 'story',
        label: '옛이야기를 청한다',
        lock: { unless: { anyOf: [{ min: { trust: 6 } }, { flags: ['news.help'] }] }, reason: '할머니는 아직 나를 잘 모르세요' },
        setFlags: ['story.granny'],
        lines: [say('granny', '옛날에는 말이다.', 'glad')],
      },
      { id: 'greet', label: '인사만 드린다', effects: { trust: 1 }, lines: [say('granny', '오냐.')] },
    ],
  }),
  happening('t-woods', {
    season: 'spring',
    theme: 'farming',
    spot: 'woods',
    cost: 1,
    stage: { place: 'hill' },
    lines: [me('뒷산에 땔나무가 많다.')],
    after: { effects: { body: -1, living: 1 }, items: ['firewood'], lines: [me('땔나무를 한 짐 했다.')] },
  }),
  // 땔나무가 있어야 나타나는 일
  happening('t-fire', {
    season: 'spring',
    theme: 'play',
    spot: 'yard2',
    shows: { items: ['firewood'] },
    cost: 1,
    stage: { place: 'yard', cast: [{ who: 'granny' }] },
    lines: [say('granny', '불을 지펴 주니 따뜻하구나.')],
    after: { effects: { body: 1 }, lines: [me('아궁이 앞에서 몸을 녹였다.')] },
  }),
];

// ── 여름 ──────────────────────────────────────────────────────

const summerExtra = (n: number, spot: string, effects: Partial<Stats>): Happening =>
  happening(`t-summer-${n}`, {
    season: 'summer',
    theme: 'play',
    spot,
    cost: 1,
    stage: { place: 'well' },
    lines: [me(`여름의 덤 ${'가나다라'[n - 1]}.`)],
    after: { effects, lines: [me('덤으로 하는 일을 마쳤다.')] },
  });

const summer: Happening[] = [
  happening('t-weed', {
    season: 'summer',
    roles: ['farmer', 'nobi'],
    theme: 'farming',
    spot: 'paddy',
    cost: 0,
    stage: { place: 'paddy', cast: [{ who: 'mother' }, { who: 'friend' }] },
    lines: [me('여느 여름, 논에 풀이 가득하다.')],
    lineVariants: [{ when: { draw: 'drought' }, lines: [me('큰비 뒤, 논에 풀이 가득하다.')] }],
    choices: [
      {
        id: 'all',
        label: '온 식구가 매달린다',
        lock: { unless: { min: { body: 3 } }, reason: '몸이 지쳐 온종일 김을 맬 수 없어요' },
        effects: { body: -2, living: 1 },
        setFlags: ['weed.done'],
        lines: [me('여느 해처럼 김을 맸다.')],
        variants: [
          { when: { flags: ['sow.low'], draw: 'drought' }, effects: { body: -3 }, setFlags: ['weed.done'], lines: [me('잠긴 낮은 논에서 김을 맸다.')] },
          { when: { draw: 'drought' }, effects: { body: -2 }, setFlags: ['weed.done'], lines: [me('큰비 속에 김을 맸다.')] },
          { when: { draw: 'bumper' }, effects: { body: -2, living: 2 }, setFlags: ['weed.done'], lines: [me('비가 알맞아 벼가 잘 자랐다.')] },
        ],
      },
      {
        id: 'swap',
        label: '이웃과 서로 거든다',
        lock: { unless: { min: { trust: 3 } }, reason: '이웃과 서로 거든 적이 없어요' },
        effects: { body: -1, trust: 1 },
        setFlags: ['weed.done', 'weed.swap'],
        lines: [say('friend', '우리 논도 같이 매자.', 'glad')],
      },
      { id: 'rest', label: '몸을 아낀다', effects: { living: -1 }, setFlags: ['weed.done'], lines: [me('풀을 다 뽑지 못했다.')] },
    ],
  }),
  summerExtra(1, 'well', { trust: 1 }),
  summerExtra(2, 'granny', { body: 1 }),
  summerExtra(3, 'woods', { living: 1 }),
  summerExtra(4, 'temple', {}),
];

function mission(id: string, extra: Omit<Mission, 'id' | 'situation' | 'doneLine' | 'lesson'>): Mission {
  return { id, situation: SID, doneLine: '시험 미션을 해냈다.', lesson: '0차시: 시험', ...extra };
}

const missions: Mission[] = [
  mission('m-news', {
    season: 'spring',
    roles: ['farmer', 'nobi'],
    must: true,
    kind: 'live',
    title: '돌아온 사람들',
    goal: '마을 어귀에서 이야기를 듣고 고른 일을 마친다',
    parts: ['t-news', 't-help', 't-own', 't-give'],
    done: { anyOf: [{ flags: ['news.help'] }, { flags: ['news.own'] }, { flags: ['news.give'] }] },
    theme: 'duty',
  }),
  mission('m-sow', {
    season: 'spring',
    roles: ['farmer'],
    must: true,
    kind: 'do',
    title: '볍씨 뿌리기',
    goal: '우리 논에 볍씨를 뿌린다',
    parts: ['t-sow'],
    done: { anyOf: [{ flags: ['sow.low'] }, { flags: ['sow.split'] }] },
    rescue: 't-sow-rescue',
    theme: 'farming',
  }),
  mission('m-errand', {
    season: 'spring',
    roles: ['nobi'],
    must: true,
    kind: 'carry',
    title: '주인댁 심부름',
    goal: '마당에서 잔치 심부름을 마친다',
    parts: ['t-errand'],
    done: { flags: ['errand.done'] },
    theme: 'marriage',
  }),
  mission('m-weed', {
    season: 'summer',
    roles: ['farmer', 'nobi'],
    must: true,
    kind: 'do',
    title: '김매기',
    goal: '논의 풀을 뽑는다',
    parts: ['t-weed'],
    done: { flags: ['weed.done'] },
    theme: 'farming',
  }),
  // 덤 미션(한 해 내내)
  mission('m-stories', {
    season: 'year',
    must: false,
    kind: 'collect',
    title: '이야기 모으기',
    goal: '마을의 이야기 둘을 듣는다',
    parts: ['t-granny', 't-temple'],
    done: { flags: ['story.granny', 'story.temple'] },
    theme: 'play',
  }),
];

export const testPack: SituationPack = { situation: testSituation, missions, happenings: [...spring, ...summer] };

// ── 검사기에 넘길 곁 자료 ────────────────────────────────────────

const SPOTS = ['tree', 'neighbor', 'yard', 'yard2', 'templeRoad', 'paddy', 'paddyEdge', 'well', 'temple', 'granny', 'woods', 'school'];

/** 견본 맵: 향교(school)는 여자아이 모습과 노비 집 아이에게 막혀 있다 */
export const testMap: MapRef = {
  id: 'testmap',
  hasSpot: (spot) => SPOTS.includes(spot),
  canReach: (spot, who) => SPOTS.includes(spot) && !(spot === 'school' && (who.look === 'girl' || who.role === 'nobi')),
};

export const testBundle: ContentBundle = {
  packs: [testPack],
  catalog: [{ id: SID, group: 'early', year: 1, title: '시험 이야기', blurb: '규칙만 시험하려고 만든 작은 이야기', lessons: '0' }],
  groups,
  themes,
  cards: [
    { id: 'c1', situation: SID, title: '시험 카드 하나', text: '시험에 쓰는 카드예요.', facts: ['F00'] },
    { id: 'c2', situation: SID, title: '시험 카드 둘', text: '시험에 쓰는 카드예요.', facts: ['F00'] },
  ],
  items: [
    { id: 'bundle', label: '길양식 보따리', text: '스님께 드릴 곡식을 싼 보따리예요.' },
    { id: 'firewood', label: '땔나무', text: '뒷산에서 해 온 나무예요.' },
  ],
  sources: [{ id: 'F00', fact: '시험에 쓰는 근거', source: '시험', check: '시험' }],
  places: [{ id: 'yard', label: '집 마당' }],
  maps: [testMap],
};

// ── 판을 모는 도구 ─────────────────────────────────────────────

/** 지금 할 수 있는 모든 움직임: 맵에 나타난 일 × 열린 선택지 × 놀이가 끝난 모습 */
export function movesOf(pack: SituationPack, state: GameState): DoInput[] {
  const out: DoInput[] = [];
  for (const view of openHappenings(pack, state)) {
    if (view.noSun) continue;
    const h = view.happening;
    const hasChoices = Boolean(h.choices && h.choices.length > 0);
    const choices: (string | undefined)[] = hasChoices ? openChoiceIds(pack, state, h.id) : [undefined];
    const ends = h.play ? Object.keys(h.play.flags) : [];
    const plays: (string | undefined)[] = ends.length > 0 ? ends : [undefined];
    for (const choiceId of choices) for (const play of plays) out.push({ id: h.id, choiceId, play });
  }
  return out;
}

/** 적어 준 차례대로 일을 한다. '일' · '일/선택지' · '일/선택지/놀이' · '일//놀이' */
export function doAll(pack: SituationPack, state: GameState, steps: string[]): GameState {
  let s = state;
  for (const step of steps) {
    const [id, choiceId, play] = step.split('/');
    s = doHappening(pack, s, { id, choiceId: choiceId || undefined, play: play || undefined });
  }
  return s;
}

/** 수치를 정해 놓고 시작한다(해 ☀는 그대로 둔다) */
export function withStats(state: GameState, stats: Partial<Stats>): GameState {
  return { ...state, stats: { ...state.stats, ...stats } };
}

/** 같은 형편인가를 가리는 열쇠(걸어온 차례가 달라도 형편이 같으면 같은 열쇠) */
export function stateKey(state: GameState): string {
  const sorted = (list: readonly string[]) => [...list].sort().join(',');
  return [
    state.seasonIndex,
    state.stats.living,
    state.stats.body,
    state.stats.trust,
    state.sunsLeft,
    sorted(state.flags),
    sorted(state.items),
    sorted(state.done),
    sorted(state.solved),
  ].join('|');
}

export interface Explored {
  /** 그 계절 안에서 닿을 수 있는 모든 형편(처음 포함) */
  all: GameState[];
  /** 더 할 수 있는 일이 없는 형편(길의 끝) */
  leaves: GameState[];
  /** 꼭 푸는 미션을 다 풀 길이 없어진 형편 */
  stuck: GameState[];
}

/**
 * 한 계절의 모든 길을 걷는다(계절을 넘기지는 않는다).
 * 엔진의 openHappenings·doHappening만 쓴다. 형편이 같으면 한 번만 본다.
 */
export function explore(pack: SituationPack, start: GameState): Explored {
  const good = new Map<string, boolean>();
  const out: Explored = { all: [], leaves: [], stuck: [] };
  const visit = (state: GameState): boolean => {
    const key = stateKey(state);
    const known = good.get(key);
    if (known !== undefined) return known;
    good.set(key, false);
    out.all.push(state);
    let ok = canCloseSeason(pack, state);
    const moves = movesOf(pack, state);
    if (moves.length === 0) out.leaves.push(state);
    for (const move of moves) {
      if (visit(doHappening(pack, state, move))) ok = true;
    }
    good.set(key, ok);
    if (!ok) out.stuck.push(state);
    return ok;
  };
  visit(start);
  return out;
}

/**
 * 한 계절을 아무렇게나 한다: 할 수 있는 움직임 가운데 아무거나 고르고, 계절을 보낼 수 있게 되면 넷에 한 번꼴로 그만둔다.
 * 꼭 푸는 미션이 남았는데 할 수 있는 일이 없으면 던진다(막다른 길). watch는 걸음마다 그때의 형편을 받는다.
 */
export function playSeasonRandom(pack: SituationPack, start: GameState, rng: Rng, watch?: (state: GameState) => void): GameState {
  let state = start;
  for (let step = 0; step < 200; step++) {
    watch?.(state);
    const moves = movesOf(pack, state);
    const closable = canCloseSeason(pack, state);
    if (closable && (moves.length === 0 || rng() < 0.25)) return state;
    if (moves.length === 0) throw new Error(`막다른 길: 한 일 [${state.done.join(', ')}], 푼 미션 [${state.solved.join(', ')}]`);
    state = doHappening(pack, state, pickOne(rng, moves));
  }
  throw new Error('계절이 끝나지 않는다');
}

/** 아무렇게나 한 해를 끝까지 한다(고르는 난수도 씨앗을 받는다) */
export function playYearRandom(pack: SituationPack, role: RoleId, look: Look, seed: number, pickSeed = seed): GameState {
  const rng = mulberry32(pickSeed * 7919 + 13);
  let state = newGame(pack, role, look, seed);
  for (let turn = 0; turn < SEASONS.length && state.phase !== 'done'; turn++) {
    state = playSeasonRandom(pack, state, rng);
    state = nextSeason(pack, closeSeason(pack, state));
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

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

export { SEASONS };
