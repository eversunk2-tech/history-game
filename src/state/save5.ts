// 저장 꼴 5(spec 5.8, 11.1 다의 Save5). 4-1 ㉢부터 앱이 쓰는 저장이다(state/store.ts). storage.ts에는 꼴 5와 함께 쓰는 바탕만 남았다.
// 이 파일은 브라우저 없이도 돈다(저장소를 밖에서 받는다 — storage.ts와 같은 StorageLike).
//
// ── 쓰는 법(㉢) ───────────────────────────────────────────────
//   loadSave5(storage)        → { save, status, notice? }   기기에서 읽는다(옛 꼴은 읽기 전 글자를 BACKUP_KEY에, 꼴 5를 읽을 수 없거나 잘라 냈으면 BACKUP5_KEY에 한 벌)
//   parseSave5(raw)           → { save, status, notice? }   글자를 읽기만 한다(저장소를 건드리지 않는다)
//   writeSave5(save, storage) → { ok, bytes, why? }         쓴다(꼴 번호·판 번호를 붙여서). 한 칸 100KB를 넘으면 쓰지 않고 'tooBig'
//   emptySave5(look)          → 처음부터의 저장(주인공 레벨 1·능력치 3·3·3·3)
//   checkSave5(value)         → 문제의 목록(빈 목록이면 제 꼴) — 시험과 견본이 쓴다
//   saveBytes(save)           → 한 칸의 크기(바이트)
//   resumeAt(save)            → 이어 하기의 자리: 'hub' | 'field' | 'battle'(그 겨루기의 처음부터) | 'result'
//   readSlot / writeSlot      → 반(CLASS_KEY)·은행(BANK_KEY_PREFIX + 주제 id) 칸. 저장 한 칸과 따로 둔다(5.8 — 저장을 무겁게 하지 않게)
//   wipeSave5(storage)        → "처음부터"(두 번 물은 뒤): 저장 칸과 꼴 5의 한 벌을 지운다. 옛 꼴(3판)의 한 벌은 남긴다
//
// 규칙(5.8)
//   - 옛 꼴(2~4 — 3판의 한 해 게임)은 옮기지 않는다. 읽으면 OLD_NOTICE("게임이 새로워져서 처음부터 해요")를 한 번 알리고,
//     옛 글자를 BACKUP_KEY에 한 벌 남기고, 처음부터 한다(학생이 쓴 적이 없다 — 첫 조각의 시험 판은 "기록이 지워질 수 있어요"를 미리 알린다).
//   - 코드보다 새 꼴(6 이상)이면 저장을 건드리지 않는다(status 'newer' — 화면은 "게임을 새로 받아야 해요").
//   - 겨루기는 저장하지 않는다. current.phase가 'battle'이면 그 겨루기의 처음부터 한다(겨루기 안의 상태 BattleState는 저장에 없다).
//   - 하던 에피소드(current)를 읽을 수 없으면 그것만 버리고 깬 기록·주인공·돈·서당 기록은 지킨다(status 'trimmed', 읽기 전 글자를 한 벌).
//     이야기 하나의 기록을 읽을 수 없으면 그 이야기만 버린다. 서당 기록 한 주제가 어긋나면 그 주제만 버린다.

import { STATS, type Look, type Stats } from '../engine/types';
import { CARD_KINDS, SAVE5_SCHEMA, type EpisodeRecord, type Hero, type Purse, type QuizLog, type Save5, type StoryRecord } from '../engine/types4';
import { BUILD, parseGame, type StorageLike } from './storage';

export const SAVE_KEY = 'joseon-year/save';
/** 옛 꼴(2~4 — 3판)의 저장을 읽었을 때 그 글자를 한 벌 남기는 칸(spec 5.8의 joseon-year/backup) */
export const BACKUP_KEY = 'joseon-year/backup';
/**
 * [4-1 ㉢] 꼴 5의 저장을 읽을 수 없거나(unreadable) 칸 일부를 버렸을 때(trimmed) 읽기 전의 글자를 남기는 칸.
 * 옛 꼴의 한 벌(BACKUP_KEY)과 칸을 나눈다 — 한 칸이면 3판의 한 벌을 남긴 뒤 꼴 5가 한 번 어긋나는 것만으로 그 한 벌이 덮인다(㉡ Review 기록 3).
 * 3판의 한 벌은 사용자가 3판에서 해 본 기록의 하나뿐인 사본이고, 꼴 5의 한 벌은 4판 시험 판의 것이라 뜻이 다르다. 두 칸 모두 한 벌씩이다.
 */
export const BACKUP5_KEY = 'joseon-year/backup5';
/** 반 코드로 받은 것(진도·공지·문제 묶음의 판 — 4-2) */
export const CLASS_KEY = 'joseon-year/class';
/** 받아 둔 다섯 과목 주제(게임을 완성한 뒤 — 9.6). 뒤에 주제 id */
export const BANK_KEY_PREFIX = 'joseon-year/bank/';
/** 저장 한 칸의 한도(바이트, UTF-8 — 5.8의 "100KB 안", 가정) */
export const SAVE_LIMIT = 100 * 1024;
/** 옛 저장을 읽었을 때 한 번 알리는 말(5.8) */
export const OLD_NOTICE = '게임이 새로워져서 처음부터 해요';

/**
 * ok: 그대로 읽었다 · empty: 저장이 없다 · old: 옛 꼴(2~4)이라 처음부터(알림 + 한 벌) · unreadable: 읽을 수 없어 처음부터(한 벌)
 * newer: 코드보다 새 꼴(건드리지 않는다) · trimmed: 읽을 수 없는 칸만 버렸다(한 벌) · noStorage: 저장이 안 되는 창
 */
export type Load5Status = 'ok' | 'empty' | 'old' | 'unreadable' | 'newer' | 'trimmed' | 'noStorage';

export interface Loaded5 {
  save: Save5;
  status: Load5Status;
  /** 화면이 한 번 알릴 말(옛 저장일 때) */
  notice?: string;
  /** 버린 칸(trimmed일 때 — 사람이 읽을 것) */
  dropped?: string[];
}

export function emptySave5(look: Look = 'boy', build: string = BUILD): Save5 {
  return {
    schema: SAVE5_SCHEMA,
    build,
    hero: {
      look,
      level: 1,
      xp: 0,
      banked: 0,
      stats: { power: 3, wisdom: 3, craft: 3, heart: 3 },
      points: 0,
      outfit: {},
      titles: [],
      cards: {},
      deck: [],
      gear: {},
    },
    purse: { rice: 0, cloth: 0, coin: 0 },
    items: [],
    hub: { intro: false, seen: [] },
    stories: {},
    quiz: {},
    today: { date: '', xp: 0, topics: {}, replays: {} },
    unlocked: [],
  };
}

// ── 꼴 보기 ──────────────────────────────────────────────────

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isLook = (v: unknown): v is Look => v === 'boy' || v === 'girl';
const isStars = (v: unknown): v is [boolean, boolean, boolean] => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'boolean');
const isIdMap = (v: unknown): v is Record<string, string> => isObject(v) && Object.values(v).every((x) => typeof x === 'string');
const isCountMap = (v: unknown): v is Record<string, number> => isObject(v) && Object.values(v).every(isCount);
/** 비트 묶음(16진수 두 글자가 여덟 칸 — engine/quiz.ts의 packBits) */
const isBits = (v: unknown): v is string => typeof v === 'string' && v.length % 2 === 0 && /^[0-9a-f]*$/.test(v);

export function isPurse(v: unknown): v is Purse {
  return isObject(v) && isCount(v.rice) && isCount(v.cloth) && isCount(v.coin);
}

/** 3판의 수치(살림·기력·인심 0~10) */
function isStats(v: unknown): v is Stats {
  return isObject(v) && STATS.every((s) => typeof v[s] === 'number' && Number.isInteger(v[s]) && (v[s] as number) >= 0 && (v[s] as number) <= 10);
}

function heroProblems(v: unknown): string[] {
  if (!isObject(v)) return ['hero가 없다'];
  const out: string[] = [];
  if (!isLook(v.look)) out.push('hero.look');
  if (!(isCount(v.level) && v.level >= 1 && v.level <= 30)) out.push('hero.level(1~30)');
  if (!isCount(v.xp) || !isCount(v.banked) || !isCount(v.points)) out.push('hero.xp·banked·points');
  if (!(isObject(v.stats) && CARD_KINDS.every((k) => isCount((v.stats as Record<string, unknown>)[k]) && ((v.stats as Record<string, number>)[k] ?? 0) <= 15))) out.push('hero.stats(넷, 15까지)');
  if (!(isObject(v.outfit) && Object.values(v.outfit).every((x) => x === undefined || typeof x === 'string'))) out.push('hero.outfit');
  if (!isStrings(v.titles) || !isStrings(v.deck)) out.push('hero.titles·deck');
  if (!(isObject(v.cards) && Object.values(v.cards).every((x) => x === 1 || x === 2 || x === 3))) out.push('hero.cards(단계 1~3)');
  if (!(isObject(v.gear) && Object.values(v.gear).every((x) => x === undefined || typeof x === 'string'))) out.push('hero.gear');
  return out;
}

function episodeProblems(v: unknown): boolean {
  return isObject(v) && isStars(v.stars) && isCount(v.best) && isCount(v.plays) && typeof v.cleared === 'boolean';
}

function storyProblems(v: unknown): string[] {
  if (!isObject(v)) return ['이야기의 기록이 객체가 아니다'];
  const out: string[] = [];
  if (typeof v.role !== 'string' || !isLook(v.look)) out.push('role·look');
  if (!isStats(v.stats)) out.push('stats(살림·기력·인심 0~10)');
  if (!isStrings(v.flags) || !isStrings(v.cards) || !isStrings(v.items) || !isStrings(v.met)) out.push('flags·cards·items·met');
  if (!isIdMap(v.firstRun)) out.push('firstRun');
  if (!(isObject(v.episodes) && Object.values(v.episodes).every(episodeProblems))) out.push('episodes');
  if (v.legacy !== undefined && typeof v.legacy !== 'string') out.push('legacy');
  if (v.title !== undefined && typeof v.title !== 'string') out.push('title');
  return out;
}

function quizProblems(v: unknown): boolean {
  return (
    isObject(v) && isBits(v.seen) && isBits(v.right) && isStrings(v.wrong) && isStrings(v.lastRight) && isCount(v.best) && isCount(v.laps) && isCount(v.rounds)
  );
}

function currentProblems(v: unknown): string[] {
  if (!isObject(v)) return ['current가 객체가 아니다'];
  const out: string[] = [];
  if (typeof v.episode !== 'string' || typeof v.replay !== 'boolean') out.push('current.episode·replay');
  if (v.phase !== 'field' && v.phase !== 'battle' && v.phase !== 'result') out.push('current.phase');
  if (!isStrings(v.minors)) out.push('current.minors');
  if (v.walked !== undefined && typeof v.walked !== 'string') out.push('current.walked');
  if (v.papers !== undefined && !isStrings(v.papers)) out.push('current.papers');
  if (parseGame(v.game) === null) out.push('current.game(3판 GameState)');
  if (v.result !== undefined) {
    const r = v.result;
    if (!(isObject(r) && isStars(r.stars) && isCount(r.score) && isCount(r.xp) && isPurse(r.purse) && isStrings(r.cards))) out.push('current.result');
    // [4-1 ㉢] 결과 종이를 다시 그릴 칸(없어도 된다 — ㉡의 견본에는 없다)
    else if (
      !(r.first === undefined || typeof r.first === 'boolean') ||
      !(r.newStars === undefined || isStars(r.newStars)) ||
      !(r.best === undefined || isCount(r.best)) ||
      !(r.bestNew === undefined || typeof r.bestNew === 'boolean') ||
      !(r.levels === undefined || isCount(r.levels)) ||
      !(r.banked === undefined || isCount(r.banked)) ||
      !(r.stepped === undefined || isStrings(r.stepped)) ||
      !(r.relics === undefined || isStrings(r.relics)) ||
      !(r.rescued === undefined || typeof r.rescued === 'boolean')
    )
      out.push('current.result');
  }
  if (v.phase === 'result' && v.result === undefined) out.push('current.result(결과 종이 도중이면 있다)');
  return out;
}

/** 저장 하나의 문제(빈 목록이면 제 꼴). 시험과 견본이 쓴다 */
export function checkSave5(v: unknown): string[] {
  if (!isObject(v)) return ['저장이 객체가 아니다'];
  const out: string[] = [];
  if (v.schema !== SAVE5_SCHEMA) out.push(`schema가 ${SAVE5_SCHEMA}가 아니다`);
  if (typeof v.build !== 'string') out.push('build');
  out.push(...heroProblems(v.hero));
  if (!isPurse(v.purse)) out.push('purse');
  if (!isStrings(v.items)) out.push('items');
  if (!(isObject(v.hub) && typeof v.hub.intro === 'boolean' && isStrings(v.hub.seen) && (v.hub.at === undefined || typeof v.hub.at === 'string'))) out.push('hub');
  if (!isObject(v.stories)) out.push('stories');
  else for (const [id, story] of Object.entries(v.stories)) for (const p of storyProblems(story)) out.push(`stories.${id}: ${p}`);
  if (v.current !== undefined) out.push(...currentProblems(v.current));
  if (!isObject(v.quiz)) out.push('quiz');
  else for (const [id, log] of Object.entries(v.quiz)) if (!quizProblems(log)) out.push(`quiz.${id}`);
  const t = v.today;
  if (!(isObject(t) && typeof t.date === 'string' && (t.date === '' || /^\d{4}-\d{2}-\d{2}$/.test(t.date)) && isCount(t.xp) && isCountMap(t.topics) && isCountMap(t.replays))) out.push('today');
  if (v.classCode !== undefined && typeof v.classCode !== 'string') out.push('classCode');
  if (!isStrings(v.unlocked)) out.push('unlocked');
  return out;
}

// ── 읽기 ────────────────────────────────────────────────────

/** 저장 글자를 읽는다(저장소를 건드리지 않는다) */
export function parseSave5(raw: string | null): Loaded5 {
  if (raw === null || raw === '') return { save: emptySave5(), status: 'empty' };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { save: emptySave5(), status: 'unreadable' };
  }
  if (!isObject(data) || typeof data.schema !== 'number' || !Number.isInteger(data.schema)) return { save: emptySave5(), status: 'unreadable' };
  if (data.schema > SAVE5_SCHEMA) return { save: emptySave5(), status: 'newer' };
  // 옛 꼴(1-가의 v1은 키가 달라 여기 오지 않는다. 2~4는 3판의 한 해 게임) — 옮기지 않는다
  if (data.schema < SAVE5_SCHEMA) return { save: emptySave5(), status: 'old', notice: OLD_NOTICE };

  // 꼴 5: 뼈대(주인공·돈·가진 것·거점·오늘·열린 것)가 어긋나면 읽을 수 없는 것으로 친다. 이야기·서당 기록·하던 에피소드는 하나씩 살린다
  const base = emptySave5();
  const skeleton = [...heroProblems(data.hero)];
  if (!isPurse(data.purse)) skeleton.push('purse');
  if (!isStrings(data.items)) skeleton.push('items');
  if (skeleton.length > 0) return { save: base, status: 'unreadable', dropped: skeleton };
  const dropped: string[] = [];
  const hub = isObject(data.hub) && typeof data.hub.intro === 'boolean' && isStrings(data.hub.seen) ? (data.hub as Save5['hub']) : (dropped.push('hub'), base.hub);
  const stories: Record<string, StoryRecord> = {};
  if (isObject(data.stories)) {
    for (const [id, story] of Object.entries(data.stories)) {
      if (storyProblems(story).length === 0) stories[id] = story as StoryRecord;
      else dropped.push(`stories.${id}`);
    }
  } else dropped.push('stories');
  const quiz: Record<string, QuizLog> = {};
  if (isObject(data.quiz)) {
    for (const [id, log] of Object.entries(data.quiz)) {
      if (quizProblems(log)) quiz[id] = log as QuizLog;
      else dropped.push(`quiz.${id}`);
    }
  } else dropped.push('quiz');
  const t = data.today;
  const today =
    isObject(t) && typeof t.date === 'string' && isCount(t.xp) && isCountMap(t.topics) && isCountMap(t.replays) ? (t as Save5['today']) : (dropped.push('today'), base.today);
  const save: Save5 = {
    schema: SAVE5_SCHEMA,
    build: typeof data.build === 'string' ? data.build : BUILD,
    hero: data.hero as Hero,
    purse: data.purse as Purse,
    items: data.items as string[],
    hub,
    stories,
    quiz,
    today,
    unlocked: isStrings(data.unlocked) ? data.unlocked : (dropped.push('unlocked'), []),
  };
  if (typeof data.classCode === 'string') save.classCode = data.classCode;
  if (data.current !== undefined && data.current !== null) {
    if (currentProblems(data.current).length === 0) {
      const cur = data.current as NonNullable<Save5['current']>;
      // 3판의 판은 3판의 읽기(parseGame)로 다듬어 넣는다(해 ☀의 울타리 등 — 3판 저장과 같은 셈)
      save.current = { ...cur, game: parseGame(cur.game)! };
    } else dropped.push('current');
  }
  return dropped.length > 0 ? { save, status: 'trimmed', dropped } : { save, status: 'ok' };
}

/**
 * 기기에서 읽는다. 다음 저장이 덮어쓰기 전에 읽기 전의 글자를 한 벌 남긴다: 옛 꼴이면 BACKUP_KEY, 꼴 5를 읽을 수 없거나 잘라 냈으면 BACKUP5_KEY.
 */
export function loadSave5(storage: StorageLike | null): Loaded5 {
  if (!storage) return { save: emptySave5(), status: 'noStorage' };
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { save: emptySave5(), status: 'noStorage' };
  }
  const loaded = parseSave5(raw);
  const slot = loaded.status === 'old' ? BACKUP_KEY : loaded.status === 'unreadable' || loaded.status === 'trimmed' ? BACKUP5_KEY : null;
  if (slot && raw !== null) {
    try {
      storage.setItem(slot, raw);
    } catch {
      // 한 벌 남기지 못해도 읽은 것은 쓴다
    }
  }
  return loaded;
}

// ── 쓰기 ────────────────────────────────────────────────────

/** 한 칸의 크기(바이트, UTF-8) */
export function saveBytes(save: Save5 | string): number {
  const text = typeof save === 'string' ? save : JSON.stringify(save);
  return new TextEncoder().encode(text).length;
}

/** 쓸 글자(꼴 번호와 판 번호를 붙여서) */
export function serializeSave5(save: Save5, build: string = BUILD): string {
  return JSON.stringify({ ...save, schema: SAVE5_SCHEMA, build });
}

/** 기기에 쓴다. 저장이 안 되는 창이면 'noStorage', 한 칸 100KB를 넘으면 쓰지 않고 'tooBig', 쓰다가 막히면 'failed' */
export function writeSave5(save: Save5, storage: StorageLike | null, build: string = BUILD): { ok: boolean; bytes: number; why?: 'noStorage' | 'tooBig' | 'failed' } {
  const text = serializeSave5(save, build);
  const bytes = saveBytes(text);
  if (!storage) return { ok: false, bytes, why: 'noStorage' };
  if (bytes > SAVE_LIMIT) return { ok: false, bytes, why: 'tooBig' };
  try {
    storage.setItem(SAVE_KEY, text);
    return { ok: true, bytes };
  } catch {
    return { ok: false, bytes, why: 'failed' };
  }
}

/** 이어 하기의 자리: 하던 에피소드가 없으면 거점, 겨루기 도중이었으면 그 겨루기의 처음부터(5.8) */
export function resumeAt(save: Save5): 'hub' | 'field' | 'battle' | 'result' {
  return save.current?.phase ?? 'hub';
}

// ── 반·은행 칸(저장 한 칸과 따로 — 5.8) ──────────────────────────

/** 따로 둔 칸을 읽는다(없거나 읽을 수 없으면 null) */
export function readSlot<T = unknown>(storage: StorageLike | null, key: string): T | null {
  if (key === SAVE_KEY || key === BACKUP_KEY || key === BACKUP5_KEY) throw new Error('저장 칸은 loadSave5로 읽는다');
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** 따로 둔 칸에 쓴다(반 코드로 받은 것 — CLASS_KEY, 받아 둔 주제 — BANK_KEY_PREFIX + 주제 id) */
export function writeSlot(storage: StorageLike | null, key: string, value: unknown): boolean {
  if (key === SAVE_KEY || key === BACKUP_KEY || key === BACKUP5_KEY) throw new Error('저장 칸은 writeSave5로 쓴다');
  if (!(key === CLASS_KEY || key.startsWith(BANK_KEY_PREFIX))) throw new Error(`모르는 칸 "${key}"`);
  try {
    storage?.setItem(key, JSON.stringify(value));
    return Boolean(storage);
  } catch {
    return false;
  }
}

/** 이야기 하나의 기록 가운데 에피소드 하나(없으면 처음 꼴) */
export function episodeRecord(save: Save5, story: string, episode: string): EpisodeRecord {
  return save.stories[story]?.episodes[episode] ?? { stars: [false, false, false], best: 0, plays: 0, cleared: false };
}

/** "처음부터"(화면이 두 번 물은 뒤): 저장 칸과 꼴 5의 한 벌을 지운다. 옛 꼴(3판)의 한 벌(BACKUP_KEY)은 남긴다 — 4판의 기록과 상관없는 3판의 사본이다 */
export function wipeSave5(storage: StorageLike | null): void {
  try {
    storage?.removeItem(SAVE_KEY);
    storage?.removeItem(BACKUP5_KEY);
  } catch {
    // 지우지 못해도 화면은 처음으로 간다
  }
}
