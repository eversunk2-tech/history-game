// 문제 고르기(spec 8.5·9.1·5.6의 5번): 비트 묶음, 답 적기, 서당 20문제(안 푼 것부터), 겨루기의 문제 차례, 지혜 겨루기, 귀띔.
// 화면·브라우저·저장·시계를 모른다. 씨앗은 받아서 쓴다(같은 입력이면 같은 결과). 상태를 고치지 않고 새 값을 돌려준다.
// 문제가 하나도 없어도 돈다(빈 목록·null을 돌려준다).
//
// ── 쓰는 법(㉢·㉣) ─────────────────────────────────────────────
//   bitIndex(id)                                   → 비트 묶음의 자리('soc5-2-1-0042' → 42, 'ep-s1395-1-007' → 7)
//   packBits(bits) / unpackBits(text, n)           → 비트 ↔ 16진수 글자(두 글자가 여덟 칸 — 3판 storage의 꼴)
//   hasBit(text, i) / withBit(text, i, on)         → 한 칸 읽기 / 한 칸 바꾼 새 글자
//   emptyLog()                                     → 빈 주제 기록(QuizLog)
//   recordAnswer(log, id, right, topicIds?)        → 답 하나를 적은 새 기록(topicIds를 주면 한 바퀴를 다 풀었을 때 laps + 1, seen을 비운다)
//   recordAnswers(quiz, answers, questions)        → 여러 답(겨루기의 asked 등)을 주제마다 적은 새 Save5.quiz
//   finishRound(log, score)                        → 서당 한 판을 마친 기록(rounds + 1, best)
//   statusOf(log, id)                              → 'new' | 'wrong' | 'right' + 이번 바퀴에 나왔나(seen)
//   pickSeodang(questions, log, seed)              → 서당 한 판 20문제(쉬움 6·보통 10·어려움 4, 안 푼 것 → 다시 볼 것 → 오래전에 맞힌 것)
//   reviewList(questions, log)                     → 다시 볼 문제(틀린 차례대로)
//   battleReady(q)                                 → 겨루기에 낼 수 있는 꼴인가(고르기·OX·순서 셋까지·짝 두 쌍까지·지도에서 찍기)
//   battleAsk({ questions, logs, episode, earlier, done, seed }) → BattleAsk(겨루기 엔진에 넘기는 문제 고르개 — card·wisdom)
//   hintChoice(q, seed, gone)                      → 귀띔이 지울 고를 것의 자리(0부터, 틀린 것 하나) — 지울 수 없으면 null

import { BALANCE } from './balance';
import type { AskInfo, BattleAsk } from './battle';
import { mulberry32, shuffle, subSeed } from './rng';
import type { Episode, Question, QuizLog, SkillCard } from './types4';

// ── 비트 묶음 ────────────────────────────────────────────────────

/** id의 마지막 '-' 뒤의 수가 비트 묶음의 자리다. 수가 아니면 -1 */
export function bitIndex(id: string): number {
  const tail = id.slice(id.lastIndexOf('-') + 1);
  if (!/^\d+$/.test(tail)) return -1;
  return Number(tail);
}

/** 비트(0·1)를 16진수 글자로: 여덟 칸이 두 글자, 칸 0이 첫 글자 쌍의 가장 낮은 비트 */
export function packBits(bits: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let k = 0; k < 8; k++) if (bits[i + k]) v |= 1 << k;
    out += v.toString(16).padStart(2, '0');
  }
  return out;
}

export function unpackBits(text: string | undefined, length: number): Uint8Array {
  const out = new Uint8Array(length);
  if (!text) return out;
  for (let i = 0; i * 2 + 1 < text.length && i * 8 < length; i++) {
    const v = parseInt(text.slice(i * 2, i * 2 + 2), 16);
    if (!Number.isFinite(v)) break;
    for (let k = 0; k < 8 && i * 8 + k < length; k++) out[i * 8 + k] = (v >> k) & 1;
  }
  return out;
}

export function hasBit(text: string | undefined, index: number): boolean {
  if (!text || index < 0) return false;
  const byte = Math.floor(index / 8);
  if (byte * 2 + 1 >= text.length) return false;
  const v = parseInt(text.slice(byte * 2, byte * 2 + 2), 16);
  return Number.isFinite(v) && ((v >> (index % 8)) & 1) === 1;
}

/** 한 칸을 켜거나 끈 새 글자(모자라면 늘린다) */
export function withBit(text: string | undefined, index: number, on: boolean): string {
  if (index < 0) return text ?? '';
  const length = Math.max((text ?? '').length / 2, Math.floor(index / 8) + 1) * 8;
  const bits = unpackBits(text, length);
  bits[index] = on ? 1 : 0;
  return packBits(bits);
}

// ── 주제 기록 ────────────────────────────────────────────────────

export function emptyLog(): QuizLog {
  return { seen: '', right: '', wrong: [], lastRight: [], best: 0, laps: 0, rounds: 0 };
}

/**
 * 답 하나를 적는다: seen·right 비트, 다시 볼 문제(wrong — 맞히면 빠진다), 맞힌 차례(lastRight — 오래전 것이 앞, 다시 맞히면 뒤로).
 * topicIds(그 주제의 모든 문제 id)를 주면, 모두 이번 바퀴에 나왔을 때 한 바퀴를 마친다(laps + 1, seen을 비운다 — 바퀴 수는 남긴다).
 */
export function recordAnswer(log: QuizLog | undefined, id: string, right: boolean, topicIds?: readonly string[]): QuizLog {
  const base = log ?? emptyLog();
  const at = bitIndex(id);
  let seen = withBit(base.seen, at, true);
  const rightBits = right ? withBit(base.right, at, true) : base.right;
  const wrong = right ? base.wrong.filter((w) => w !== id) : base.wrong.includes(id) ? base.wrong : [...base.wrong, id];
  const lastRight = right ? [...base.lastRight.filter((r) => r !== id), id] : base.lastRight.filter((r) => r !== id);
  let laps = base.laps;
  if (topicIds && topicIds.length > 0 && topicIds.every((t) => bitIndex(t) < 0 || hasBit(seen, bitIndex(t)))) {
    laps += 1;
    seen = '';
  }
  return { ...base, seen, right: rightBits, wrong, lastRight, laps };
}

/** 서당 한 판을 마쳤다: 판 수와 최고 점수 */
export function finishRound(log: QuizLog | undefined, score: number): QuizLog {
  const base = log ?? emptyLog();
  return { ...base, rounds: base.rounds + 1, best: Math.max(base.best, score) };
}

/** 여러 답을 주제마다 적는다(겨루기의 asked를 끝에 한꺼번에). 모르는 문제 id는 건너뛴다 */
export function recordAnswers(
  quiz: Readonly<Record<string, QuizLog>>,
  answers: readonly { q: string; right: boolean }[],
  questions: readonly Pick<Question, 'id' | 'topic'>[],
): Record<string, QuizLog> {
  const topicOf = new Map(questions.map((q) => [q.id, q.topic]));
  const idsOf = new Map<string, string[]>();
  for (const q of questions) idsOf.set(q.topic, [...(idsOf.get(q.topic) ?? []), q.id]);
  const out: Record<string, QuizLog> = { ...quiz };
  for (const a of answers) {
    const topic = topicOf.get(a.q);
    if (!topic) continue;
    out[topic] = recordAnswer(out[topic], a.q, a.right, idsOf.get(topic));
  }
  return out;
}

export type QuizStatus = 'new' | 'wrong' | 'right';

/**
 * 한 문제의 형편. group이 작을수록 먼저 낸다:
 *   0 이번 바퀴에 안 나왔고 한 번도 푼 적 없음(새 문제) · 1 이번 바퀴에 안 나온 다시 볼 문제 · 2 이번 바퀴에 안 나온 맞힌 문제
 *   3 이번 바퀴에 나온 다시 볼 문제 · 4 이번 바퀴에 나온 맞힌 문제
 * order는 같은 group 안의 차례(다시 볼 문제는 틀린 차례, 맞힌 문제는 맞힌 차례 — 오래전 것이 앞).
 */
export function statusOf(log: QuizLog | undefined, id: string): { status: QuizStatus; seen: boolean; group: number; order: number } {
  const seen = hasBit(log?.seen, bitIndex(id));
  const wrongAt = log?.wrong.indexOf(id) ?? -1;
  if (wrongAt >= 0) return { status: 'wrong', seen, group: seen ? 3 : 1, order: wrongAt };
  const rightAt = log?.lastRight.indexOf(id) ?? -1;
  if (rightAt >= 0 || hasBit(log?.right, bitIndex(id))) return { status: 'right', seen, group: seen ? 4 : 2, order: rightAt };
  // 이번 바퀴에 나왔는데 맞힌 적도 다시 볼 것도 아닌 것(기록이 어긋난 때)은 맞힌 것의 맨 앞에 둔다
  return seen ? { status: 'right', seen, group: 4, order: -1 } : { status: 'new', seen, group: 0, order: 0 };
}

// ── 서당 ───────────────────────────────────────────────────────

/**
 * 서당 한 판(20문제): 쉬움 6 · 보통 10 · 어려움 4. 고르는 차례는 statusOf의 group 차례(① 안 푼 것 → ② 다시 볼 것 → ③ 오래전에 맞힌 것).
 * 한 group 안에서는 먼저 제 어려움 칸을 채우고, 그래도 그 group이 남았으면 이웃 어려움 칸으로 채운다
 * (안 푼 것이 남았는데 다시 볼 문제를 먼저 내지 않는다). 새 문제는 씨앗 있는 무작위, 나머지는 틀린·맞힌 차례.
 * 돌려주는 차례는 쉬운 것부터(같은 어려움 안에서는 고른 차례).
 */
export function pickSeodang(
  questions: readonly Question[],
  log: QuizLog | undefined,
  seed: number,
  count: number = BALANCE.quizCount,
  mix: readonly number[] = BALANCE.quizMix,
): Question[] {
  const groups: Question[][] = [[], [], [], [], []];
  const orderOf = new Map<string, number>();
  for (const q of questions) {
    const s = statusOf(log, q.id);
    groups[s.group].push(q);
    orderOf.set(q.id, s.order);
  }
  groups[0] = shuffle(mulberry32(subSeed(seed, 'seodang')), groups[0]);
  for (let g = 1; g < groups.length; g++) groups[g].sort((a, b) => (orderOf.get(a.id) ?? 0) - (orderOf.get(b.id) ?? 0));

  const slots = mix.slice(0, 3).map((n) => Math.max(0, n));
  // 칸의 합이 count와 다르면 보통 칸으로 맞춘다
  slots[1] += Math.max(0, count - slots.reduce((a, b) => a + b, 0));
  const picked: Question[] = [];
  for (const pool of groups) {
    if (picked.length >= count) break;
    const left: Question[] = [];
    for (const q of pool) {
      const i = q.level - 1;
      if (picked.length < count && slots[i] > 0) {
        slots[i] -= 1;
        picked.push(q);
      } else left.push(q);
    }
    for (const q of left) {
      if (picked.length >= count) break;
      const i = nearestSlot(slots, q.level - 1);
      if (i < 0) break;
      slots[i] -= 1;
      picked.push(q);
    }
  }
  const pickOrder = new Map(picked.map((q, i) => [q.id, i]));
  return picked.slice().sort((a, b) => a.level - b.level || (pickOrder.get(a.id) ?? 0) - (pickOrder.get(b.id) ?? 0));
}

/** 남은 칸 가운데 그 어려움에 가장 가까운 칸(같으면 쉬운 쪽). 없으면 -1 */
function nearestSlot(slots: readonly number[], level: number): number {
  let best = -1;
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] <= 0) continue;
    if (best < 0 || Math.abs(i - level) < Math.abs(best - level)) best = i;
  }
  return best;
}

/** 다시 볼 문제(틀린 차례대로). 주제의 문제 가운데 기록의 wrong에 있는 것 */
export function reviewList(questions: readonly Question[], log: QuizLog | undefined): Question[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return (log?.wrong ?? []).map((id) => byId.get(id)).filter((q): q is Question => Boolean(q));
}

// ── 겨루기 ─────────────────────────────────────────────────────

/** 겨루기에 낼 수 있는 꼴(8.5): 고르기 · OX · 순서 셋까지 · 짝 두 쌍까지 · 지도에서 찍기 */
export function battleReady(q: Pick<Question, 'form' | 'items' | 'pairs'>): boolean {
  switch (q.form) {
    case 'pick':
    case 'ox':
    case 'map':
      return true;
    case 'order':
      return (q.items?.length ?? 0) > 0 && (q.items?.length ?? 0) <= 3;
    case 'match':
      return (q.pairs?.length ?? 0) > 0 && (q.pairs?.length ?? 0) <= 2;
    default:
      return false;
  }
}

export interface BattleAskInput {
  /** 찾을 문제 모두(이야기 문제 + 서당 은행) */
  questions: readonly Question[];
  /** 주제마다의 기록(Save5.quiz) */
  logs: Readonly<Record<string, QuizLog>>;
  episode: Pick<Episode, 'id' | 'storyTopic' | 'topics' | 'core'>;
  /** 같은 이야기의 앞 에피소드의 이야기 문제 주제('ep-s1395-1' …) */
  earlier?: readonly string[];
  /**
   * 이 판에서 한 일(Happening id — 현장의 game.history). 'at:<일 id>' 꼬리표를 단 문제(그 사실을 한 길·한 덤에서만 듣는다)는
   * 그 일을 했을 때만 "겪은 것"이다 — 겪은 것을 먼저 낸다(4-1 ㉢, ㉡ Review 권고 ㅊ). 주지 않으면 꼬리표를 보지 않는다.
   */
  done?: readonly string[];
  seed: number;
}

/** 이 판에서 겪지 않은 문제인가: 'at:' 꼬리표가 있고 그 가운데 어느 일도 하지 않았다(done이 없으면 늘 거짓) */
export function unheard(q: Pick<Question, 'tags'>, done: readonly string[] | undefined): boolean {
  if (!done) return false;
  const at = (q.tags ?? []).filter((t) => t.startsWith('at:')).map((t) => t.slice(3));
  return at.length > 0 && !at.some((id) => done.includes(id));
}

/** 그 겨루기에서 맞힌 수로 먼저 낼 어려움(쉬움 먼저 — 8.1의 "하위권 아이를 위한 것") */
export function askLevel(right: number): 1 | 2 | 3 {
  const [mid, hard] = BALANCE.askLevelAt;
  return right >= hard ? 3 : right >= mid ? 2 : 1;
}

/**
 * 카드에 낼 문제의 찾는 곳(작을수록 먼저 — 8.5): 1 그 에피소드의 이야기 문제 · 2 같은 이야기의 앞 에피소드 · 3 이어진 서당 주제 ·
 * 4 견주기(theme) · 5 꼬리표에 닿지 않지만 그 에피소드의 이야기 문제 · 6 그 에피소드의 서당 주제. 낼 수 없으면 0.
 * 꼬리표: 카드 'ep:<에피소드>' → 주제 'ep-<에피소드>', 'topic:<주제>' → 그 주제, 'theme:<id>' → 문제의 'theme:<id>',
 * 문제의 'card:<카드 id>'(그 카드에 먼저 내는 표시)와 'ep:<에피소드>'.
 */
export function sourceRank(card: Pick<SkillCard, 'id' | 'tags'>, q: Question, input: Pick<BattleAskInput, 'episode' | 'earlier'>): number {
  const eps = new Set<string>();
  const topics = new Set<string>();
  const themes = new Set<string>();
  for (const tag of card.tags) {
    if (tag.startsWith('ep:')) eps.add(tag.slice(3));
    else if (tag.startsWith('topic:')) topics.add(tag.slice(6));
    else if (tag.startsWith('theme:')) themes.add(tag.slice(6));
  }
  const qTags = q.tags ?? [];
  const story = q.topic.startsWith('ep-');
  const storyEp = story ? q.topic.slice(3) : '';
  const earlier = input.earlier ?? [];
  const own = q.topic === input.episode.storyTopic;
  // 다른 에피소드의 이야기 문제는 앞 에피소드이거나 그 에피소드에서 얻은 카드일 때만(아직 겪지 않은 이야기를 묻지 않는다)
  if (story && !own && !earlier.includes(q.topic) && !eps.has(storyEp)) return 0;
  const byTheme = qTags.some((t) => t.startsWith('theme:') && themes.has(t.slice(6)));
  const touches =
    (story && eps.has(storyEp)) ||
    topics.has(q.topic) ||
    byTheme ||
    qTags.includes(`card:${card.id}`) ||
    qTags.some((t) => t.startsWith('ep:') && eps.has(t.slice(3)));
  if (touches) {
    if (own) return 1;
    if (earlier.includes(q.topic)) return 2;
    if (!story && (topics.has(q.topic) || input.episode.topics.includes(q.topic))) return 3;
    return 4;
  }
  if (own) return 5;
  if (input.episode.topics.includes(q.topic)) return 6;
  return 0;
}

/** 씨앗과 id로 정하는 고른 차례(같은 차례 안의 무작위) */
function tie(seed: number, id: string): number {
  return subSeed(seed, `ask:${id}`);
}

/**
 * 겨루기 엔진에 넘기는 문제 고르개. 한 겨루기 안에서 낸 문제(exclude)는 다시 내지 않는다(틀려서 다시 내는 것은 겨루기 엔진이 한다).
 * card: 찾는 곳(sourceRank) → 이 판에서 겪은 것('at:' — unheard) → 그 카드 표시('card:<id>') → 형편(안 푼 것 → 다시 볼 것 → 오래전에 맞힌 것) → 어려움(맞힌 수가 늘면 보통·어려움) 차례.
 * wisdom: 에피소드의 핵심 물음(core — 비었으면 이야기 문제 가운데 'core' 꼬리표)에서 겪은 것 → 안 푼 것·다시 볼 것 먼저.
 */
export function battleAsk(input: BattleAskInput): BattleAsk {
  const ready = input.questions.filter((q) => battleReady(q));
  const statusCache = new Map<string, { group: number; order: number }>();
  const status = (q: Question) => {
    let s = statusCache.get(q.id);
    if (!s) {
      s = statusOf(input.logs[q.topic], q.id);
      statusCache.set(q.id, s);
    }
    return s;
  };
  return {
    card(card: SkillCard, info: AskInfo): string | null {
      const exclude = new Set(info.exclude);
      const target = askLevel(info.right);
      let best: { q: Question; key: number[] } | null = null;
      for (const q of ready) {
        if (exclude.has(q.id)) continue;
        const rank = sourceRank(card, q, input);
        if (rank === 0) continue;
        const s = status(q);
        const key = [
          rank,
          unheard(q, input.done) ? 1 : 0,
          (q.tags ?? []).includes(`card:${card.id}`) ? 0 : 1,
          s.group,
          Math.abs(q.level - target),
          q.level,
          s.order,
          tie(input.seed, q.id),
        ];
        if (!best || less(key, best.key)) best = { q, key };
      }
      return best?.q.id ?? null;
    },
    wisdom(n: number, info: Pick<AskInfo, 'exclude'>): string[] {
      const exclude = new Set(info.exclude);
      const core = input.episode.core.length > 0 ? new Set(input.episode.core) : null;
      const pool = ready.filter(
        (q) => !exclude.has(q.id) && (core ? core.has(q.id) : q.topic === input.episode.storyTopic && (q.tags ?? []).includes('core')),
      );
      return pool
        .map((q) => ({ q, key: [unheard(q, input.done) ? 1 : 0, status(q).group, status(q).order, tie(input.seed, `wisdom:${q.id}`)] }))
        .sort((a, b) => (less(a.key, b.key) ? -1 : less(b.key, a.key) ? 1 : 0))
        .slice(0, Math.max(0, n))
        .map((row) => row.q.id);
    },
  };
}

function less(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

// ── 귀띔 ───────────────────────────────────────────────────────

/**
 * 정령의 귀띔: 고르기 문제에서 틀린 고를 것 하나의 자리(0부터 — 화면이 섞기 전의 차례). 씨앗으로 고른다.
 * gone은 이미 지운 자리. 고르기가 아니거나, 지우면 hintKeep(2)보다 적게 남으면 null.
 */
export function hintChoice(q: Pick<Question, 'id' | 'form' | 'choices' | 'answer'>, seed: number, gone: readonly number[] = []): number | null {
  if (q.form !== 'pick' || !q.choices || typeof q.answer !== 'number') return null;
  const left = q.choices.map((_, i) => i).filter((i) => !gone.includes(i));
  if (left.length - 1 < BALANCE.hintKeep) return null;
  const wrongs = left.filter((i) => i !== q.answer);
  if (wrongs.length === 0) return null;
  const rng = mulberry32(subSeed(seed, `hint:${q.id}:${gone.length}`));
  return wrongs[Math.min(wrongs.length - 1, Math.floor(rng() * wrongs.length))];
}
