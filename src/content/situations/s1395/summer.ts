// ① 1395년 여름 — 농민 집 아이의 일(Happening) 여섯.
//   꼭 푸는 미션 「단오 놀이판」: 냇가 놀이판에서 단옷날을 어떻게 보낼지 정한다(일 하나)
//   꼭 푸는 미션 「김매기」: 우리 논에서 어떻게 맬지 정하고 손수 맨다(일 하나, 일 놀이) + 도움의 일(이웃이 거들어 준다)
//   덤으로 하는 일 셋: 양반 댁 대문 앞(한양에서 온 소식) · 이웃집 논(김매기 거들기) · [큰비가 온 해에만] 냇가 논둑
// 대본과 출처 대조는 docs/script-1395.md의 13절부터.
// 인물의 말·마을·논둑과 물길은 꾸민 것이고, 제도·달·생활 방식만 근거(facts)를 따른다.
// 모습에 따라 달라지는 것은 단오뿐이다(여자아이는 창포물과 그네, 남자아이는 씨름 — F60).
// 봄에 정한 것이 돌아온다: 볍씨의 논(sow.low·sow.split) × 날씨는 김매기의 여는 대화에, 봄에 논갈이를 거든 것(return.help)은 김매기의 길과 이웃의 말에.

import type { Condition, Happening, Line, Outcome, StatDelta } from '../../../engine/types';
import { FLAGS } from './spring';

const S = 's1395';
const FARMER = ['farmer'];

/** 여름의 표시(flag) */
export const SUMMER = {
  danoDone: 'dano.done',
  weedDone: 'weed.done',
  /** 일 놀이 「김매기」가 끝난 모습 */
  weedClean: 'weed.clean',
  weedRough: 'weed.rough',
  weedLeft: 'weed.left',
} as const;

const DANO_CARD = ['s1395-dano'];

// ── 단오 놀이판의 여는 대화 ─────────────────────────────────────
const DANO_FIRST: Line = { text: '오월 오일 단옷날이다. 냇가 놀이판에 마을 사람들이 모였다.' };
// 큰비가 온 해의 여름 맵은 계절 내내 비가 오고 냇물이 불어 있다: 비가 그친 것이 아니라 잠깐 멎은 것이다
const DANO_FIRST_RAIN: Line = { text: '단옷날, 줄곧 내리던 비가 잠깐 멎었다. 물이 불어난 냇가에 사람들이 모였다.' };
const DANO_LAST: Line = { text: '어른들께 올릴 떡을 빚는 집도 있고, 논에 나간 집도 있다. 오늘을 어떻게 보낼까?' };
const DANO_BOY: Line[] = [
  { who: 'friend-boy', pose: 'glad', text: '씨름판이 섰어! 나랑 한판 붙자.' },
  { who: 'friend-girl', text: '우리는 창포 삶은 물에 머리 감고 그네 뛸 거야.' },
];
const DANO_GIRL: Line[] = [
  { who: 'friend-girl', pose: 'glad', text: '창포 삶은 물에 머리 감고 그네 뛰러 가자!' },
  { who: 'friend-boy', text: '우리는 씨름판이야. 누가 이기나 구경 와.' },
];

// ── 김매기 ─────────────────────────────────────────────────────
const WEED_MOTHER: Line = { who: 'mother', text: '볍씨를 바로 뿌린 논이라 풀이 벼 사이에 섞여 난단다. 하나하나 가려 뽑아야 해.' };
const WEED_NEIGHBOR: Line = { who: 'neighbor-elder', text: '우리 논도 마찬가지란다. 서로 거들면 두 집 논을 다 맬 수 있을 텐데.' };
const WEED_ASK: Line = { text: '김매기는 여름 내내 이어진다. 어떻게 할까?' };

/** 놀이가 끝난 모습마다의 어머니의 말(결과 대화의 첫 창) */
const WEED_PLAY: Record<'clean' | 'rough' | 'left', Line> = {
  clean: { who: 'mother', pose: 'glad', text: '벼는 그대로 두고 풀만 말끔히 뽑았구나. 벼가 숨을 쉬겠다.' },
  rough: { who: 'mother', text: '풀이 좀 남았구나. 괜찮다, 며칠 뒤에 또 매야 하니까.' },
  left: { who: 'mother', text: '그래, 오늘은 내가 매마. 내 일은 밀리겠지만, 곁에서 벼와 풀을 가려 보아라.' },
};
const WEED_ALL: Line = { text: '온 식구가 논에 엎드려 풀을 뽑았다. 허리는 끊어질 듯해도 논이 한결 훤하다.' };
const WEED_SWAP: Line = { who: 'neighbor-elder', pose: 'glad', text: '오늘은 너희 논, 다음은 우리 논이다. 여럿이 하니 금방이구나.' };
const WEED_SWAP_REPAY: Line = { who: 'neighbor-elder', pose: 'glad', text: '봄에 네가 우리 논갈이를 거들었지. 이번엔 내가 갚을 차례다.' };
const WEED_REST: Line = { text: '쉬엄쉬엄 논 한쪽만 맸다. 남은 풀이 벼와 키를 겨룬다.' };
/** 어른께 맡겼을 때의 둘째 창(4-1 ㉠, 1-라 11.8 ⑧ — 어머니가 "곁에서 보아라" 한 뒤에 "온 식구가 엎드려…"·"쉬엄쉬엄…"이 나와 어긋났다) */
const WEED_LEFT: Line = { text: '어머니가 논에 엎드려 풀을 뽑으셨다. 곁에서 보니 벼와 풀이 조금씩 가려 보인다.' };
/** 쉬엄쉬엄 맸는데 놀이에서 풀을 말끔히 뽑았을 때(review 3번) */
const WEED_REST_CLEAN: Line = { text: '쉬엄쉬엄 맸지만 내 손이 닿은 데는 말끔하다. 남은 데는 다음에 매자.' };

/** 김매기의 결과 하나: 첫 창은 놀이가 끝난 모습, 둘째 창은 고른 길 */
function weeded(play: 'clean' | 'rough' | 'left', second: Line, effects: StatDelta): Outcome {
  return { effects, setFlags: [SUMMER.weedDone], lines: [WEED_PLAY[play], second] };
}
const whenPlay = (flag: string, extra: Condition = {}): Condition => ({ ...extra, flags: [...(extra.flags ?? []), flag] });

export const happenings: Happening[] = [
  // ── 꼭 푸는 미션 「단오 놀이판」 ────────────────────────────────
  {
    // 바탕은 남자아이 모습·평소 같은 해. 여자아이 모습이면 둘째·셋째 창이, 큰비가 온 해이면 첫 창이 바뀐다.
    id: 's1395-summer-dano',
    situation: S,
    season: 'summer',
    roles: FARMER,
    theme: 'play',
    spot: 'streamside',
    cost: 0,
    stage: {
      place: 'stream',
      cast: [
        { who: 'friend-girl', at: 'left' },
        { who: 'friend-boy', at: 'right' },
      ],
    },
    lines: [DANO_FIRST, ...DANO_BOY, DANO_LAST],
    lineVariants: [
      { when: { look: 'girl', draw: 'drought' }, lines: [DANO_FIRST_RAIN, ...DANO_GIRL, DANO_LAST] },
      { when: { draw: 'drought' }, lines: [DANO_FIRST_RAIN, ...DANO_BOY, DANO_LAST] },
      { when: { look: 'girl' }, lines: [DANO_FIRST, ...DANO_GIRL, DANO_LAST] },
    ],
    choices: [
      {
        // 하루 쉰다: 기력만 얻는다. 모습에 따라 놀이가 다르다(F60).
        id: 'play',
        label: '하루 쉬며 놀이판에 어울린다',
        effects: { body: 2 },
        setFlags: [SUMMER.danoDone],
        cards: DANO_CARD,
        lines: [
          { text: '모래판에서 동무와 맞붙었다. 넘어져도 웃음이 난다.' },
          { who: 'friend-boy', pose: 'glad', text: '한 판 더! 논일은 내일 하면 되잖아.' },
        ],
        variants: [
          {
            when: { look: 'girl' },
            effects: { body: 2 },
            setFlags: [SUMMER.danoDone],
            cards: DANO_CARD,
            lines: [
              { text: '창포물에 감은 머리가 향긋하다. 그네가 솟을 때마다 마을이 한눈에 든다.' },
              { who: 'friend-girl', pose: 'glad', text: '더 높이! 논일은 내일 하면 되잖아.' },
            ],
          },
        ],
      },
      {
        // 마을의 명절에 빠진다: 살림을 얻고 인심을 잃는다. 누구도 나를 꾸짖지 않는다.
        id: 'work',
        label: '놀이판을 뒤로하고 논일을 한다',
        effects: { living: 1, trust: -1 },
        setFlags: [SUMMER.danoDone],
        cards: DANO_CARD,
        lines: [
          { text: '웃음소리를 뒤로하고 논둑의 풀을 베었다. 논일은 한 걸음 앞섰다.' },
          { text: '돌아오는 길, 놀이판에서 나를 찾던 동무의 목소리가 들린다.' },
        ],
      },
      {
        // 어른들께 먼저 올린다(어른 공경): 살림을 내고 인심을 얻는다. 곡식이 넉넉하지 않으면 잠긴다.
        id: 'treat',
        label: '떡을 빚어 어른들께 먼저 올린다',
        lock: { unless: { min: { living: 4 } }, reason: '떡을 빚을 만큼 곡식이 넉넉하지 않아요' },
        effects: { living: -1, trust: 1, body: 1 },
        setFlags: [SUMMER.danoDone],
        cards: DANO_CARD,
        lines: [
          { text: '쑥을 뜯어 떡을 빚었다. 놀이판의 어른들께 먼저 돌렸다.' },
          { who: 'friend-girl', pose: 'glad', text: '우리 할머니가 맛있다고 하셔! 이제 너도 와서 놀자.' },
        ],
      },
    ],
    // 놀이의 모습은 뒷시대 기록에 가깝다(spec 12.3의 9번) — "즐겼다고 해요"
    note: '단오에는 창포물에 머리를 감고 그네뛰기와 씨름을 즐겼다고 해요.',
    facts: ['F60'],
  },

  // ── 꼭 푸는 미션 「김매기」 ────────────────────────────────────
  {
    // 고르고 → 일 놀이 → 결과. 바탕은 "풀이 남음"(하다 만 것)이고, 끝난 모습 셋의 차이는 수치마다 1 안이다(spec 5.2의 5번):
    // 말끔히는 살림 +1 더, 어른께 맡기면 "풀이 남음"과 같다 — 맡기는 것이 하다 만 것보다 나은 일이 없게(review 10번). 어머니의 일이 밀리는 것은 말로만 치른다.
    // 기력이 바닥(1 이하)이면 세 선택지가 모두 잠기고 도움의 일이 열린다(봄과 여름에 품을 다 들인 판에서 닿는다).
    id: 's1395-summer-weed',
    situation: S,
    season: 'summer',
    roles: FARMER,
    theme: 'farming',
    spot: 'ourPaddy',
    cost: 0,
    stage: {
      place: 'paddy',
      cast: [
        { who: 'mother', at: 'left' },
        { who: 'neighbor-elder', at: 'right' },
      ],
    },
    lines: [{ text: '우리 논의 벼가 한 뼘쯤 자랐다. 그 사이사이로 풀이 벼만큼 올라왔다.' }, WEED_MOTHER, WEED_NEIGHBOR, WEED_ASK],
    lineVariants: [
      {
        // 큰비가 온 해 + 봄에 낮은 논에 몰아 뿌림
        when: { draw: 'drought', flags: [FLAGS.sowLow] },
        lines: [
          { text: '비가 잦다. 냇가 낮은 논에 물이 차오르는데, 풀은 그래도 자란다.' },
          { who: 'mother', pose: 'worried', text: '물이 더 불기 전에 맬 수 있는 데부터 매자. 풀이 벼 사이에 섞여 나서 가려 뽑아야 해.' },
          WEED_NEIGHBOR,
          WEED_ASK,
        ],
      },
      {
        // 큰비가 온 해 + 봄에 높은 논에도 나눠 뿌림
        when: { draw: 'drought' },
        lines: [
          { text: '비가 잦다. 낮은 논에는 물이 차오르고, 높은 논에는 풀이 무성하다.' },
          { who: 'mother', text: '높은 논부터 매자. 풀이 벼 사이에 섞여 나서 하나하나 가려 뽑아야 해.' },
          WEED_NEIGHBOR,
          WEED_ASK,
        ],
      },
      {
        when: { draw: 'bumper' },
        lines: [{ text: '비가 알맞게 와서 벼가 쑥쑥 자란다. 풀도 지지 않고 올라왔다.' }, WEED_MOTHER, WEED_NEIGHBOR, WEED_ASK],
      },
    ],
    choices: [
      {
        id: 'all',
        label: '온 식구가 매달려 맨다',
        lock: { unless: { min: { body: 3 } }, reason: '몸이 지쳐 온 논을 다 맬 수 없어요' },
        ...weeded('rough', WEED_ALL, { body: -2, living: 1 }),
        variants: [
          { when: whenPlay(SUMMER.weedClean), ...weeded('clean', WEED_ALL, { body: -2, living: 2 }) },
          { when: whenPlay(SUMMER.weedLeft), ...weeded('left', WEED_LEFT, { body: -2, living: 1 }) },
        ],
      },
      {
        // 인심이 낮으면(3 이하) 잠긴다. 봄에 돌아온 집의 논갈이를 거들었으면 인심이 낮아도 열리고, 이웃 어른이 "갚을 차례"라고 한다.
        // 기력이 바닥(1 이하)이어도 잠긴다 — 남의 논까지 거들 수 없다. 까닭은 형편마다 따로다(review 15번):
        // 기력 때문이면 바탕의 까닭, 기력은 괜찮은데 인심 때문이면 이웃 일을 거들면 열린다는 것이 읽히는 까닭.
        id: 'swap',
        label: '이웃과 서로 거들어 맨다',
        lock: {
          unless: { min: { body: 2 }, anyOf: [{ min: { trust: 4 } }, { flags: [FLAGS.help] }] },
          reason: '몸이 지쳐 남의 논까지 거들 수 없어요',
          reasons: [{ when: { min: { body: 2 } }, reason: '이웃을 거든 일이 적어 서로 거들자고 하기 어려워요' }],
        },
        ...weeded('rough', WEED_SWAP, { body: -1, trust: 1 }),
        variants: [
          { when: whenPlay(SUMMER.weedClean, { flags: [FLAGS.help] }), ...weeded('clean', WEED_SWAP_REPAY, { body: -1, trust: 1, living: 1 }) },
          { when: whenPlay(SUMMER.weedLeft, { flags: [FLAGS.help] }), ...weeded('left', WEED_SWAP_REPAY, { body: -1, trust: 1 }) },
          { when: { flags: [FLAGS.help] }, ...weeded('rough', WEED_SWAP_REPAY, { body: -1, trust: 1 }) },
          { when: whenPlay(SUMMER.weedClean), ...weeded('clean', WEED_SWAP, { body: -1, trust: 1, living: 1 }) },
          { when: whenPlay(SUMMER.weedLeft), ...weeded('left', WEED_SWAP, { body: -1, trust: 1 }) },
        ],
      },
      {
        id: 'rest',
        label: '몸을 아끼며 쉬엄쉬엄 맨다',
        lock: { unless: { min: { body: 2 } }, reason: '몸이 아파 논에 나갈 수 없어요' },
        ...weeded('rough', WEED_REST, { living: -1 }),
        variants: [
          { when: whenPlay(SUMMER.weedClean), ...weeded('clean', WEED_REST_CLEAN, {}) },
          { when: whenPlay(SUMMER.weedLeft), ...weeded('left', WEED_LEFT, { living: -1 }) },
        ],
      },
    ],
    play: { game: 'weed', rules: '1395', flags: { clean: SUMMER.weedClean, rough: SUMMER.weedRough, left: SUMMER.weedLeft } },
    note: '바로 뿌린 논은 벼와 풀이 섞여 자라, 풀만 가려 뽑는 김매기에 손이 많이 갔어요.',
    facts: ['F04'],
  },
  {
    // 도움의 일: 김매기의 세 선택지가 모두 잠겼을 때(기력 1 이하)만 나타난다. 이웃이 거들어 준다 — 대신 인심이 걸린다(spec 6.3).
    // 봄에 그 집의 논갈이를 거들었으면 걸리는 것이 없다(봄에 낸 일손이 돌아온다).
    id: 's1395-summer-weed-help',
    situation: S,
    season: 'summer',
    roles: FARMER,
    theme: 'farming',
    spot: 'home',
    cost: 0,
    stage: { place: 'yard', cast: [{ who: 'neighbor-elder', at: 'center' }] },
    lines: [
      { text: '몸이 말을 듣지 않아 집에 누워 있는데, 이웃 어른이 마당으로 들어서신다.' },
      { who: 'neighbor-elder', text: '너희 논 풀이 벼를 덮겠더구나. 오늘은 우리 식구가 매 주마.' },
      { text: '고맙고도 미안해서 고개를 들 수가 없다.' },
    ],
    after: {
      effects: { trust: -1 },
      setFlags: [SUMMER.weedDone],
      lines: [
        { who: 'neighbor-elder', text: '몸이 나으면 그때 갚아라. 이웃이 그런 거란다.' },
        { text: '받기만 한 일손이 마음에 남는다. 꼭 갚아야지.' },
      ],
      variants: [
        {
          when: { flags: [FLAGS.help] },
          setFlags: [SUMMER.weedDone],
          lines: [
            { who: 'neighbor-elder', pose: 'glad', text: '봄에 네가 우리 논갈이를 거들었지. 이번엔 내가 갚을 차례다.' },
            { text: '봄에 낸 일손이 이렇게 돌아왔다. 얼른 나아서 논에 나가야지.' },
          ],
        },
      ],
    },
    note: '볍씨를 바로 뿌린 논은 여름 동안 김을 네댓 번이나 매야 했어요.',
    facts: ['F04'],
  },

  // ── 덤으로 하는 일(해 ☀ 하나씩) ──────────────────────────────────
  {
    // 듣기만 하는 일. "양반 댁 사랑채"라고 쓰지 않는다(조선 전기 — "손님 맞는 채").
    id: 's1395-summer-manor',
    situation: S,
    season: 'summer',
    roles: FARMER,
    theme: 'duty',
    spot: 'manorFront',
    cost: 1,
    lure: '관아에서 한양 소식이 왔다더라',
    stage: { place: 'manor', cast: [{ who: 'official', at: 'center' }] },
    lines: [
      { text: '양반 댁 대문 앞에 고을 관아(고을의 관청)에서 온 사람이 서 있다.' },
      { who: 'official', text: '유월에 나라에서 한양부를 한성부로 고쳐 부르게 했다. 새 도읍의 이름이지.' },
      { who: 'official', text: '혼례와 장례, 제사의 예절도 새로 정하라는 명이 내렸단다.' },
    ],
    after: {
      cards: ['s1395-hanseong'],
      lines: [
        { text: '혼례, 장례, 제사… 우리 마을은 제사를 절에서 지내 왔는데, 무엇이 달라질까?' },
        { text: '양반 댁 손님 맞는 채에서는 벌써 그 이야기가 한창이라고 한다.' },
      ],
    },
    note: '이해 유월, 나라는 한양부를 한성부로 고치고 혼례·장례·제사의 예절을 정하게 했어요.',
    facts: ['F57'],
  },
  {
    // 해내기만 하는 일: 기력을 내고 인심을 얻는다. 김매기 미션보다 먼저 하면 기력이 줄어 "온 식구가 매달려 맨다"가 잠길 수 있다.
    id: 's1395-summer-neighbor',
    situation: S,
    season: 'summer',
    roles: FARMER,
    theme: 'farming',
    spot: 'neighborPaddy',
    cost: 1,
    lure: '아주머니네 논에 풀이 한가득이라더라',
    stage: { place: 'paddy', cast: [{ who: 'well-neighbor', at: 'center' }] },
    lines: [
      { text: '이웃집 논에서 아주머니와 동무가 김을 매고 있다. 풀이 아직 반이나 남았다.' },
      { who: 'well-neighbor', text: '둘이서 매자니 끝이 안 보이는구나. 풀은 뽑아도 뽑아도 또 올라온단다.' },
      { text: '소매를 걷고 논에 들어섰다.' },
    ],
    lineVariants: [
      {
        // 봄에 이 집의 논갈이를 거들었으면 아주머니가 알아본다
        when: { flags: [FLAGS.help] },
        lines: [
          { text: '이웃집 논에서 아주머니와 동무가 김을 매고 있다. 풀이 아직 반이나 남았다.' },
          { who: 'well-neighbor', pose: 'glad', text: '봄에 논갈이를 거들어 주더니 또 왔구나. 풀은 뽑아도 뽑아도 또 올라온단다.' },
          { text: '소매를 걷고 논에 들어섰다.' },
        ],
      },
    ],
    after: {
      effects: { body: -1, trust: 1 },
      lines: [
        { who: 'well-neighbor', pose: 'glad', text: '덕분에 오늘 안에 끝내겠다. 너희 논 맬 때는 우리도 가마.' },
        { text: '손톱 밑이 흙으로 까맣다. 그래도 훤해진 논을 보니 뿌듯하다.' },
      ],
    },
    note: '바로 뿌린 논은 김을 네댓 번 매야 해서 여름 내내 일손이 많이 들었어요.',
    facts: ['F04'],
  },
  {
    // 큰비가 온 해에만 나타난다. 우리 것 먼저냐 마을 것 먼저냐 — 살림과 인심을 주고받는다. 누구도 나를 꾸짖지 않는다.
    id: 's1395-summer-bank',
    situation: S,
    season: 'summer',
    roles: FARMER,
    theme: 'farming',
    spot: 'streamBank',
    shows: { draw: 'drought' },
    cost: 1,
    lure: '큰비에 논둑이 터졌다더라',
    stage: { place: 'stream', cast: [{ who: 'neighbor-elder', at: 'center' }] },
    lines: [
      { text: '큰비에 냇물이 넘쳐 냇가 논둑이 무너졌다. 마을 사람들이 흙을 져 나른다.' },
      { who: 'neighbor-elder', pose: 'worried', text: '물이 논으로 들면 벼가 다 쓸려 간다. 손이 하나라도 더 있어야 해.' },
      { text: '우리 논둑도, 여럿이 쓰는 물길도 터졌다. 어디부터 막을까?' },
    ],
    choices: [
      {
        // 여럿이 쓰는 물길을 두고 우리 것부터 본다: 살림을 얻고 인심을 잃는다(마을 일에 빠진다)
        id: 'ours',
        label: '우리 논둑부터 쌓는다',
        effects: { body: -1, living: 1, trust: -1 },
        lines: [
          { text: '흙을 퍼 날라 우리 논둑을 다시 쌓았다. 벼 몇 포기는 더 건지겠다.' },
          { who: 'neighbor-elder', text: '제 논이 급한 건 누구나 같지. 우리도 서두르마.' },
        ],
      },
      {
        id: 'ditch',
        label: '여럿이 쓰는 물길부터 막는다',
        effects: { body: -1, trust: 1 },
        lines: [
          { text: '여럿이 줄지어 흙을 날라 물길을 막았다. 온몸이 진흙투성이다.' },
          { who: 'neighbor-elder', pose: 'glad', text: '물길이 잡혔으니 온 마을 논이 한숨 돌렸다. 애썼다.' },
        ],
      },
    ],
    note: '1395년 칠월, 큰비로 산이 무너지고 물이 넘친 고을이 있었어요.',
    facts: ['F55'],
  },
];
