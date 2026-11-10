// 성장의 셈(spec 5.5·5.6, 11.1 다의 "숫자의 첫 어림"): 레벨과 경험치, 레벨 상한과 쌓아 둔 경험치, 능력치 점,
// 겨루기의 기운·귀띔·기세 칸, 에피소드와 서당의 경험치와 되풀이 막기(하루·같은 주제·다시 하기 세 판).
// 화면·브라우저·저장·시계를 모른다. 날짜는 받아서 쓴다('2026-11-07' 꼴 — Save5.today.date). 숫자는 balance.ts의 표만 읽는다.
// 상태를 고치지 않고 새 값을 돌려준다.
//
// ── 쓰는 법(㉢·㉣) ─────────────────────────────────────────────
//   newHero(look)                                  → 새 주인공(레벨 1, 능력치 3·3·3·3)
//   xpToNext(level) / xpTotalAt(level)             → 다음 레벨까지 드는 경험치 / 그 레벨에 닿기까지 모인 경험치
//   addXp(hero, amount, cap)                       → { hero, levels, banked } 경험치를 더해 레벨을 올린다(상한에 걸린 몫은 hero.banked에 쌓는다)
//   raiseCap(hero, cap)                            → { hero, levels, banked } 상한이 오르면 쌓아 둔 경험치를 넣는다
//   capFor(openStories) / LEVEL_CAP_41             → 열린 이야기로 정하는 레벨 상한(4-3부터) / 4-1의 상한 5
//   placePoint(hero, kind)                         → 능력치 점 하나를 둔다(점이 없거나 15면 던진다)
//   battleHp(level, power, body)                   → 겨루기의 기운(20 + 힘×3 + 레벨×2 − (5 − 기력)⁺×3)
//   hintsFor(wisdom, boss) / momentumFull(heart)   → 귀띔 수 / 합동 기술에 드는 기세 칸
//   episodeXp({…})                                 → { xp, parts } 에피소드 한 판의 경험치(처음 깸·다시 하기·하루 세 판)
//   seodangXp({…})                                 → { xp, today } 서당 한 판의 경험치(문제마다·끝까지·같은 주제·하루 300)
//   rollDay(today, date) / emptyToday(date)        → 날이 바뀌었으면 오늘의 셈을 비운다 / 빈 오늘의 셈
//   xpEver(hero) / storyMul(story)                 → 모인 경험치(레벨 + 막대 + 쌓아 둔 것) / 이야기 배수
//   xpOfAction(action)                             → 꾸미기·가게·걷기·사진관·우리 집 꾸미기의 경험치(늘 0 — 5.6의 1번)

import { BALANCE } from './balance';
import type { Look } from './types';
import type { CardKind, Hero, Question, QuizLog, Save5 } from './types4';

// ── 레벨과 경험치 ───────────────────────────────────────────────

/** 레벨 L에서 L+1로 가는 데 드는 경험치(100 + 15 × L) */
export function xpToNext(level: number): number {
  return BALANCE.levelBase + BALANCE.levelStep * level;
}

/** 레벨 1에서 그 레벨에 닿기까지 모인 경험치(레벨 5는 550, 30은 9,425 — 5.5의 표) */
export function xpTotalAt(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

/** 모인 경험치(레벨 + 지금 막대 + 쌓아 둔 것) — 시험과 흉내 판이 쓴다 */
export function xpEver(hero: Pick<Hero, 'level' | 'xp' | 'banked'>): number {
  return xpTotalAt(hero.level) + hero.xp + hero.banked;
}

/** 4-1(첫 조각)의 레벨 상한(5.6의 4번) */
export const LEVEL_CAP_41 = BALANCE.levelCap41;

/** 4-3부터의 레벨 상한: 열린 이야기 가운데 가장 뒤 이야기의 권장 레벨 끝 + 2(30까지). 모르는 이야기는 건너뛴다 */
export function capFor(openStories: readonly string[]): number {
  let cap = 1;
  for (const story of openStories) {
    const range = BALANCE.storyLevels[story];
    if (range) cap = Math.max(cap, range[1] + BALANCE.capOver);
  }
  return Math.min(BALANCE.levelMax, cap);
}

export function newHero(look: Look): Hero {
  const s = BALANCE.statStart;
  return {
    look,
    level: 1,
    xp: 0,
    banked: 0,
    stats: { power: s, wisdom: s, craft: s, heart: s },
    points: 0,
    outfit: {},
    titles: [],
    cards: {},
    deck: [],
    gear: {},
  };
}

export interface XpGain {
  hero: Hero;
  /** 이번에 오른 레벨 수(그만큼 능력치 점이 생겼다) */
  levels: number;
  /** 이번에 상한에 걸려 쌓아 둔 경험치 */
  banked: number;
}

/**
 * 경험치를 더한다. 레벨이 오를 때마다 능력치 점 하나. 상한(cap)에 닿으면 넘는 것은 모두 쌓아 둔다(잃지 않는다 — 5.6의 4번).
 * 상한의 레벨에서는 막대(xp)가 0이고 더하는 것은 모두 banked로 간다.
 */
export function addXp(hero: Hero, amount: number, cap: number): XpGain {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`경험치는 0 이상이어야 한다: ${amount}`);
  const top = Math.min(BALANCE.levelMax, Math.max(1, Math.floor(cap)));
  let level = hero.level;
  let xp = hero.xp + Math.floor(amount);
  let levels = 0;
  while (level < top && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    levels += 1;
  }
  let banked = 0;
  if (level >= top) {
    banked = xp;
    xp = 0;
  }
  return {
    hero: { ...hero, level, xp, banked: hero.banked + banked, points: hero.points + levels * BALANCE.pointsPerLevel },
    levels,
    banked,
  };
}

/** 상한이 오르면(다음 이야기가 열리면) 쌓아 둔 경험치를 넣는다 */
export function raiseCap(hero: Hero, cap: number): XpGain {
  const gain = addXp({ ...hero, banked: 0 }, hero.banked, cap);
  return { ...gain, banked: gain.hero.banked };
}

/** 능력치 점 하나를 둔다(하나에 15까지) */
export function placePoint(hero: Hero, kind: CardKind): Hero {
  if (hero.points <= 0) throw new Error('둘 능력치 점이 없다');
  if (hero.stats[kind] >= BALANCE.statMax) throw new Error(`${kind}은(는) 이미 ${BALANCE.statMax}이다`);
  return { ...hero, points: hero.points - 1, stats: { ...hero.stats, [kind]: hero.stats[kind] + 1 } };
}

// ── 겨루기의 몸 ──────────────────────────────────────────────────

/** 겨루기의 기운: 20 + 힘 × 3 + 레벨 × 2 − (5 − 기력)⁺ × 3, 아무리 지쳐도 hpFloor(레벨 1·힘 3·기력 5 이상 → 31) */
export function battleHp(level: number, power: number, body: number): number {
  const tired = Math.max(0, BALANCE.hpTiredBelow - body) * BALANCE.hpTiredPer;
  return Math.max(BALANCE.hpFloor, BALANCE.hpBase + power * BALANCE.hpPerPower + level * BALANCE.hpPerLevel - tired);
}

/** 정령의 귀띔: 큰 고비마다 1 + 지혜 5마다 1(작은 고비는 지혜 몫만 — 고칠 것 6) */
export function hintsFor(wisdom: number, boss: boolean): number {
  return (boss ? BALANCE.hintBoss : 0) + Math.floor(wisdom / BALANCE.hintPerWisdom);
}

/** 합동 기술에 드는 기세 칸: 세 칸, 어울림 8 이상이면 두 칸 */
export function momentumFull(heart: number): number {
  return heart >= BALANCE.heartMomentumAt ? BALANCE.momentumFullHeart : BALANCE.momentumFull;
}

// ── 오늘의 셈(5.6) ───────────────────────────────────────────────

export type Today = Save5['today'];

export function emptyToday(date: string): Today {
  return { date, xp: 0, topics: {}, replays: {} };
}

/** 날이 바뀌었으면 오늘의 셈을 비운다(같은 날이면 그대로) */
export function rollDay(today: Today | undefined, date: string): Today {
  return today && today.date === date ? today : emptyToday(date);
}

// ── 에피소드의 경험치(5.5·5.6의 2번) ───────────────────────────────

/** 이야기 배수(②×1.2 …). 모르는 이야기는 1 */
export function storyMul(story: string): number {
  return BALANCE.storyXpMul[story] ?? 1;
}

export interface EpisodeXpInput {
  story: string;
  /** 처음 깨는 판인가(아니면 다시 하기) */
  first: boolean;
  /** 이번 판에 받은 별 */
  stars: readonly boolean[];
  /** 전에 받아 둔 별(처음이면 없음) */
  had?: readonly boolean[];
  /** 마친 작은 고비 수 */
  minors: number;
  /** 도감에 새로 적힌 칸 수(처음 가 본 자리·처음 만난 사람) */
  book: number;
  /** 오늘 이 에피소드를 다시 한 판 수(이번 판 앞까지) — 다시 하기만 센다 */
  replaysToday?: number;
}

export interface EpisodeXp {
  xp: number;
  parts: { boss: number; minors: number; book: number; stars: number; share: number; mul: number; capped: boolean };
}

/**
 * 에피소드 한 판의 경험치.
 * 처음 깸 = (큰 고비 80 + 작은 고비 15씩 + 도감 2씩(20까지) + 별 10씩) × 이야기 배수 — ①-1 별 셋이면 160.
 * 다시 하기 = (새로 받은 별 × 10 + 처음 깸(큰 고비·작은 고비)의 10분의 1) × 이야기 배수, 같은 에피소드는 하루 세 판까지(넷째 판부터 0).
 * 구해 줌·해거름이어도 경험치는 그대로다(별 ②가 없을 뿐 — 8.1).
 */
export function episodeXp(input: EpisodeXpInput): EpisodeXp {
  const mul = storyMul(input.story);
  const count = (list: readonly boolean[] | undefined) => (list ?? []).filter(Boolean).length;
  if (input.first) {
    const boss = BALANCE.xpBoss;
    const minors = BALANCE.xpMinor * input.minors;
    const book = Math.min(BALANCE.xpBookMax, BALANCE.xpBook * Math.max(0, input.book));
    const stars = BALANCE.xpStar * count(input.stars);
    return { xp: Math.round((boss + minors + book + stars) * mul), parts: { boss, minors, book, stars, share: 0, mul, capped: false } };
  }
  if ((input.replaysToday ?? 0) >= BALANCE.replayPerDay) {
    return { xp: 0, parts: { boss: 0, minors: 0, book: 0, stars: 0, share: 0, mul, capped: true } };
  }
  const fresh = input.stars.filter((on, i) => on && !(input.had ?? [])[i]).length;
  const stars = BALANCE.xpStar * fresh;
  const share = (BALANCE.xpBoss + BALANCE.xpMinor * input.minors) * BALANCE.replayShare;
  return { xp: Math.round((stars + share) * mul), parts: { boss: 0, minors: 0, book: 0, stars, share, mul, capped: false } };
}

// ── 서당의 경험치(5.5·5.6의 3번) ────────────────────────────────

export interface SeodangAnswer {
  /** 문제 id */
  q: string;
  right: boolean;
  /** 틀린 뒤 풀이를 읽었나(화면은 늘 풀이를 보인다 — 적지 않으면 읽은 것으로 본다) */
  read?: boolean;
}

export interface SeodangXpInput {
  topic: string;
  /** 판을 열기 전의 그 주제 기록(없으면 처음) */
  log?: QuizLog;
  /** 이 판의 문제(어려움을 알려고) */
  questions: readonly Pick<Question, 'id' | 'level'>[];
  answers: readonly SeodangAnswer[];
  /** 끝까지 풀었나 */
  finished: boolean;
  today: Today | undefined;
  date: string;
}

export interface SeodangXp {
  xp: number;
  /** 하루·같은 주제를 따지기 전의 값 */
  raw: number;
  /** 같은 날 같은 주제 몇째 판인가(1부터) */
  round: number;
  /** 같은 주제의 몫(1 · 0.5 · 0) */
  share: number;
  today: Today;
}

/** 비트 묶음에서 그 자리를 읽는다(quiz.ts와 같은 꼴 — 서로 가져오지 않으려고 여기 따로 짧게 둔다) */
function bitOn(text: string | undefined, index: number): boolean {
  if (!text || index < 0) return false;
  const byte = Math.floor(index / 8);
  if (byte * 2 + 1 >= text.length) return false;
  const v = parseInt(text.slice(byte * 2, byte * 2 + 2), 16);
  return Number.isFinite(v) && ((v >> (index % 8)) & 1) === 1;
}

/** id의 마지막 '-' 뒤의 수(비트 묶음의 자리) */
function tailNumber(id: string): number {
  const n = Number(id.slice(id.lastIndexOf('-') + 1));
  return Number.isInteger(n) && n >= 0 ? n : -1;
}

/**
 * 서당 한 판의 경험치. 기록(log)은 이 판의 답을 적기 전의 것을 넘긴다.
 * 문제마다: 처음 맞힘 4(어려움 6), 이미 맞힌 문제를 다시 맞히면 0, 다시 볼 문제를 맞히면 3, 틀렸지만 풀이를 읽으면 1.
 * 끝까지 풀면 10. 같은 날 같은 주제는 둘째 판이 반, 셋째 판부터 0. 하루 서당 경험치는 300까지.
 */
export function seodangXp(input: SeodangXpInput): SeodangXp {
  const levelOf = new Map(input.questions.map((q) => [q.id, q.level]));
  const wrong = new Set(input.log?.wrong ?? []);
  let raw = 0;
  for (const a of input.answers) {
    if (a.right) {
      if (wrong.has(a.q)) raw += BALANCE.xpReview;
      else if (bitOn(input.log?.right, tailNumber(a.q))) raw += 0;
      else raw += levelOf.get(a.q) === 3 ? BALANCE.xpRightHard : BALANCE.xpRight;
    } else if (a.read !== false) {
      raw += BALANCE.xpRead;
    }
  }
  if (input.finished) raw += BALANCE.xpFinish;
  const today = rollDay(input.today, input.date);
  const round = (today.topics[input.topic] ?? 0) + 1;
  const shares = BALANCE.sameTopicShare;
  const share = shares[Math.min(round - 1, shares.length - 1)];
  const room = Math.max(0, BALANCE.quizDayCap - today.xp);
  const xp = Math.min(room, Math.floor(raw * share));
  return {
    xp,
    raw,
    round,
    share,
    today: { ...today, xp: today.xp + xp, topics: { ...today.topics, [input.topic]: round } },
  };
}

// ── 배우는 행동에서만(5.6의 1번) ──────────────────────────────────

export const IDLE_ACTIONS = ['outfit', 'shop', 'sell', 'walk', 'photo', 'decorate'] as const;
export type IdleAction = (typeof IDLE_ACTIONS)[number];

/** 꾸미기·가게(사고팔기)·걷기·사진관·우리 집 꾸미기의 경험치: 늘 0 */
export function xpOfAction(action: IdleAction): number {
  void action;
  return 0;
}
