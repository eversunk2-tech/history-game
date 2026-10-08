// 기기 저장(localStorage). 키는 'joseon-year/save' 하나다(spec 5.4, 10절).
// 저장에는 꼴 번호(schema)와 마지막으로 쓴 판(build)이 있고, 깬 기록과 진행 중인 해를 따로 적는다.
// 새 판은 옛 꼴의 저장을 번호 하나씩 차례로 새 꼴로 옮긴다. 옮기기 전의 글자는 'joseon-year/backup'에 남긴다.
// 이 파일은 브라우저 없이도 돈다(저장소를 밖에서 받는다).

import { SEASONS, STATS, type GameState, type Look, type RoleId, type Stats } from '../engine/types';

export const SAVE_KEY = 'joseon-year/save';
export const BACKUP_KEY = 'joseon-year/backup';
/**
 * 지금 코드가 쓰는 저장의 꼴. 1-가의 'joseon-year/v1'은 학생이 쓴 적이 없어 옮기지 않는다.
 *   2 — 바퀴 1-다: 깬 기록 · 카드 · 진행 중인 해 · 가 본 칸
 *   3 — 1-다 고치기: 아직 보여 주지 않은 "미션이 풀림" 종이(papers)를 더했다
 */
export const SCHEMA = 3;

/** 한 계절의 해 ☀가 이보다 많을 수는 없다(역할의 해는 둘이나 셋이다). 저장을 읽을 때의 울타리다. */
export const MAX_SUNS = 5;

/** 판 번호: 빌드할 때 넣는다(없으면 'dev') */
export const BUILD: string = (import.meta.env?.VITE_BUILD as string | undefined) ?? 'dev';

export interface ClearRecord {
  role: RoleId;
  look: Look;
  ending: string;
  legacy: string;
}

export interface Save {
  schema: number;
  build: string;
  /** 깬 이야기의 기록(이야기 id마다) */
  cleared: Record<string, ClearRecord[]>;
  /** 모은 생활 카드 */
  cards: string[];
  /** 진행 중인 해 */
  current?: GameState;
  /** [더함] 맵에서 가 본 칸(비트를 글자로 묶은 것). 진행 중인 해에 딸린다. */
  walked?: string;
  /**
   * [더함, 꼴 3] 풀렸지만 "미션이 풀림" 종이를 아직 닫지 않은 미션의 id들. 진행 중인 해에 딸린다.
   * 결과 대화나 종이가 떠 있을 때 화면을 덮어도, 다음에 이어 하면 종이가 뜬다.
   */
  papers?: string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function emptySave(): Save {
  return { schema: SCHEMA, build: BUILD, cleared: {}, cards: [] };
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

/**
 * 읽은 결과.
 * ok: 그대로 읽었다 · empty: 저장이 없다 · migrated: 옛 꼴을 새 꼴로 옮겼다
 * yearLost: 진행 중인 해를 읽을 수 없어 깬 기록만 살렸다 · unreadable: 아무것도 읽을 수 없어 처음부터
 * newer: 코드보다 새 꼴의 저장이다(저장을 건드리지 않는다) · noStorage: 저장이 안 되는 창이다
 */
export type LoadStatus = 'ok' | 'empty' | 'migrated' | 'yearLost' | 'unreadable' | 'newer' | 'noStorage';

export interface Loaded {
  save: Save;
  status: LoadStatus;
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

/** 계절을 닫은 기록 한 줄이 제 꼴인가 */
function isClosing(v: unknown): boolean {
  if (!isObject(v)) return false;
  return isSeason(v.season) && isNumbers(v.delta) && isNumbers(v.before) && isNumbers(v.after) && isStrings(v.lines) && isStrings(v.newCards);
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

function parseCleared(v: unknown): Save['cleared'] {
  const out: Save['cleared'] = {};
  if (!isObject(v)) return out;
  for (const [story, list] of Object.entries(v)) {
    if (!Array.isArray(list)) continue;
    const rows: ClearRecord[] = [];
    for (const row of list) {
      if (!isObject(row) || typeof row.role !== 'string') continue;
      rows.push({
        role: row.role,
        look: row.look === 'girl' ? 'girl' : 'boy',
        ending: typeof row.ending === 'string' ? row.ending : '',
        legacy: typeof row.legacy === 'string' ? row.legacy : '',
      });
    }
    if (rows.length > 0) out[story] = rows;
  }
  return out;
}

/**
 * 옛 꼴을 새 꼴로 옮기는 함수들. 번호 하나씩이고 차례로 거친다(2 → 3, 3 → 4 …).
 * MIGRATIONS[n]은 꼴 n의 저장(읽은 그대로의 것)을 꼴 n + 1로 옮긴다. 꼴 2(바퀴 1-다)가 처음이다.
 */
export const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  // 2 → 3: 아직 보여 주지 않은 종이의 칸이 생겼다. 옛 저장에는 보여 줄 종이가 없다.
  2: (old) => ({ ...old, schema: 3, papers: [] }),
};

/** 저장 글자를 읽는다. 저장소를 건드리지 않는다. */
export function parseSave(raw: string | null): Loaded {
  if (raw === null || raw === '') return { save: emptySave(), status: 'empty' };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { save: emptySave(), status: 'unreadable' };
  }
  if (!isObject(data) || typeof data.schema !== 'number') return { save: emptySave(), status: 'unreadable' };
  if (data.schema > SCHEMA) return { save: emptySave(), status: 'newer' };
  let migrated = false;
  let cur = data;
  for (let n = data.schema; n < SCHEMA; n++) {
    const step = MIGRATIONS[n];
    if (!step) return { save: emptySave(), status: 'unreadable' };
    try {
      cur = step(cur);
    } catch {
      return { save: emptySave(), status: 'unreadable' };
    }
    migrated = true;
  }
  const save: Save = { schema: SCHEMA, build: BUILD, cleared: parseCleared(cur.cleared), cards: strings(cur.cards) };
  let status: LoadStatus = migrated ? 'migrated' : 'ok';
  if (cur.current !== undefined && cur.current !== null) {
    const game = parseGame(cur.current);
    if (game) {
      save.current = game;
      if (typeof cur.walked === 'string') save.walked = cur.walked;
      // 모르는 미션이나 아직 풀리지 않은 미션의 종이는 버린다
      const papers = strings(cur.papers).filter((id) => game.solved.includes(id));
      if (papers.length > 0) save.papers = papers;
    } else status = 'yearLost';
  }
  return { save, status };
}

/** 기기에서 읽는다. 옛 꼴을 옮겼거나 읽다가 잃은 것이 있으면 읽기 전의 글자를 'joseon-year/backup'에 한 벌 남긴다. */
export function loadSave(storage: StorageLike | null = browserStorage()): Loaded {
  if (!storage) return { save: emptySave(), status: 'noStorage' };
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { save: emptySave(), status: 'noStorage' };
  }
  const loaded = parseSave(raw);
  // 옛 꼴을 옮겼거나 읽다가 잃은 것이 있으면, 읽기 전의 글자를 한 벌 남긴다(다음 저장이 덮어쓰기 전에)
  if ((loaded.status === 'migrated' || loaded.status === 'yearLost' || loaded.status === 'unreadable') && raw !== null) {
    try {
      storage.setItem(BACKUP_KEY, raw);
    } catch {
      // 한 벌 남기지 못해도 읽은 것은 쓴다
    }
  }
  return loaded;
}

/** 기기에 쓴다. 못 쓰면 false(화면이 쉬운 말로 알린다). */
export function writeSave(save: Save, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify({ ...save, schema: SCHEMA, build: BUILD }));
    return true;
  } catch {
    return false;
  }
}

/** 모두 지우고 처음부터 */
export function wipeSave(storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.removeItem(SAVE_KEY);
    storage?.removeItem(BACKUP_KEY);
  } catch {
    // 지우지 못해도 화면은 처음으로 간다
  }
}

/** 옛 꼴을 옮기기 전에 남겨 둔 한 벌을 지운다(다음 계절을 닫을 때 — 그때까지 새 꼴로 잘 돌았다는 뜻이다) */
export function dropBackup(storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.removeItem(BACKUP_KEY);
  } catch {
    // 지우지 못해도 게임은 그대로 된다
  }
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

export function withCards(save: Save, cards: readonly string[]): Save {
  const add = cards.filter((c) => !save.cards.includes(c));
  return add.length === 0 ? save : { ...save, cards: [...save.cards, ...add] };
}

export function withCurrent(save: Save, game: GameState | undefined, walked?: string, papers?: readonly string[]): Save {
  const next: Save = { ...save, current: game, walked: game ? (walked ?? save.walked) : undefined };
  const owed = game ? (papers ?? save.papers ?? []) : [];
  if (owed.length > 0) next.papers = [...owed];
  else delete next.papers;
  return next;
}

/** 읽을 수 없게 된 해를 버리기 전에, 지금 저장소에 있는 글자를 한 벌 남긴다 */
export function keepBackup(storage: StorageLike | null = browserStorage()): void {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (raw) storage?.setItem(BACKUP_KEY, raw);
  } catch {
    // 남기지 못해도 게임은 그대로 된다
  }
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
