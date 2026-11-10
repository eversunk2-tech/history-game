// 기기 저장의 바탕(4-1 ㉢부터). 저장의 꼴(꼴 5 — 읽기·검사·쓰기·옛 꼴 알림·한 벌)은 save5.ts에 있다.
// 여기에는 꼴 5와 화면이 함께 쓰는 것만 남았다: 저장소의 꼴(StorageLike)과 브라우저 저장소, 판 번호, 꼴 번호,
// 현장의 판(3판 GameState)을 꼼꼼히 읽는 셈(parseGame — 꼴 5의 current.game이 이것으로 읽힌다), 없어진 이름 솎기(pruneGame),
// 가 본 칸 묶기(packBits), 지우지 말아 달라는 청(requestPersist).
// 3판의 한 해 저장(꼴 2~4 — Save·ClearRecord·MIGRATIONS·parseSave·loadSave·writeSave …)은 지웠다. 옛 꼴은 옮기지 않는다(spec 5.8):
// save5.ts가 알림 + 한 벌 + 처음부터로 다룬다. 이 파일은 브라우저 없이도 돈다(저장소를 밖에서 받는다).

import { SAVE5_SCHEMA } from '../engine/types4';
import { SEASONS, STATS, type GameState, type Stats } from '../engine/types';

/**
 * 지금 코드가 쓰는 저장의 꼴: 5(4판 — 거점·출전·에피소드. spec 5.8, 11.1 다의 Save5).
 * 옛 꼴: 2(바퀴 1-다) · 3(1-다 고치기, 종이) · 4(1-라 고치기, 깬 해의 줄거리) — 3판의 한 해 게임. 학생이 쓴 적이 없어 옮기지 않는다.
 * 1-가의 'joseon-year/v1'은 키가 달라 읽지 않는다.
 */
export const SCHEMA = SAVE5_SCHEMA;

/** 한 계절의 해 ☀가 이보다 많을 수는 없다(역할의 해는 둘이나 셋이다). 저장을 읽을 때의 울타리다. */
export const MAX_SUNS = 5;

/** 판 번호: 빌드할 때 넣는다(없으면 'dev') */
export const BUILD: string = (import.meta.env?.VITE_BUILD as string | undefined) ?? 'dev';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 브라우저의 저장소. 쓸 수 없는 창(막힌 창)이면 null. */
export function browserStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const probe = 'joseon-year/probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** 수치의 변화나 앞뒤 값이 적힌 칸인가(셋 다 수인가). 변화는 음수일 수 있으므로 묶지 않고 꼴만 본다. */
function isNumbers(v: unknown): boolean {
  return isObject(v) && STATS.every((stat) => typeof v[stat] === 'number' && Number.isFinite(v[stat] as number));
}

const isStrings = (v: unknown): boolean => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isSeason = (v: unknown): boolean => typeof v === 'string' && (SEASONS as readonly string[]).includes(v);

/** 한 일의 기록 한 줄이 제 꼴인가(화면이 이 칸들을 그대로 읽는다) */
function isDeed(v: unknown): boolean {
  if (!isObject(v)) return false;
  if (typeof v.happeningId !== 'string' || !isSeason(v.season) || typeof v.note !== 'string') return false;
  if (!Array.isArray(v.lines) || !v.lines.every((line) => isObject(line) && typeof line.text === 'string')) return false;
  if (!isNumbers(v.requested) || !isNumbers(v.delta) || !isNumbers(v.before) || !isNumbers(v.after)) return false;
  if (!isStrings(v.newCards) || !isStrings(v.newItems) || !isStrings(v.newFlags) || !isStrings(v.solved)) return false;
  return v.sun === 0 || v.sun === 1;
}

/** 계절을 닫은 기록 한 줄이 제 꼴인가(줄마다의 값 effects는 꼴 4부터 있고, 있으면 줄과 수가 같아야 한다) */
function isClosing(v: unknown): boolean {
  if (!isObject(v)) return false;
  if (!(isSeason(v.season) && isNumbers(v.delta) && isNumbers(v.before) && isNumbers(v.after) && isStrings(v.lines) && isStrings(v.newCards))) return false;
  if (v.effects === undefined) return true;
  return Array.isArray(v.effects) && v.effects.length === (v.lines as unknown[]).length && v.effects.every(isNumbers);
}

function statsOf(v: unknown): Stats | null {
  if (!isObject(v)) return null;
  const out = {} as Stats;
  for (const stat of STATS) {
    const n = v[stat];
    if (typeof n !== 'number' || !Number.isFinite(n)) return null;
    out[stat] = Math.max(0, Math.min(10, Math.round(n)));
  }
  return out;
}

/** 진행 중인 해를 꼼꼼히 읽는다. 하나라도 어긋나면 null(그 해는 처음부터 다시 한다). */
export function parseGame(v: unknown): GameState | null {
  if (!isObject(v)) return null;
  const stats = statsOf(v.stats);
  if (!stats) return null;
  if (typeof v.situationId !== 'string' || typeof v.role !== 'string') return null;
  if (v.look !== 'boy' && v.look !== 'girl') return null;
  if (typeof v.seed !== 'number' || typeof v.seasonIndex !== 'number') return null;
  if (!Number.isInteger(v.seasonIndex) || v.seasonIndex < 0 || v.seasonIndex >= SEASONS.length) return null;
  if (v.phase !== 'season' && v.phase !== 'seasonClose' && v.phase !== 'done') return null;
  // 한 해가 끝난 것은 겨울을 보낸 뒤뿐이다(여름에 끝난 해를 그대로 깨지 않게)
  if (v.phase === 'done' && v.seasonIndex !== SEASONS.length - 1) return null;
  if (typeof v.sunsLeft !== 'number' || !Number.isFinite(v.sunsLeft) || v.sunsLeft < 0) return null;
  if (!Array.isArray(v.history) || !Array.isArray(v.flow) || !Array.isArray(v.closings)) return null;
  // 한 일과 계절 닫기의 기록은 화면이 그대로 읽는다. 한 줄이라도 꼴이 어긋나면 그 해는 봄부터 다시 한다.
  if (!v.history.every(isDeed) || !v.closings.every(isClosing)) return null;
  const flow = v.flow.map(statsOf);
  if (flow.some((f) => f === null)) return null;
  return {
    situationId: v.situationId,
    role: v.role,
    look: v.look,
    seed: v.seed >>> 0,
    stats,
    flags: strings(v.flags),
    cards: strings(v.cards),
    items: strings(v.items),
    draw: typeof v.draw === 'string' ? v.draw : null,
    seasonIndex: v.seasonIndex,
    phase: v.phase,
    sunsLeft: Math.min(MAX_SUNS, Math.round(v.sunsLeft)),
    done: strings(v.done),
    solved: strings(v.solved),
    history: v.history as GameState['history'],
    flow: flow as Stats[],
    closings: v.closings as GameState['closings'],
    goTo: typeof v.goTo === 'string' ? v.goTo : undefined,
    at: typeof v.at === 'string' ? v.at : undefined,
    seen: strings(v.seen),
  };
}

/** 이름표(카드·물건·일·미션)의 묶음: 지금의 판이 아는 이름들 */
export interface Known {
  happenings: ReadonlySet<string>;
  missions: ReadonlySet<string>;
  cards: ReadonlySet<string>;
  items: ReadonlySet<string>;
}

/**
 * 저장에 모르는 이름(새 판에서 없어진 일·미션·카드·물건)이 있으면 그 항목만 버리고 나머지는 살린다(spec 10절).
 * 바뀐 것이 없으면 받은 것을 그대로 돌려준다.
 */
export function pruneGame(game: GameState, known: Known): GameState {
  const keep = (list: readonly string[], set: ReadonlySet<string>): string[] => list.filter((id) => set.has(id));
  const next: GameState = {
    ...game,
    done: keep(game.done, known.happenings),
    solved: keep(game.solved, known.missions),
    cards: keep(game.cards, known.cards),
    items: keep(game.items, known.items),
    history: game.history.filter((deed) => known.happenings.has(deed.happeningId)),
  };
  const same =
    next.done.length === game.done.length &&
    next.solved.length === game.solved.length &&
    next.cards.length === game.cards.length &&
    next.items.length === game.items.length &&
    next.history.length === game.history.length;
  return same ? game : next;
}

// ── 가 본 칸을 글자로 묶기 ─────────────────────────────────────

/** 0/1의 줄을 글자로(여덟 칸을 한 글자의 두 자리 16진수로) */
export function packBits(bits: Uint8Array): string {
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

/** 브라우저에 "이 저장은 지우지 말아 달라"고 청한다. 들어줄지는 브라우저가 정한다(물음창은 뜨지 않는다). */
export function requestPersist(): void {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // 청하지 못해도 게임은 그대로 된다
  }
}
