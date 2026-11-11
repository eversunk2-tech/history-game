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
  choiceViews,
  closeSeason,
  currentSeason,
  doHappening,
  happeningOf,
  newGame,
  nextSeason,
  openChoiceIds,
  openHappenings,
  type DoInput,
} from '../src/engine/game';
import { reviewYear } from '../src/engine/review';
import { mulberry32, pickOne, rollDraw, type Rng } from '../src/engine/rng';
import {
  SEASONS,
  type Condition,
  type GameState,
  type Happening,
  type Line,
  type Look,
  type Mission,
  type RoleDef,
  type RoleId,
  type Season,
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

/**
 * 누가 될까 뽑기(drawHero)의 견본: ① 1395년이 다 만들어졌을 때의 집과 모습(네 집 · 모습 여섯).
 * 양반 집 아들은 남자아이, 양반 집 딸은 여자아이, 농민 집·노비 집은 두 모습(spec.md 3.1의 2번).
 */
export const FOUR_HOUSES: readonly { id: RoleId; looks: Look[] }[] = [
  { id: 'son', looks: ['boy'] },
  { id: 'daughter', looks: ['girl'] },
  { id: 'farmer', looks: ['boy', 'girl'] },
  { id: 'nobi', looks: ['boy', 'girl'] },
];

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

/** 한 계절의 걷기에 두는 끝: 걸음의 깊이와 살피는 형편의 수(지금의 견본과 실제 봄은 이보다 훨씬 작다) */
export const EXPLORE_DEPTH = 60;
export const EXPLORE_STATES = 200000;

/**
 * 한 해 걷기(exploreYear)에서 계절마다 살피는 형편의 한도. 네 가지 걷기(두 모습 × 날씨)에서 잰 가장 큰 수의 네 배쯤이다
 * (1-라 고치기에서 잼 — 봄 1,120 · 여름 9,056~25,006 · 가을 99,587~144,972 · 겨울 313,737~407,837).
 * 계절마다 따로 두어, 판이 부푸는 잘못이 봄·여름에 있으면 그 계절에서 바로 떨어지고(한 해를 다 걷기 전에),
 * 겨울에 선택 있는 덤 하나가 늘어도 멀쩡한 판이 떨어지지 않게 했다(review 1-라 35번 ㉡ — 앞에는 모든 계절이 100만 하나였다).
 */
export const YEAR_WALK_LIMITS: Record<Season, number> = { spring: 4_500, summer: 100_000, autumn: 600_000, winter: 1_600_000 };

/**
 * 일 놀이가 끝난 모습에 따른 수치를 견준다(spec 5.2의 5번 "놀이의 차이는 품과 거둔 양의 작은 차이(±1)", review 1-라 10번).
 * - 같은 선택지·형편에서 끝난 모습들의 차이가 수치마다 1 안이다(어느 둘을 견주어도).
 * - "어른께 맡긴다"(left)가 "하다 만 것"(partial)보다 낫지 않다(같은 것은 된다 — 애쓰다 만 아이가 맡긴 아이보다 손해가 아니게).
 * 어긋난 곳을 글로 돌려준다(없으면 빈 목록).
 */
export function playEndProblems(byEnd: Record<string, Stats>, partial: string, left = 'left'): string[] {
  const out: string[] = [];
  const base = byEnd[partial];
  if (!base || !byEnd[left]) return [`끝난 모습 ${partial}·${left}가 없다`];
  const stats = Object.keys(base) as (keyof Stats)[];
  for (const stat of stats) {
    const values = Object.values(byEnd).map((v) => v[stat]);
    if (Math.max(...values) - Math.min(...values) > 1) out.push(`${stat}: 끝난 모습 사이의 차이가 ${Math.max(...values) - Math.min(...values)}`);
  }
  const l = byEnd[left];
  if (stats.every((stat) => l[stat] >= base[stat]) && stats.some((stat) => l[stat] > base[stat])) out.push(`${left}가 ${partial}보다 낫다`);
  return out;
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
  // 판이 나아가지 않는 잘못(한 일이 적히지 않는다, 다른 계절의 일이 섞여 든다)이 들어오면 멈추지 않고 실패하게 끝을 둔다
  const visit = (state: GameState, depth = 0): boolean => {
    if (depth > EXPLORE_DEPTH) throw new Error(`한 계절에 ${EXPLORE_DEPTH}걸음을 넘게 걸었다: 판이 나아가지 않는다`);
    const key = stateKey(state);
    const known = good.get(key);
    if (known !== undefined) return known;
    if (out.all.length >= EXPLORE_STATES) throw new Error(`살핀 형편이 ${EXPLORE_STATES}가지를 넘었다: 걷기가 끝나지 않는다`);
    good.set(key, false);
    out.all.push(state);
    let ok = canCloseSeason(pack, state);
    const moves = movesOf(pack, state);
    if (moves.length === 0) out.leaves.push(state);
    for (const move of moves) {
      if (visit(doHappening(pack, state, move), depth + 1)) ok = true;
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

// ── 한 해를 걷는 도구(바퀴 1-라) ──────────────────────────────────

/** 다음 계절로 넘어간다(계절을 닫고 넘긴다). 겨울 뒤에는 한 해가 끝난다. */
export function advance(pack: SituationPack, state: GameState): GameState {
  return nextSeason(pack, closeSeason(pack, state));
}

/**
 * 꼭 푸는 미션의 일만 해서 그 계절을 보낼 수 있게 만든다(덤은 하지 않는다).
 * prefer: 고를 수 있는 움직임이 여럿일 때 먼저 고를 것들('일/선택지/놀이'의 앞머리). 없으면 처음 것.
 */
export function playMusts(pack: SituationPack, start: GameState, prefer: string[] = []): GameState {
  let state = start;
  for (let step = 0; step < 40 && !canCloseSeason(pack, state); step++) {
    const moves = movesOf(pack, state).filter((move) => happeningOf(pack, move.id).cost === 0);
    if (moves.length === 0) throw new Error(`막다른 길: ${currentSeason(state)} — 한 일 [${state.done.join(', ')}]`);
    const name = (move: DoInput) => [move.id, move.choiceId ?? '', move.play ?? ''].join('/');
    const wanted = moves.find((move) => prefer.some((head) => name(move).startsWith(head)));
    state = doHappening(pack, state, wanted ?? moves[0]);
  }
  if (!canCloseSeason(pack, state)) throw new Error(`${currentSeason(state)}의 꼭 푸는 미션이 끝나지 않는다`);
  return state;
}

/**
 * 그 계절의 맵까지 간다: 앞 계절들은 꼭 푸는 미션만 하고 넘긴다. weather를 주면 그 날씨가 뽑히는 씨앗으로 시작한다.
 * prefer는 playMusts에 넘긴다(앞 계절에서 고를 길).
 */
export function toSeason(
  pack: SituationPack,
  role: RoleId,
  look: Look,
  season: Season,
  options: { weather?: string; prefer?: string[]; seed?: number } = {},
): GameState {
  const seed = options.seed ?? (options.weather ? seedFor(options.weather) : 1);
  let state = newGame(pack, role, look, seed);
  while (currentSeason(state) !== season) state = advance(pack, playMusts(pack, state, options.prefer));
  return state;
}

/** 조건이 읽는 표시("또는" 안까지) */
function flagsIn(cond: Condition | undefined, into: Set<string>): void {
  if (!cond) return;
  for (const flag of [...(cond.flags ?? []), ...(cond.notFlags ?? [])]) into.add(flag);
  for (const one of cond.anyOf ?? []) flagsIn(one, into);
}

/** 그 계절부터 뒤에서 읽히는 표시들: 그 계절과 뒤 계절의 일, 미션, 나중 결과, 한 해 이름, 바람이 읽는 것 */
export function flagsReadFrom(pack: SituationPack, role: RoleId, seasonIndex: number): Set<string> {
  const out = new Set<string>();
  for (const h of pack.happenings) {
    if (SEASONS.indexOf(h.season) < seasonIndex || (h.roles && !h.roles.includes(role))) continue;
    flagsIn(h.shows, out);
    for (const variant of h.lineVariants ?? []) flagsIn(variant.when, out);
    // 그 일의 놀이가 남긴 표시를 그 일의 결과가 읽는 것은 뺀다(일을 마친 뒤에는 쓰이지 않는다. 다른 곳이 읽으면 거기서 든다)
    const own = new Set(Object.values(h.play?.flags ?? {}));
    const result = new Set<string>();
    for (const choice of h.choices ?? []) {
      flagsIn(choice.lock?.unless, out);
      for (const variant of choice.variants ?? []) flagsIn(variant.when, result);
    }
    for (const variant of h.after?.variants ?? []) flagsIn(variant.when, result);
    for (const flag of result) if (!own.has(flag)) out.add(flag);
  }
  // 미션이 풀렸는지 가리는 표시: 그 계절부터의 미션과 한 해 내내 푸는 덤 미션의 것(앞 계절의 미션은 이미 풀렸다)
  for (const m of pack.missions) {
    if (m.roles && !m.roles.includes(role)) continue;
    if (m.season === 'year' || SEASONS.indexOf(m.season) >= seasonIndex) flagsIn(m.done, out);
  }
  for (const later of pack.situation.later ?? []) if (SEASONS.indexOf(later.at) >= seasonIndex) flagsIn(later.when, out);
  for (const ending of pack.situation.endings) flagsIn(ending.when, out);
  for (const row of pack.situation.roles.find((r) => r.id === role)?.wishOutcomes ?? []) flagsIn(row.when, out);
  return out;
}

export interface YearWalk {
  /** 계절마다: 서로 다른 처음 형편의 수 */
  starts: number[];
  /** 계절마다: 살핀 형편의 수 */
  states: number[];
  /** 꼭 푸는 미션을 다 풀 길이 없어진 형편(계절과 한 일) */
  stuck: string[];
  /** 한 해를 마친 판들에서 나온 한 해 이름(id → 한 가지 보기) */
  names: Map<string, GameState>;
  /** 한 해를 마친 형편의 수(서로 다른 것) */
  ends: number;
  /** 도중에 본 것들: 잠긴 선택지('일/선택지'), 한 일, 인심이 깎인 일 */
  locksSeen: Set<string>;
  did: Set<string>;
  trustLoss: Set<string>;
}

/**
 * 한 해 전체를 엔진으로 걷는다: 계절마다 닿을 수 있는 모든 형편을 걷고(계절을 보낼 수 있는 형편마다 닫아),
 * 서로 다른 "다음 계절의 처음 형편"을 모아 다음 계절로 넘긴다. 검사기의 걷기와 달리 수치를 어림하지 않는다 —
 * 실제 시작 수치에서 닿는 수치만 걷는다. 형편이 같은지는 수치·해·그 계절부터 읽히는 표시·그 계절에 한 일로 가린다
 * (앞 계절에 무엇을 했는지는 뒤에서 읽히는 표시로만 남는다. 모은 카드의 수는 가리지 않는다 — 덤 미션에만 걸린다).
 * 끝이 있다: 한 계절의 걸음과 살피는 형편에 한도를 두어, 판이 나아가지 않으면 멈추지 않고 던진다.
 */
export function exploreYear(pack: SituationPack, role: RoleId, look: Look, weather: string): YearWalk {
  const out: YearWalk = { starts: [], states: [], stuck: [], names: new Map(), ends: 0, locksSeen: new Set(), did: new Set(), trustLoss: new Set() };
  const sorted = (list: Iterable<string>) => [...list].sort().join(',');
  let starts: GameState[] = [newGame(pack, role, look, seedFor(weather))];
  const finals = new Set<string>();

  for (let index = 0; index < SEASONS.length; index++) {
    const season = SEASONS[index];
    const reads = flagsReadFrom(pack, role, index);
    const readsNext = flagsReadFrom(pack, role, index + 1);
    const mine = new Set(pack.happenings.filter((h) => h.season === season).map((h) => h.id));
    const keyOf = (state: GameState): string =>
      [
        state.stats.living,
        state.stats.body,
        state.stats.trust,
        state.sunsLeft,
        sorted(state.flags.filter((flag) => reads.has(flag))),
        sorted(state.done.filter((id) => mine.has(id))),
      ].join('|');
    const good = new Map<string, boolean>();
    const next = new Map<string, GameState>();
    let seen = 0;

    const visit = (state: GameState, depth: number): boolean => {
      if (depth > EXPLORE_DEPTH) throw new Error(`${season}: ${EXPLORE_DEPTH}걸음을 넘게 걸었다(판이 나아가지 않는다)`);
      const key = keyOf(state);
      const known = good.get(key);
      if (known !== undefined) return known;
      if (++seen > YEAR_WALK_LIMITS[season]) throw new Error(`${season}: 살핀 형편이 ${YEAR_WALK_LIMITS[season]}가지를 넘었다(판이 부푼다 — YEAR_WALK_LIMITS)`);
      good.set(key, false);
      // 지금 할 수 있는 움직임을 한 번에 모은다(잠긴 선택지는 본 것으로 적는다)
      const moves: DoInput[] = [];
      for (const view of openHappenings(pack, state)) {
        const h = view.happening;
        let picks: (string | undefined)[] = [undefined];
        if (h.choices && h.choices.length > 0) {
          const shown = choiceViews(pack, state, h.id);
          for (const choice of shown) if (choice.locked) out.locksSeen.add(`${h.id}/${choice.id}`);
          picks = shown.filter((choice) => !choice.locked).map((choice) => choice.id);
        }
        if (view.noSun) continue;
        const ends: (string | undefined)[] = h.play ? Object.keys(h.play.flags) : [undefined];
        for (const choiceId of picks) for (const play of ends) moves.push({ id: h.id, choiceId, play });
      }
      let ok = canCloseSeason(pack, state);
      if (ok) {
        const after = advance(pack, state);
        if (after.phase === 'done') {
          const finalKey = [after.stats.living, after.stats.body, after.stats.trust, sorted(after.flags.filter((flag) => reads.has(flag)))].join('|');
          if (!finals.has(finalKey)) {
            finals.add(finalKey);
            const name = reviewYear(pack, after).yearName.id;
            if (!out.names.has(name)) out.names.set(name, after);
          }
        } else {
          const nextKey = [
            after.stats.living,
            after.stats.body,
            after.stats.trust,
            sorted(after.flags.filter((flag) => readsNext.has(flag))),
          ].join('|');
          if (!next.has(nextKey)) next.set(nextKey, after);
        }
      }
      for (const move of moves) {
        const child = doHappening(pack, state, move);
        const deed = child.history[child.history.length - 1];
        out.did.add(deed.happeningId);
        if (deed.delta.trust < 0) out.trustLoss.add(`${deed.happeningId}/${deed.choiceId ?? ''}`);
        if (visit(child, depth + 1)) ok = true;
      }
      good.set(key, ok);
      if (!ok) out.stuck.push(`${season}: [${state.done.filter((id) => mine.has(id)).join(', ')}] 살림 ${state.stats.living}·기력 ${state.stats.body}·인심 ${state.stats.trust}`);
      return ok;
    };

    for (const start of starts) visit(start, 0);
    out.starts.push(starts.length);
    out.states.push(seen);
    starts = [...next.values()];
  }
  out.ends = finals.size;
  return out;
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

export { SEASONS };
