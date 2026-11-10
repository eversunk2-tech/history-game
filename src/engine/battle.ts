// 고비 겨루기(spec 8.1·8.2·8.3, 11.1 고칠 것 2·3·4·6·7): 시작(덱·손패·기운·귀띔), 예고(고비의 다음 할 일), 한 차례
// (카드 → 문제 → 맞혔나 → 힘·덧효과·기세 → 고비의 할 일 → 손패 채우기), 단계와 방패(지혜 겨루기·맞힘·덧효과·저절로 깎임),
// 합동 기술, 귀띔, 틀린 문제 다시(두 차례 뒤), 끝(넘김·구해 줌·해거름)과 별·점수의 재료.
// 화면·브라우저·저장·시계를 모른다. 문제의 꼴도 모른다 — 문제 id와 "맞혔나"만 받는다(문제 고르기는 BattleAsk로 넘겨받는다 — quiz.ts의 battleAsk).
// 같은 씨앗·같은 입력이면 같은 판이다(rng.ts의 mulberry32·subSeed). 상태를 고치지 않고 새 상태를 돌려준다.
// 겨루기는 저장하지 않는다(도중에 끄면 그 겨루기의 처음부터 — 5.8). 숫자는 balance.ts의 표만 읽는다.
//
// ── 쓰는 법(㉢) ───────────────────────────────────────────────
//   const ask = battleAsk({ questions, logs, episode, earlier, seed })   // quiz.ts
//   let b = startBattle({ foe, cards, deck, steps, stats, level, body, gear, seed })   → Battle(손패 넷, 예고가 정해져 있다)
//   previewOf(b)                → 고비가 이번 차례에 할 일(예고 — FoeMove, 실제로 깎을 기운)
//   affinityOf(b, cardId)       → 'strong' | 'normal' | 'weak'(손패의 ★ 표시)
//   b = chooseCard(b, cardId, ask)   → b.pending = { kind: 'card', card, q(문제 id — 없으면 null), again }
//   b = useHint(b)              → 귀띔 하나를 쓴다(지울 고를 것은 quiz.hintChoice(문제, hintSeed(b), 지운 것))
//   b = answer(b, right, ask)   → 한 차례가 끝난다(b.events에 일어난 일). 단계가 열리면 b.pending = { kind: 'wisdom', q }가 이어진다
//   canCombo(b) / b = useCombo(b, 'shade' | 'lift', ask)   → 합동 기술(문제 없음, 한 차례를 쓴다)
//   b.end가 있으면 끝 → battleResult(b) = { stars, score, rescued, bodyLoss, … }
// q가 null이면(낼 문제가 없음 — 은행이 빈 때) 화면은 문제 없이 answer(b, false, ask)를 부른다(기본 힘으로 나가고 기세는 그대로).

import { BALANCE } from './balance';
import { battleHp, hintsFor, momentumFull } from './growth';
import { mulberry32, pickWeighted, shuffle, subSeed } from './rng';
import { OFF_TURN, type BattleState, type CardBonus, type CardKind, type Foe, type FoeEffect, type FoeMove, type Gear, type SkillCard } from './types4';

// ── 문제 고르개(퀴즈 엔진이 만든다) ─────────────────────────────────

export interface AskInfo {
  /** 이 겨루기에서 이미 낸 문제(다시 내지 않는다) */
  exclude: readonly string[];
  /** 이 겨루기에서 맞힌 수(쉬움 먼저, 맞힐수록 보통·어려움) */
  right: number;
  /** 지금 차례(1부터) */
  turn: number;
}

export interface BattleAsk {
  /** 카드에 낼 문제 id. 없으면 null */
  card(card: SkillCard, info: AskInfo): string | null;
  /** 지혜 겨루기 문제 n개(핵심 물음) */
  wisdom(n: number, info: Pick<AskInfo, 'exclude'>): string[];
}

/** 문제를 하나도 내지 않는 고르개(문제 은행이 비었을 때, 시험) */
export const NO_ASK: BattleAsk = { card: () => null, wisdom: () => [] };

// ── 꼴 ─────────────────────────────────────────────────────────

export type Affinity = 'strong' | 'normal' | 'weak';
export type ComboKind = 'shade' | 'lift';
export type BattleEnd = NonNullable<BattleState['end']>;

export interface BattleSetup {
  foe: Foe;
  /** 카드의 정의(목록이나 id → 카드) */
  cards: readonly SkillCard[] | Readonly<Record<string, SkillCard>>;
  /** 덱(정해 준 것 + 현장에서 이번 판에 얻은 카드 — 여덟 장을 넘어도 된다). 같은 id는 한 번만 */
  deck: readonly string[];
  /** 카드의 단계(1~3, 없으면 1) */
  steps?: Readonly<Record<string, number>>;
  /** 주인공의 능력치 */
  stats: Record<CardKind, number>;
  level: number;
  /** 그 이야기의 기력(3판 수치 body) */
  body: number;
  /** 장비한 것(손·품) */
  gear?: readonly Gear[];
  seed: number;
  /** 큰 고비인가 작은 고비인가(없으면 단계 1·방패 0이면 작은 고비) */
  kind?: 'boss' | 'minor';
}

/** 예고: 이번 차례에 고비가 할 일과 깎을 기운(차례가 시작될 때 씨앗으로 정해 둔다) */
export interface FoePlan {
  move: string;
  hit: number;
  strong?: CardKind;
  effect?: FoeEffect;
}

export type Pending =
  | { kind: 'card'; card: string; q: string | null; again: boolean; hints: number }
  | { kind: 'wisdom'; q: string; again: false; hints: number };

export type ShieldWhy = 'phase' | 'right' | 'bonus' | 'wisdom' | 'shade' | 'fade' | 'raise';

/** 한 번의 움직임(answer·useCombo)에서 일어난 일 — 화면의 글과 움직임의 재료 */
export type BattleEvent =
  | { t: 'intent'; move: string; hit: number; strong?: CardKind; effect?: FoeEffect }
  | { t: 'card'; card: string; q: string | null; right: boolean; again: boolean; affinity: Affinity; power: number; dealt: number }
  | { t: 'bonus'; bonus: CardBonus }
  | { t: 'shield'; from: number; to: number; why: ShieldWhy }
  | { t: 'momentum'; from: number; to: number }
  | { t: 'heal'; who: 'me' | 'foe'; amount: number }
  | { t: 'phase'; phase: number; shield: number; wisdom: number }
  | { t: 'wisdom'; q: string; right: boolean; left: number }
  | { t: 'combo'; kind: ComboKind; power: number; dealt: number }
  | { t: 'foe'; move: string; planned: number; hit: number; weakened: boolean; effect?: FoeEffect; frozen?: string }
  | { t: 'retry'; q: string; at: number }
  | { t: 'draw'; cards: string[]; reshuffled: boolean }
  | { t: 'end'; end: BattleEnd };

export interface CardPlay {
  card: string;
  affinity: Affinity;
  /** 문제를 맞혔나(문제가 없었으면 null) */
  right: boolean | null;
  power: number;
  dealt: number;
}

/** [더함] 겨루기 엔진의 상태 = types4 BattleState + 엔진이 쓰는 칸(저장하지 않는다) */
export interface Battle extends BattleState {
  kind: 'boss' | 'minor';
  /** 판 내내 같은 것: 고비, 카드, 카드마다 (기본 + 단계의 덧힘 + 그 갈래 능력치 + 장비), 기세가 찰 칸, 차례 한도 */
  ctx: { foe: Foe; cards: Readonly<Record<string, SkillCard>>; base: Readonly<Record<string, number>>; full: number; limit: number };
  /** 이번 차례의 예고(intent = plan.move) */
  plan?: FoePlan;
  /** 내가 건 '약하게'(덧효과 weaken): 이번 차례 고비의 일 × weakenMul */
  weak: boolean;
  /** 고비가 건 'weaken-next': 내 다음 힘 × dullMul */
  dull: boolean;
  /** 방패가 남은 채 지난 차례 수(shieldFadeEvery가 되면 한 칸 깎인다) */
  fade: number;
  /** 고비가 한 일(차례대로) */
  moves: string[];
  /** 'cycle' 고비의 시작 자리(씨앗으로 고른다) */
  cycle: number;
  /** 지금 답을 기다리는 문제 */
  pending?: Pending;
  /** 아직 내지 않은 지혜 겨루기 문제(첫 것이 pending) */
  wisdomLeft: string[];
  /** 낸 카드(별 ③의 "상성이 맞는 카드를 한 번 이상"이 읽는다) */
  plays: CardPlay[];
  /** 마지막 움직임에서 일어난 일 */
  events: BattleEvent[];
}

// ── 시작 ───────────────────────────────────────────────────────

function cardMap(cards: BattleSetup['cards']): Record<string, SkillCard> {
  if (Array.isArray(cards)) return Object.fromEntries((cards as readonly SkillCard[]).map((c) => [c.id, c]));
  return { ...(cards as Record<string, SkillCard>) };
}

/** 카드의 바탕 힘: 기본 + 단계의 덧힘(단계 1은 0, 2는 +2, 3은 +4) + 그 갈래 능력치 + 장비 */
export function cardBase(card: SkillCard, step: number, stats: Record<CardKind, number>, gear: readonly Gear[] = []): number {
  const s = Math.min(BALANCE.stepMax, Math.max(1, Math.floor(step)));
  const bonus = BALANCE.stepBonus[s - 1] ?? 0;
  const tools = gear.reduce(
    (sum, g) => sum + ((g.boost.cards ?? []).includes(card.id) || (g.boost.kinds ?? []).includes(card.kind) ? g.boost.add : 0),
    0,
  );
  return card.base + bonus + (stats[card.kind] ?? 0) + tools;
}

export function startBattle(setup: BattleSetup): Battle {
  const { foe } = setup;
  if (foe.moves.length === 0) throw new Error(`${foe.id}: 할 일이 없는 고비`);
  const cards = cardMap(setup.cards);
  const deck = [...new Set(setup.deck)].filter((id) => cards[id]);
  if (deck.length === 0) throw new Error('덱이 비었다');
  const kind = setup.kind ?? (foe.phases === 1 && foe.shield === 0 ? 'minor' : 'boss');
  const base: Record<string, number> = {};
  for (const id of deck) base[id] = cardBase(cards[id], setup.steps?.[id] ?? 1, setup.stats, setup.gear);
  const seed = setup.seed >>> 0;
  const order = shuffle(mulberry32(subSeed(seed, 'deck')), deck);
  const meMax = battleHp(setup.level, setup.stats.power, setup.body);
  const b: Battle = {
    foe: foe.id,
    seed,
    turn: 0,
    phase: 1,
    foeHp: foe.hp,
    foeMax: foe.hp,
    shield: 0,
    me: meMax,
    meMax,
    momentum: 0,
    hand: order.slice(0, BALANCE.hand),
    pile: order.slice(BALANCE.hand),
    used: [],
    intent: '',
    retry: [],
    hints: hintsFor(setup.stats.wisdom, kind === 'boss'),
    asked: [],
    dealt: 0,
    kind,
    ctx: {
      foe,
      cards,
      base,
      full: momentumFull(setup.stats.heart),
      limit: kind === 'boss' ? BALANCE.turnLimit : BALANCE.turnLimitMinor,
    },
    weak: false,
    dull: false,
    fade: 0,
    moves: [],
    cycle: Math.floor(mulberry32(subSeed(seed, 'foe:cycle'))() * foe.moves.length),
    wisdomLeft: [],
    plays: [],
    events: [],
  };
  const plan = planFor(b);
  return { ...b, plan, intent: plan.move, events: [intentEvent(plan)] };
}

// ── 예고 ───────────────────────────────────────────────────────

/** 다음 차례(b.turn + 1)에 고비가 할 일을 씨앗으로 정한다 */
function planFor(b: Battle): FoePlan {
  const { foe } = b.ctx;
  const n = b.turn + 1;
  let move: FoeMove;
  if (foe.order === 'cycle') {
    move = foe.moves[(b.cycle + b.turn) % foe.moves.length];
  } else {
    const last = b.moves[b.moves.length - 1];
    let run = 0;
    for (let i = b.moves.length - 1; i >= 0 && b.moves[i] === last; i--) run++;
    const others = foe.moves.filter((m) => m.id !== last && m.weight > 0);
    const table = run >= BALANCE.weightedRun && others.length > 0 ? others : foe.moves;
    move = pickWeighted(mulberry32(subSeed(b.seed, `foe:${n}`)), table);
  }
  let hit = 0;
  if (move.hit) {
    const [lo, hi] = move.hit;
    hit = lo + Math.floor(mulberry32(subSeed(b.seed, `hit:${n}`))() * (Math.max(lo, hi) - lo + 1));
  }
  return { move: move.id, hit, strong: move.strong, effect: move.effect };
}

function intentEvent(plan: FoePlan): BattleEvent {
  return { t: 'intent', move: plan.move, hit: plan.hit, strong: plan.strong, effect: plan.effect };
}

/** 예고(화면): 고비의 할 일과 이번 차례에 실제로 깎을 기운('약하게'를 걸었으면 줄어든 값) */
export function previewOf(b: Battle): { move: FoeMove; hit: number; weakened: boolean } | null {
  if (!b.plan || b.end) return null;
  const move = b.ctx.foe.moves.find((m) => m.id === b.plan?.move);
  if (!move) return null;
  return { move, hit: foeHit(b), weakened: b.weak };
}

function foeHit(b: Battle): number {
  if (!b.plan) return 0;
  return b.weak ? Math.round(b.plan.hit * BALANCE.weakenMul) : b.plan.hit;
}

// ── 상성과 힘 ───────────────────────────────────────────────────

/**
 * 상성: 카드의 갈래나 id가 foe.strong에 있거나 이번 차례의 센 갈래(FoeMove.strong)와 같으면 센 것(1.5),
 * foe.weak에 있거나(갈래나 id) foe.weak에 OFF_TURN이 있고 이번 차례에 센 갈래가 따로 있는데 그것과 다르면 약한 것(0.5). 둘 다면 센 것.
 */
export function affinityOf(b: Battle, cardId: string): Affinity {
  const card = b.ctx.cards[cardId];
  if (!card) return 'normal';
  const { foe } = b.ctx;
  const turnStrong = b.plan?.strong;
  if (foe.strong.includes(card.kind) || foe.strong.includes(card.id) || turnStrong === card.kind) return 'strong';
  if (foe.weak.includes(card.kind) || foe.weak.includes(card.id)) return 'weak';
  if (foe.weak.includes(OFF_TURN) && turnStrong !== undefined && turnStrong !== card.kind) return 'weak';
  return 'normal';
}

function affinityMul(a: Affinity): number {
  return a === 'strong' ? BALANCE.strongMul : a === 'weak' ? BALANCE.weakMul : BALANCE.normalMul;
}

/** 이 카드를 지금 내면 나갈 힘(맞히면 right = true) */
export function cardPower(b: Battle, cardId: string, right: boolean): number {
  const raw =
    (b.ctx.base[cardId] ?? 0) *
    affinityMul(affinityOf(b, cardId)) *
    (right ? BALANCE.rightMul : 1) *
    (b.shield > 0 ? BALANCE.shieldMul : 1) *
    (b.dull ? BALANCE.dullMul : 1);
  return Math.max(BALANCE.powerMin, Math.round(raw));
}

// ── 단계 ───────────────────────────────────────────────────────

/** 그 단계의 바닥(이 아래로는 한 번에 내려가지 않는다). 마지막 단계는 0 */
export function phaseFloor(b: Pick<Battle, 'foeMax' | 'ctx'>, phase: number): number {
  const phases = b.ctx.foe.phases;
  return Math.round((b.foeMax * Math.max(0, phases - phase)) / phases);
}

/** 그 단계의 꼭대기(고비가 기운을 채워도 이 위로는 오르지 않는다) */
function phaseTop(b: Pick<Battle, 'foeMax' | 'ctx'>, phase: number): number {
  return phaseFloor(b, phase - 1);
}

interface Work {
  b: Battle;
  events: BattleEvent[];
  /** 이번 차례에 단계가 열렸나(그 차례는 방패가 저절로 깎이는 셈에 넣지 않는다) */
  opened: boolean;
}

function setShield(w: Work, to: number, why: ShieldWhy): void {
  const from = w.b.shield;
  const next = Math.max(0, to);
  if (next === from) return;
  w.b = { ...w.b, shield: next, fade: next === 0 ? 0 : w.b.fade };
  w.events.push({ t: 'shield', from, to: next, why });
}

/** 고비에게 힘을 준다(그 단계의 바닥 아래로는 내려가지 않는다 — 넘친 힘은 버린다). 바닥에 닿으면 다음 단계가 열린다 */
function hitFoe(w: Work, power: number, ask: BattleAsk): number {
  const floor = phaseFloor(w.b, w.b.phase);
  const dealt = Math.max(0, Math.min(power, w.b.foeHp - floor));
  w.b = { ...w.b, foeHp: w.b.foeHp - dealt, dealt: w.b.dealt + dealt };
  if (w.b.foeHp <= floor && w.b.phase < w.b.ctx.foe.phases) openPhase(w, ask);
  return dealt;
}

function openPhase(w: Work, ask: BattleAsk): void {
  const phase = w.b.phase + 1;
  w.b = { ...w.b, phase, fade: 0 };
  w.opened = true;
  setShield(w, w.b.ctx.foe.shield, 'phase');
  const wisdom = w.b.kind === 'boss' ? ask.wisdom(BALANCE.wisdomCount, { exclude: askedIds(w.b) }).slice(0, BALANCE.wisdomCount) : [];
  w.b = { ...w.b, wisdomLeft: wisdom };
  w.events.push({ t: 'phase', phase, shield: w.b.shield, wisdom: wisdom.length });
}

/** 이 겨루기에서 이미 냈거나 낼 차례인 문제 */
function askedIds(b: Battle): string[] {
  const out = new Set(b.asked.map((a) => a.q));
  for (const r of b.retry) out.add(r.q);
  for (const q of b.wisdomLeft) out.add(q);
  if (b.pending?.q) out.add(b.pending.q);
  return [...out];
}

function rightCount(b: Battle): number {
  return b.asked.filter((a) => a.right).length;
}

function setMomentum(w: Work, to: number): void {
  const from = w.b.momentum;
  const next = Math.max(0, Math.min(w.b.ctx.full, to));
  if (next === from) return;
  w.b = { ...w.b, momentum: next };
  w.events.push({ t: 'momentum', from, to: next });
}

function healMe(w: Work, amount: number): void {
  const next = Math.min(w.b.meMax, w.b.me + amount);
  if (next > w.b.me) w.events.push({ t: 'heal', who: 'me', amount: next - w.b.me });
  w.b = { ...w.b, me: next };
}

// ── 한 차례 ─────────────────────────────────────────────────────

function mustPlay(b: Battle): void {
  if (b.end) throw new Error('겨루기가 끝났다');
  if (b.pending) throw new Error('답을 기다리는 문제가 있다');
  if (b.wisdomLeft.length > 0) throw new Error('지혜 겨루기를 먼저 한다');
}

/** 카드를 고른다: 낼 문제를 정해 b.pending에 둔다(두 차례 전에 틀린 문제가 있으면 그것을 먼저 — again) */
export function chooseCard(b: Battle, cardId: string, ask: BattleAsk): Battle {
  mustPlay(b);
  if (!b.hand.includes(cardId)) throw new Error(`손패에 없는 카드: ${cardId}`);
  if (b.frozen === cardId) throw new Error(`얼어서 이번 차례에 낼 수 없는 카드: ${cardId}`);
  const now = b.turn + 1;
  const due = b.retry
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.at <= now)
    .sort((a, c) => a.r.at - c.r.at || a.i - c.i)[0];
  if (due) {
    return {
      ...b,
      retry: b.retry.filter((_, i) => i !== due.i),
      pending: { kind: 'card', card: cardId, q: due.r.q, again: true, hints: 0 },
      events: [],
    };
  }
  const q = ask.card(b.ctx.cards[cardId], { exclude: askedIds(b), right: rightCount(b), turn: now });
  return { ...b, pending: { kind: 'card', card: cardId, q, again: false, hints: 0 }, events: [] };
}

/** 귀띔 하나를 쓴다(답을 기다리는 문제가 있을 때) */
export function useHint(b: Battle): Battle {
  if (!b.pending || !b.pending.q) throw new Error('귀띔을 쓸 문제가 없다');
  if (b.hints <= 0) throw new Error('남은 귀띔이 없다');
  return { ...b, hints: b.hints - 1, pending: { ...b.pending, hints: b.pending.hints + 1 } };
}

/** 귀띔이 지울 고를 것을 고르는 씨앗(quiz.hintChoice에 넘긴다) */
export function hintSeed(b: Battle): number {
  return subSeed(b.seed, `hint:${b.turn}:${b.asked.length}`);
}

/**
 * 지금 답을 기다리는 문제를 틀리면 이 겨루기 안에서 다시 나올 차례가 남았는가(retryAfter 차례 뒤가 차례 한도 안인가).
 * 화면이 "이 문제는 두 차례 뒤에 다시 나와요"를 참일 때만 말하게 한다(작은 고비는 3차례라 둘째 차례부터는 다시 나오지 않는다).
 * 그 전에 고비를 넘기면 나오지 않는다 — 그것은 미리 알 수 없다. 아래 answer·answerWisdom의 at과 같은 셈이다.
 */
export function comesAgain(b: Battle): boolean {
  const p = b.pending;
  if (!p || !p.q) return false;
  const at = p.kind === 'wisdom' ? b.turn + BALANCE.retryAfter : b.turn + 1 + BALANCE.retryAfter;
  return at <= b.ctx.limit;
}

/** 답을 받는다: 카드의 문제면 한 차례가 끝나고, 지혜 겨루기의 문제면 다음 문제로 간다 */
export function answer(b: Battle, right: boolean, ask: BattleAsk): Battle {
  if (b.end) throw new Error('겨루기가 끝났다');
  const p = b.pending;
  if (!p) throw new Error('답을 기다리는 문제가 없다');
  if (p.kind === 'wisdom') return answerWisdom(b, p, right);

  const w: Work = { b: { ...b, pending: undefined }, events: [], opened: false };
  const asked = p.q !== null;
  const got = asked && right;
  const affinity = affinityOf(b, p.card);
  const power = cardPower(b, p.card, got);
  const shieldBefore = b.shield;
  if (asked && p.q) {
    w.b = { ...w.b, asked: [...w.b.asked, { q: p.q, right, again: p.again, card: p.card, strong: affinity === 'strong' }] };
    if (!right) {
      const at = b.turn + 1 + BALANCE.retryAfter;
      w.b = { ...w.b, retry: [...w.b.retry, { q: p.q, at }] };
      w.events.push({ t: 'retry', q: p.q, at });
    }
  }
  // 낸 카드는 쓴 더미로
  const at = w.b.hand.indexOf(p.card);
  w.b = { ...w.b, hand: w.b.hand.filter((_, i) => i !== at), used: [...w.b.used, p.card], dull: false };
  const cardEvent = { t: 'card' as const, card: p.card, q: p.q, right: got, again: p.again, affinity, power, dealt: 0 };
  w.events.push(cardEvent);
  cardEvent.dealt = hitFoe(w, power, ask);
  w.b = { ...w.b, plays: [...w.b.plays, { card: p.card, affinity, right: asked ? right : null, power, dealt: cardEvent.dealt }] };

  // 덧효과와 방패(맞혔을 때만). 이번 차례에 열린 방패에는 걸지 않는다(그 방패는 지혜 겨루기가 먼저 깎는다)
  if (got) {
    const bonus = b.ctx.cards[p.card]?.bonus;
    if (shieldBefore > 0 && w.b.shield > 0 && !w.opened) setShield(w, w.b.shield - 1, 'right');
    if (bonus) {
      w.events.push({ t: 'bonus', bonus });
      if (bonus === 'shield' && shieldBefore > 0 && !w.opened) setShield(w, w.b.shield - 1, 'bonus');
      if (bonus === 'heal') healMe(w, BALANCE.bonusHeal);
      if (bonus === 'weaken') w.b = { ...w.b, weak: true };
    }
    setMomentum(w, w.b.momentum + 1 + (bonus === 'momentum' ? 1 : 0));
  } else if (asked) {
    setMomentum(w, w.b.momentum - 1);
  }
  return endTurn(w);
}

function answerWisdom(b: Battle, p: Extract<Pending, { kind: 'wisdom' }>, right: boolean): Battle {
  const w: Work = { b: { ...b, pending: undefined }, events: [], opened: false };
  w.b = { ...w.b, asked: [...w.b.asked, { q: p.q, right, again: false, strong: false }], wisdomLeft: w.b.wisdomLeft.slice(1) };
  if (right) {
    if (w.b.shield > 0) setShield(w, w.b.shield - 1, 'wisdom');
  } else {
    const at = b.turn + BALANCE.retryAfter;
    w.b = { ...w.b, retry: [...w.b.retry, { q: p.q, at }] };
    w.events.push({ t: 'retry', q: p.q, at });
  }
  w.events.unshift({ t: 'wisdom', q: p.q, right, left: w.b.wisdomLeft.length });
  const next = w.b.wisdomLeft[0];
  return { ...w.b, pending: next ? { kind: 'wisdom', q: next, again: false, hints: 0 } : undefined, events: w.events };
}

/** 합동 기술을 쓸 수 있나(기세가 찼고 답을 기다리는 문제가 없을 때) */
export function canCombo(b: Battle): boolean {
  return !b.end && !b.pending && b.wisdomLeft.length === 0 && b.momentum >= b.ctx.full;
}

/** 합동 기술: 「느티나무 그늘」(기운 회복 + 방패 한 칸 깎기) · 「함께 들기」(큰 힘, 문제 없음). 한 차례를 쓴다. 쓰면 기세 0 */
export function useCombo(b: Battle, kind: ComboKind, ask: BattleAsk): Battle {
  mustPlay(b);
  if (!canCombo(b)) throw new Error('기세가 차지 않았다');
  const w: Work = { b: { ...b }, events: [], opened: false };
  const event = { t: 'combo' as const, kind, power: 0, dealt: 0 };
  w.events.push(event);
  if (kind === 'shade') {
    healMe(w, BALANCE.shadeHeal);
    if (w.b.shield > 0) setShield(w, w.b.shield - BALANCE.shadeShield, 'shade');
  } else {
    const raw = BALANCE.liftPower * (w.b.shield > 0 ? BALANCE.shieldMul : 1) * (w.b.dull ? BALANCE.dullMul : 1);
    event.power = Math.max(BALANCE.powerMin, Math.round(raw));
    w.b = { ...w.b, dull: false };
    event.dealt = hitFoe(w, event.power, ask);
  }
  setMomentum(w, 0);
  return endTurn(w);
}

/** 차례의 끝: 넘겼나 → 고비의 할 일(예고 그대로) → 구해 줌 → 차례 수 → 방패가 저절로 깎임 → 해거름 → 손패 채우기 → 다음 예고 */
function endTurn(w: Work): Battle {
  // 지난 차례에 언 카드는 이번 차례로 풀린다
  w.b = { ...w.b, frozen: undefined };
  if (w.b.foeHp <= 0 && w.b.phase >= w.b.ctx.foe.phases) return finish(w, 'win');

  // 고비의 할 일 — 예고한 그대로('약하게'로 줄어든 만큼만 다르다)
  const plan = w.b.plan;
  if (plan) {
    const hit = foeHit(w.b);
    const foeEvent: Extract<BattleEvent, { t: 'foe' }> = { t: 'foe', move: plan.move, planned: plan.hit, hit, weakened: w.b.weak, effect: plan.effect };
    w.events.push(foeEvent);
    w.b = { ...w.b, me: Math.max(0, w.b.me - hit), weak: false, moves: [...w.b.moves, plan.move] };
    switch (plan.effect) {
      case 'steal-momentum':
        setMomentum(w, w.b.momentum - BALANCE.stealMomentum);
        break;
      case 'raise-shield':
        if (w.b.phase >= 2) setShield(w, Math.min(w.b.ctx.foe.shield, w.b.shield + BALANCE.foeRaiseShield), 'raise');
        break;
      case 'heal': {
        const top = phaseTop(w.b, w.b.phase);
        const next = Math.min(top, w.b.foeHp + BALANCE.foeHeal);
        if (next > w.b.foeHp) w.events.push({ t: 'heal', who: 'foe', amount: next - w.b.foeHp });
        w.b = { ...w.b, foeHp: next };
        break;
      }
      case 'weaken-next':
        w.b = { ...w.b, dull: true };
        break;
      case 'freeze-card':
        if (w.b.hand.length >= 2) {
          const pick = w.b.hand[Math.floor(mulberry32(subSeed(w.b.seed, `freeze:${w.b.turn + 1}`))() * w.b.hand.length)];
          w.b = { ...w.b, frozen: pick };
          foeEvent.frozen = pick;
        }
        break;
      default:
        break;
    }
    if (w.b.me <= 0) return finish(w, 'rescue');
  }

  w.b = { ...w.b, turn: w.b.turn + 1 };
  // 방패가 남아 있으면 세 차례마다 한 칸이 저절로 깎인다(단계가 열린 차례는 세지 않는다)
  if (w.b.shield > 0 && !w.opened) {
    const fade = w.b.fade + 1;
    if (fade >= BALANCE.shieldFadeEvery) {
      w.b = { ...w.b, fade: 0 };
      setShield(w, w.b.shield - 1, 'fade');
    } else {
      w.b = { ...w.b, fade };
    }
  } else if (w.b.shield === 0) {
    w.b = { ...w.b, fade: 0 };
  }
  if (w.b.turn >= w.b.ctx.limit) return finish(w, 'dusk', true);

  // 손패 채우기(더미가 비면 쓴 것을 씨앗으로 다시 섞는다)
  let { hand, pile, used } = w.b;
  const drawn: string[] = [];
  let reshuffled = false;
  while (hand.length < BALANCE.hand) {
    if (pile.length === 0) {
      if (used.length === 0) break;
      pile = shuffle(mulberry32(subSeed(w.b.seed, `reshuffle:${w.b.turn}`)), used);
      used = [];
      reshuffled = true;
    }
    drawn.push(pile[0]);
    hand = [...hand, pile[0]];
    pile = pile.slice(1);
  }
  if (w.b.frozen && hand.length < 2) w.b = { ...w.b, frozen: undefined };
  w.b = { ...w.b, hand, pile, used };
  if (drawn.length > 0) w.events.push({ t: 'draw', cards: drawn, reshuffled });

  const next = planFor(w.b);
  w.b = { ...w.b, plan: next, intent: next.move };
  w.events.push(intentEvent(next));
  const wisdom = w.b.wisdomLeft[0];
  return { ...w.b, pending: wisdom ? { kind: 'wisdom', q: wisdom, again: false, hints: 0 } : undefined, events: w.events };
}

/** 끝: 넘김·구해 줌은 그 차례 도중에 끝나므로 그 차례를 센다(counted = 이미 센 해거름) */
function finish(w: Work, end: BattleEnd, counted = false): Battle {
  w.events.push({ t: 'end', end });
  const turn = counted ? w.b.turn : w.b.turn + 1;
  return { ...w.b, end, turn, pending: undefined, wisdomLeft: [], plan: undefined, events: w.events };
}

// ── 끝 ─────────────────────────────────────────────────────────

export interface BattleResult {
  end: BattleEnd;
  /** ① 넘김(구해 줌·해거름도) ② 구해 줌·해거름 없이 기운을 반 넘게 남김 ③ 낸 문제(다시 나온 것은 처음 것만)의 3분의 2 이상 + 상성이 맞는 카드를 한 번 이상 */
  stars: [boolean, boolean, boolean];
  /** 고비에게 준 힘 + 맞힌 문제 × 10 + 남은 기운 × 2 + 별 × 50 */
  score: number;
  /** 별 ③을 셀 때의 낸 문제(처음 것만)와 맞힌 수 */
  asked: number;
  right: number;
  /** 맞힌 문제(같은 문제는 한 번) — 점수 재료 */
  rightQuestions: number;
  strongUsed: boolean;
  /** 구해 줌·해거름(함께 마무리) */
  rescued: boolean;
  /** 그 이야기의 기력이 줄 만큼 */
  bodyLoss: number;
  me: number;
  dealt: number;
  turns: number;
}

/** 끝난 겨루기의 별·점수 재료. 아직 끝나지 않았으면 null */
export function battleResult(b: Battle): BattleResult | null {
  if (!b.end) return null;
  const first = b.asked.filter((a) => !a.again);
  const right = first.filter((a) => a.right).length;
  const strongUsed = b.plays.some((p) => p.affinity === 'strong');
  const rescued = b.end !== 'win';
  const stars: [boolean, boolean, boolean] = [
    true,
    !rescued && b.me > b.meMax * BALANCE.starKeep,
    first.length > 0 && right >= first.length * BALANCE.starRight * (1 - 2 * Number.EPSILON) && strongUsed,
  ];
  const rightQuestions = new Set(b.asked.filter((a) => a.right).map((a) => a.q)).size;
  const score =
    b.dealt + rightQuestions * BALANCE.scorePerRight + b.me * BALANCE.scorePerHp + stars.filter(Boolean).length * BALANCE.scorePerStar;
  return {
    end: b.end,
    stars,
    score,
    asked: first.length,
    right,
    rightQuestions,
    strongUsed,
    rescued,
    bodyLoss: rescued ? BALANCE.rescueBody : 0,
    me: b.me,
    dealt: b.dealt,
    turns: b.turn,
  };
}
