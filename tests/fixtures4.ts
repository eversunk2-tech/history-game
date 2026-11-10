// 4판 엔진 시험의 자료와 도구(4-1 ㉡): ①-1의 고비 둘·카드 열·호미의 숫자(S 갈래와 맞춘 것 — spec 11.1 다·8.3, 지침 "①-1의 숫자"),
// 가짜 문제(이야기 20 · 서당 80 둘), 가짜 에피소드, 뒤 에피소드의 어림으로 만든 가짜 고비, 레벨마다 능력치를 고루 둔 주인공,
// 그리고 겨루기를 끝까지 모는 도구(autoBattle — 걸음마다 "예고 = 한 일"을 함께 본다).
// 내용 파일(src/content/foes.ts·skills.ts·gear.ts)이 아직 없어도 엔진 시험이 돌게 여기 따로 둔다. 그 파일이 생기면 숫자가 같은지 견준다.

import { BALANCE } from '../src/engine/balance';
import {
  affinityOf,
  answer,
  canCombo,
  chooseCard,
  startBattle,
  useCombo,
  type Battle,
  type BattleAsk,
  type BattleSetup,
} from '../src/engine/battle';
import { newHero } from '../src/engine/growth';
import { mulberry32, subSeed } from '../src/engine/rng';
import type { CardKind, Episode, Foe, FoeMove, Gear, Question, SkillCard } from '../src/engine/types4';
import type { Line } from '../src/engine/types';

const say = (text: string): Line[] => [{ text }];

// ── 고비 둘(①-1) ───────────────────────────────────────────────

export const hardsoil: Foe = {
  id: 's1395-hardsoil',
  name: '굳은 논흙',
  kind: 'life',
  hp: 24,
  phases: 1,
  shield: 0,
  strong: ['craft', 'power'],
  weak: [],
  order: 'weighted',
  moves: [
    { id: 'crust', line: '흙이 단단히 굳는다', icon: 'clod', hit: [2, 3], weight: 2 },
    { id: 'clod', line: '흙덩이가 호미에 엉긴다', icon: 'clod', hit: [2, 3], effect: 'weaken-next', weight: 1 },
  ],
  opening: say('논흙이 굳었다.'),
  win: say('흙이 풀렸다.'),
  rescue: say('아버지가 함께 갈았다.'),
  dusk: say('해가 저문다. 함께 마무리하자.'),
  phaseOpen: [],
  wisdom: [],
  fade: '',
  picture: 'foe/s1395/hardsoil',
  facts: ['F04'],
};

export const dokkaebi: Foe = {
  id: 's1395-dokkaebi-bet',
  name: '도깨비의 내기',
  kind: 'tale',
  hp: 90,
  phases: 2,
  shield: 3,
  strong: [],
  weak: ['off-turn'],
  order: 'cycle',
  moves: [
    { id: 'riddle', line: '다음은 수수께끼다!', icon: 'riddle', strong: 'wisdom', hit: [4, 6], effect: 'steal-momentum', weight: 1 },
    { id: 'ssireum', line: '다음은 씨름이다!', icon: 'ssireum', strong: 'power', hit: [5, 7], weight: 1 },
    { id: 'work', line: '다음은 일 겨루기다!', icon: 'work', strong: 'craft', hit: [4, 6], weight: 1 },
  ],
  opening: say('옛이야기야.'),
  win: say('도깨비가 웃으며 물러난다.'),
  rescue: say('이웃이 함께 왔다.'),
  dusk: say('해가 저문다. 함께 마무리하자.'),
  phaseOpen: say('도깨비가 버틴다.'),
  wisdom: say('지혜 겨루기다.'),
  fade: '도깨비가 지친다.',
  picture: 'char/s1395/dokkaebi',
  facts: ['F71'],
  tale: true,
};

export const foes41 = [hardsoil, dokkaebi];

// ── 카드 열(모두 base 8) ─────────────────────────────────────────

function card(id: string, kind: CardKind, bonus: SkillCard['bonus'], topic: string): SkillCard {
  return {
    id,
    name: id,
    branch: '농사',
    kind,
    base: 8,
    bonus,
    tags: ['ep:s1395-1', `topic:${topic}`],
    eras: ['s1395'],
    text: '시험 카드',
    facts: ['F04'],
  };
}

export const starter = ['skill-bund', 'skill-carry', 'skill-reckon', 'skill-tithe', 'skill-soil', 'skill-call'];
export const fieldCards = ['skill-help', 'skill-provision', 'skill-sow', 'skill-wood'];

export const cards41: SkillCard[] = [
  card('skill-bund', 'power', 'shield', 'soc5-2-1'),
  card('skill-carry', 'power', 'weaken', 'soc5-2-1'),
  card('skill-reckon', 'wisdom', 'momentum', 'soc5-2-1'),
  card('skill-tithe', 'wisdom', 'shield', 'soc5-2-2'),
  card('skill-soil', 'craft', 'weaken', 'soc5-2-1'),
  card('skill-call', 'heart', 'heal', 'soc5-2-2'),
  card('skill-help', 'heart', 'momentum', 'soc5-2-2'),
  card('skill-provision', 'heart', 'heal', 'soc5-2-2'),
  card('skill-sow', 'craft', 'shield', 'soc5-2-1'),
  card('skill-wood', 'power', 'heal', 'soc5-2-1'),
];

export const cardById: Record<string, SkillCard> = Object.fromEntries(cards41.map((c) => [c.id, c]));

export const hoe: Gear = {
  id: 'gear-hoe',
  name: '호미',
  slot: 'hand',
  boost: { cards: ['skill-soil'], add: 2 },
  eras: ['s1395'],
  lock: '',
  price: { rice: 2, cloth: 0, coin: 0 },
  text: '시험 호미',
  facts: ['F80'],
};

// ── 가짜 문제 ──────────────────────────────────────────────────

export function makeQuestion(id: string, topic: string, level: 1 | 2 | 3, extra: Partial<Question> = {}): Question {
  return {
    id,
    grade: 5,
    subject: 'social',
    topic,
    standard: '[6사05-01]',
    form: 'pick',
    ask: `물음 ${id}`,
    choices: ['가', '나', '다', '라'],
    answer: 0,
    explain: '풀이예요.',
    level,
    facts: ['F04'],
    by: 'claude',
    ver: 1,
    ...extra,
  };
}

/** 어려움 칸을 [쉬움, 보통, 어려움] 수로 나눠 차례대로 붙인다 */
function levels(mix: [number, number, number]): (1 | 2 | 3)[] {
  return [...Array(mix[0]).fill(1), ...Array(mix[1]).fill(2), ...Array(mix[2]).fill(3)];
}

/** 이야기 문제 20(쉬움 6·보통 10·어려움 4), 앞 일곱이 핵심 물음('core') */
export const storyQuestions: Question[] = levels([6, 10, 4]).map((level, i) => {
  const n = String(i + 1).padStart(3, '0');
  return makeQuestion(`ep-s1395-1-${n}`, 'ep-s1395-1', level, {
    tags: i < 7 ? ['ep:s1395-1', 'core'] : ['ep:s1395-1'],
    form: i % 5 === 4 ? 'ox' : 'pick',
    ...(i % 5 === 4 ? { choices: undefined, answer: 0 } : {}),
  });
});

/** 서당 주제 하나(80 — 쉬움 24·보통 40·어려움 16). 차례는 섞어 둔다(어려움이 뭉치지 않게) */
export function bankTopic(topic: string, count = 80, mix: [number, number, number] = [24, 40, 16]): Question[] {
  const ls = levels(mix);
  const rng = mulberry32(subSeed(7, topic));
  for (let i = ls.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ls[i], ls[j]] = [ls[j], ls[i]];
  }
  return ls.slice(0, count).map((level, i) => makeQuestion(`${topic}-${String(i + 1).padStart(4, '0')}`, topic, level));
}

export const bank21 = bankTopic('soc5-2-1');
export const bank22 = bankTopic('soc5-2-2');
export const allQuestions: Question[] = [...storyQuestions, ...bank21, ...bank22];

// ── 가짜 에피소드(①-1과 같은 짜임) ───────────────────────────────

export const episode41: Episode = {
  id: 's1395-1',
  story: 's1395',
  order: 1,
  title: '새 도읍의 봄',
  when: '1395년 이월~삼월',
  season: 'spring',
  goal: '돌아온 이웃을 맞고 봄 일을 시작하자',
  level: 1,
  lessons: '2단원 2~3차시',
  themes: ['duty', 'farming'],
  missions: ['s1395-m-return', 's1395-m-sow'],
  extras: ['s1395-spring-well', 's1395-spring-temple', 's1395-spring-tale', 's1395-spring-woods'],
  suns: 2,
  minors: [
    { id: 's1395-1-hardsoil', kind: 'battle', foe: 's1395-hardsoil', at: 's1395-spring-sow', before: 'play' },
    { id: 's1395-1-sowing', kind: 'play', at: 's1395-spring-sow' },
  ],
  boss: 's1395-dokkaebi-bet',
  starter,
  skills: [
    { at: 's1395-spring-return-help', card: 'skill-help' },
    { at: 's1395-spring-return-monks', card: 'skill-provision' },
    { at: 's1395-spring-sow', card: 'skill-sow' },
    { at: 's1395-spring-woods', card: 'skill-wood' },
  ],
  storyTopic: 'ep-s1395-1',
  topics: ['soc5-2-1', 'soc5-2-2'],
  core: storyQuestions.slice(0, 7).map((q) => q.id),
  rewards: { cards: [], relics: ['relic-seed-sack'], purse: { rice: 6, cloth: 3, coin: 0 } },
  ask: '',
};

// ── 주인공 ────────────────────────────────────────────────────

/** 그 레벨의 주인공: 레벨마다 받은 점을 힘 → 지혜 → 솜씨 → 어울림 차례로 고루 둔다(15까지) */
export function evenStats(level: number): Record<CardKind, number> {
  const stats: Record<CardKind, number> = { power: 3, wisdom: 3, craft: 3, heart: 3 };
  const kinds: CardKind[] = ['power', 'wisdom', 'craft', 'heart'];
  for (let i = 0; i < level - 1; i++) {
    const k = kinds[i % 4];
    if (stats[k] < BALANCE.statMax) stats[k] += 1;
  }
  return stats;
}

export interface SetupOver {
  level?: number;
  body?: number;
  stats?: Record<CardKind, number>;
  deck?: string[];
  gear?: Gear[];
  seed?: number;
  steps?: Record<string, number>;
}

export function bossSetup(foe: Foe, over: SetupOver = {}): BattleSetup {
  const level = over.level ?? 1;
  return {
    foe,
    cards: cards41,
    deck: over.deck ?? starter,
    stats: over.stats ?? evenStats(level),
    level,
    body: over.body ?? 6,
    gear: over.gear ?? [],
    seed: over.seed ?? 1,
    steps: over.steps,
  };
}

// ── 뒤 에피소드의 어림(8.1)으로 만든 가짜 고비 ─────────────────────────

/**
 * 고비 기운 80 + 권장 레벨 × 15(정점 1.4배), 깎는 기운 4 + 권장 레벨 × 0.8(±1). 할 일에 덧효과를 고루 넣는다(막다른 판이 없는지 보려고).
 * 정점이면 세 단계.
 */
export function fakeBoss(level: number, peak = false, order: Foe['order'] = 'weighted'): Foe {
  const hp = Math.round((BALANCE.bossHpBase + level * BALANCE.bossHpPerLevel) * (peak ? BALANCE.peakMul : 1));
  const hit = Math.round(BALANCE.bossHitBase + level * BALANCE.bossHitPerLevel);
  const range: [number, number] = [Math.max(1, hit - 1), hit + 1];
  const moves: FoeMove[] = [
    { id: 'flood', line: '물이 분다', icon: 'water', strong: 'power', hit: range, weight: 2 },
    { id: 'wind', line: '바람이 분다', icon: 'wind', strong: 'craft', hit: range, effect: 'weaken-next', weight: 1 },
    { id: 'wall', line: '둑을 높인다', icon: 'wall', hit: range, effect: 'raise-shield', weight: 1 },
    { id: 'grow', line: '다시 차오른다', icon: 'grow', hit: range, effect: 'heal', weight: 1 },
    { id: 'cold', line: '손이 언다', icon: 'cold', hit: range, effect: 'freeze-card', weight: 1 },
    { id: 'laugh', line: '웃음보가 터진다', icon: 'laugh', strong: 'wisdom', hit: range, effect: 'steal-momentum', weight: 1 },
  ];
  return {
    ...dokkaebi,
    id: `fake-${level}${peak ? '-peak' : ''}`,
    hp,
    phases: peak ? 3 : 2,
    shield: 3,
    strong: ['heart'],
    weak: [],
    order,
    moves,
    tale: undefined,
    kind: 'life',
  };
}

// ── 겨루기를 끝까지 모는 도구 ─────────────────────────────────────

export type CardOrder = 'first' | 'strong' | 'weak' | 'random';

export interface AutoPolicy {
  order: CardOrder;
  /** 카드 문제를 맞힐 몫(0~1) — 씨앗 있는 난수로 */
  rightRate: number;
  /** 지혜 겨루기를 맞힐 몫(없으면 rightRate) */
  wisdomRate?: number;
  /** 기세가 차면: 'lift' · 'shade' · 'none'(쓰지 않음) · 'mix'(기운이 반 밑이면 그늘, 아니면 들기) */
  combo?: 'lift' | 'shade' | 'none' | 'mix';
  seed?: number;
}

export interface AutoRun {
  battle: Battle;
  /** 움직임 수(카드·합동 기술·지혜 겨루기 답) */
  actions: number;
  /** 예고와 한 일이 어긋난 곳(없어야 한다) */
  mismatches: string[];
  /** 차례마다의 예고(차례 번호 → 할 일) */
  intents: string[];
}

const RANK: Record<string, number> = { strong: 0, normal: 1, weak: 2 };

function pickCard(b: Battle, order: CardOrder, rng: () => number): string {
  const hand = b.hand.filter((c) => c !== b.frozen);
  if (hand.length === 0) throw new Error(`낼 카드가 없다: 손패 [${b.hand.join(', ')}], 언 카드 ${b.frozen}`);
  if (order === 'first') return hand[0];
  if (order === 'random') return hand[Math.floor(rng() * hand.length)];
  const sorted = hand.slice().sort((a, c) => (RANK[affinityOf(b, a)] - RANK[affinityOf(b, c)]) * (order === 'strong' ? 1 : -1));
  return sorted[0];
}

/** 겨루기를 끝까지 한다. 걸음마다 고비가 한 일이 그 차례의 예고와 같은지 본다 */
export function autoBattle(setup: BattleSetup, ask: BattleAsk, policy: AutoPolicy): AutoRun {
  const rng = mulberry32(subSeed(policy.seed ?? setup.seed, `auto:${policy.order}:${policy.rightRate}`));
  let b = startBattle(setup);
  const mismatches: string[] = [];
  const intents: string[] = [b.intent];
  let actions = 0;
  for (; !b.end; actions++) {
    if (actions > 400) throw new Error('겨루기가 끝나지 않는다');
    if (b.pending?.kind === 'wisdom') {
      b = answer(b, rng() < (policy.wisdomRate ?? policy.rightRate), ask);
      continue;
    }
    const plan = b.plan;
    const turn = b.turn;
    const meBefore = b.me;
    const combo = policy.combo ?? 'mix';
    let expectWeak = false;
    if (combo !== 'none' && canCombo(b)) {
      const kind = combo === 'mix' ? (b.me < b.meMax / 2 ? 'shade' : 'lift') : combo;
      b = useCombo(b, kind, ask);
    } else {
      const id = pickCard(b, policy.order, rng);
      b = chooseCard(b, id, ask);
      const right = rng() < policy.rightRate;
      const got = right && b.pending?.kind === 'card' && b.pending.q !== null;
      expectWeak = got && setupCard(setup, id)?.bonus === 'weaken';
      b = answer(b, right, ask);
    }
    const foe = b.events.find((e) => e.t === 'foe');
    if (plan && foe && foe.t === 'foe') {
      const want = expectWeak ? Math.round(plan.hit * BALANCE.weakenMul) : plan.hit;
      if (foe.move !== plan.move || foe.planned !== plan.hit || foe.hit !== want || foe.weakened !== expectWeak || foe.effect !== plan.effect) {
        mismatches.push(`차례 ${turn + 1}: 예고 ${plan.move}/${plan.hit} → 한 일 ${foe.move}/${foe.hit}(약하게 ${foe.weakened})`);
      }
      // 깎인 기운도 예고 그대로(이번 움직임에서 채운 기운을 더하고 고비가 깎은 만큼을 뺀다)
      const healed = b.events.reduce((sum, e) => sum + (e.t === 'heal' && e.who === 'me' ? e.amount : 0), 0);
      if (b.me !== Math.max(0, meBefore + healed - foe.hit)) mismatches.push(`차례 ${turn + 1}: 기운 ${meBefore} + ${healed} − ${foe.hit} ≠ ${b.me}`);
    } else if (plan && !foe && b.end !== 'win') {
      mismatches.push(`차례 ${turn + 1}: 예고 ${plan.move}가 있었는데 고비가 아무것도 하지 않았다(끝 ${b.end})`);
    }
    if (!b.end) intents.push(b.intent);
  }
  return { battle: b, actions, mismatches, intents };
}

function setupCard(setup: BattleSetup, id: string): SkillCard | undefined {
  return Array.isArray(setup.cards) ? (setup.cards as SkillCard[]).find((c) => c.id === id) : (setup.cards as Record<string, SkillCard>)[id];
}

export { newHero };
