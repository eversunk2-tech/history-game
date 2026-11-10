// 화면 상태(signals)와 기기 저장(꼴 5 — save5.ts). 규칙은 모두 engine에 있고, 여기서는 차례만 잇는다.
//
// 화면 차례(4판의 출전 고리 — spec 11.1 가의 1~16. ㉢은 거점이 임시 마을 종이다):
//   제목 → (처음이면) 모습 고르기 → 마을 소개(정령 느티) → 거점(임시 마을 종이)
//   거점 → 알림판 · 시간의 문(연표) → 출전 준비(집 뽑기·모습·카드·장비) → 의뢰 소개 → 현장(봄의 맵 — 대화 장면·미션이 풀림·봇짐·지난 이야기가 얹힌다)
//   현장의 볍씨 뿌리기 앞 → 작은 고비 「굳은 논흙」(대화 장면 안의 짧은 겨루기) → 볍씨 뿌리기 놀이
//   "큰 고비로" → 큰 고비 「도깨비의 내기」(겨루기 화면) → 결과 종이 → (레벨이 올랐으면) 자람 → 거점. 연표에서 다시 하기.
// 엔진은 약속이 깨지면 던진다. 던진 것이 화면까지 올라가면 빈 화면이 되므로, 여기서 모두 받아 '이어 갈 수 없어요'(trouble)로 보낸다.
//
// 저절로 저장하는 때(spec 5.8): 대화·놀이·겨루기를 마치고 맵이나 마을로 돌아올 때, 미션이 풀릴 때, 에피소드가 끝날 때, 화면이 가려질 때.
// 도중에 끄고 켜면 맵의 그 자리에서(대화·놀이·겨루기 도중이었으면 그 일의 처음부터 — 겨루기 안의 것은 저장하지 않는다).
// 보류한 3판 한 해 길(계절 넘기기·한 해 돌아보기)은 부르지 않는다(spec 11.1 가 — 소스 검사 시험이 묶는다).

import { computed, signal } from '@preact/signals';
import { cards as allCards, four, getPack, items as allItems } from '../content';
import { gear as allGear } from '../content/gear';
import { spirit } from '../content/hub';
import { plan as s1395Plan } from '../content/episodes/s1395';
import { battleResult, type Battle, type BattleSetup } from '../engine/battle';
import { introGift, addPurse } from '../engine/economy';
import {
  battleSetupFor,
  beginEpisode,
  canBoss,
  doField,
  fieldPack,
  finishEpisode,
  minorBefore,
  minorDone,
  startField,
  toBoss,
  toResult,
  type Current,
  type EpisodePaper,
} from '../engine/episode';
import { doHappening, lastDeed, openHappenings, playableRoles, roleOf, type DoInput } from '../engine/game';
import { LEVEL_CAP_41, placePoint } from '../engine/growth';
import { battleAsk, recordAnswers } from '../engine/quiz';
import { subSeed } from '../engine/rng';
import { SEASONS, type Deed, type GameState, type Look, type RoleId, type Season, type SituationPack } from '../engine/types';
import type { CardKind, Episode, MinorDef, Question, Save5, StoryPlan } from '../engine/types4';
import { BACKUP5_KEY, SAVE_KEY, emptySave5, loadSave5, resumeAt, wipeSave5, writeSave5, type Load5Status } from './save5';
import { browserStorage, pruneGame, requestPersist } from './storage';

export type Screen =
  | 'title'
  | 'look'
  | 'hubIntro'
  | 'hub'
  | 'board'
  | 'gate'
  | 'prep'
  | 'intro'
  | 'map'
  | 'battle'
  | 'result'
  | 'growth'
  | 'trouble'
  | 'sheet';

/** 에피소드 표(4-1은 ①의 표 하나 — 4-3에서 이야기를 더하면 여기에 더한다) */
export const PLANS: readonly StoryPlan[] = [s1395Plan];

export function episodeOf(id: string | null | undefined): Episode | undefined {
  if (!id) return undefined;
  for (const plan of PLANS) {
    const found = plan.episodes.find((ep) => ep.id === id);
    if (found) return found;
  }
  return undefined;
}

const disk = browserStorage();
const loaded = loadSave5(disk);

export const screen = signal<Screen>('title');
/** 지금 하는 에피소드의 이야기 id(거점에서는 null) */
export const situationId = signal<string | null>(null);
/** 지금 하는 에피소드 id(거점에서는 null) */
export const episodeId = signal<string | null>(null);
/** 현장의 판(3판 GameState — 하던 에피소드의 current.game) */
export const game = signal<GameState | null>(null);
/** 하던 에피소드에서 판 밖의 것(current에서 game·walked·papers를 뺀 것 — 저장할 때 다시 합친다) */
export const run = signal<Omit<Current, 'game' | 'walked' | 'papers'> | null>(null);
/** 이번 판의 씨앗(출전 준비가 정한다). 집 뽑기와 현장·겨루기의 씨앗이 여기서 나온다 */
export const seed = signal<number>(0);
export const save = signal<Save5>(loaded.save);
/** 저장을 읽은 결과(제목 화면이 쉬운 말로 알린다) */
export const loadStatus = signal<Load5Status>(loaded.status);
/** 저장이 실패했는가(공간 없음, 막힌 창, 한 칸 100KB 넘음). 위쪽 띠에 한 줄로 알린다. */
export const saveFailed = signal(false);
/** "처음 화면으로 돌아갈까요?"를 묻는 중인가 */
export const askingHome = signal(false);
/** 출전 준비에서 고르는 에피소드와 다시 하기인가 */
export const prepFor = signal<{ episode: string; replay: boolean } | null>(null);
/** [개발 판] ?field=summer 같은 보류한 계절 보기(저장하지 않는다) */
export const devField = signal<Season | null>(null);
/** [개발 판] 보류한 계절 보기의 묶음(그 계절의 꼭 할 일·덤만) */
let devPack: SituationPack | null = null;

/** 맵 위에 얹힌 대화 장면: 지금 하고 있는 일(Happening)의 id. 없으면 null. */
export const talk = signal<string | null>(null);
/** "미션이 풀림" 종이로 보여 줄 미션의 id들(앞에서부터 하나씩 보인다) */
export const missionQueue = signal<string[]>([]);
/** 맵 위에 얹힌 작은 창: 봇짐 · 지난 이야기 */
export const panel = signal<'bag' | 'past' | null>(null);
/** 이 창에서 몇 번째로 연 판인가. 새 판을 만들 때마다 하나씩 는다(맵 화면이 들고 있던 앞 판의 자리를 버리게 한다) */
export const gameNo = signal(0);
/** 그림 견본 화면의 계절(개발용) */
export const artSeason = signal<Season>('spring');

/** 지금의 에피소드 */
export const episode = computed<Episode | undefined>(() => episodeOf(episodeId.value));
/** 이야기 묶음(에피소드가 고르지 않은 일까지 모두) */
export const storyPack = computed<SituationPack | null>(() => (situationId.value ? (getPack(situationId.value) ?? null) : null));
/**
 * 현장이 쓰는 묶음: 에피소드의 일만 담은 묶음(engine/episode의 fieldPack). 맵·대화 장면·할 일 쪽지·띠가 이것을 읽으므로
 * 에피소드가 고르지 않은 일(여름의 일 등)은 맵에 열리지 않는다(spec 11.1 가 "쓰지 않는 길을 막는 법" ②).
 */
export const pack = computed<SituationPack | null>(() => {
  const p = storyPack.value;
  const ep = episode.value;
  if (!p) return null;
  if (devField.value && devPack) return devPack;
  return ep ? fieldPack(p, ep) : p;
});

/** 이어 할 것이 있는가(제목의 "이어 하기"): 하던 에피소드가 있거나 마을에 들어선 적이 있다 */
export const canContinue = computed<boolean>(() => {
  const s = save.value;
  if (s.current) return Boolean(episodeOf(s.current.episode) && getPack(s.current.game.situationId));
  return s.hub.intro;
});

/** 맵 위에 무언가 얹혀 있어 걷기를 멈춰야 하는가 */
export const mapBusy = computed<boolean>(() => talk.value !== null || missionQueue.value.length > 0 || panel.value !== null || askingHome.value);

/** 맵에서 쓰는 주인공 그림의 이름('farmer-boy', 'daughter' …) */
export function heroName(role: RoleId, look: Look): string {
  if (role === 'son' || role === 'daughter') return role;
  return `${role}-${look}`;
}

/** 오늘(기기의 날짜 — 5.6의 6번). Save5.today.date의 꼴 */
export function todayDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ── 씨앗 ────────────────────────────────────────────────────

/** 주소에 ?seed=숫자 를 붙이면 그 씨앗으로 판을 만든다(같은 판을 다시 보려고 둔 것). */
function seedFromUrl(): number | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('seed');
    if (raw === null || raw.trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value >>> 0 : null;
  } catch {
    return null;
  }
}

function freshSeed(): number {
  return seedFromUrl() ?? (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
}

// ── 연달아 누르기 막기 ─────────────────────────────────────────
// 화면이 바뀐 바로 뒤 0.3초 동안은 누름을 받지 않는다("다음"을 두 번 두드려 다음 화면의 단추가 잘못 눌리는 일을 막는다).

const TAP_GAP_MS = 300;
let lastMove = 0;

function tooSoon(): boolean {
  const now = Date.now();
  if (now - lastMove < TAP_GAP_MS) return true;
  lastMove = now;
  return false;
}

function moveTo(next: Screen): void {
  lastMove = Date.now();
  screen.value = next;
}

// ── 저장 ─────────────────────────────────────────────────────

/** 맵 화면이 알려 주는 것: 가 본 칸을 묶은 글자(저장할 때 함께 적는다). 빈 글자는 "아직 아무 데도 가지 않았다"이다. */
let walkedNow: string = loaded.save.current?.walked ?? '';
/**
 * 풀렸지만 "미션이 풀림" 종이를 아직 닫지 않은 미션들(저장에 함께 적는다).
 * 일을 마치는 순간부터 종이를 닫을 때까지 여기 남아 있어, 그사이에 화면을 덮어도 다음에 이어 하면 종이가 뜬다.
 */
let owed: string[] = [];
/** 이어 가다 멈춘 횟수(일을 하나 마치면 0으로 돌아간다). 같은 저장으로 거듭 멈추면 하던 에피소드를 내려놓는다. */
let troubles = 0;

function persist(next: Save5): void {
  save.value = next;
  if (devField.value) return; // 보류한 계절 보기(개발 판)는 저장하지 않는다
  // 코드보다 새 꼴의 저장(새 판이 쓴 것)은 건드리지 않는다(5.8). 화면이 가려질 때·창을 닫을 때(saveNow)도 이 길을 지나므로 여기서 막는다
  if (loadStatus.value === 'newer') return;
  saveFailed.value = !writeSave5(next, disk).ok;
}

/** 지금 하던 에피소드(현장의 판 + 판 밖의 것)를 저장의 current 꼴로 */
function currentNow(): Current | undefined {
  const g = game.value;
  const r = run.value;
  if (!g || !r) return undefined;
  const out: Current = { ...r, game: g };
  if (walkedNow) out.walked = walkedNow;
  if (owed.length > 0) out.papers = [...owed];
  return out;
}

/** 지금의 판을 기기에 적는다(하던 에피소드가 없으면 거점의 것만) */
export function saveNow(): void {
  const cur = currentNow();
  const next: Save5 = { ...save.value };
  if (cur) next.current = cur;
  persist(next);
}

/** 맵 화면이 부른다: 서 있는 칸("칸,칸"), 가 본 구역, 가 본 칸을 묶은 글자. 저장은 하지 않는다(가려질 때·일을 마칠 때 한다). */
export function markPlace(at: string, seen: readonly string[], walked?: string): void {
  const g = game.value;
  if (!g) return;
  if (walked !== undefined) walkedNow = walked;
  if (g.at === at && g.seen.length === seen.length) return;
  game.value = { ...g, at, seen: [...seen] };
}

/** 가 본 칸을 묶은 글자(이어 할 때 맵 화면이 읽는다). 새 판에는 비어 있다. */
export function walkedText(): string {
  return walkedNow;
}

// 옛 꼴(3판)의 저장을 읽었으면: 옛 글자는 loadSave5가 joseon-year/backup에 한 벌 남겼다. 처음부터의 저장을 바로 적어
// "게임이 새로워져서 처음부터 해요"가 한 번만 뜨게 한다(다음에 켜면 새 꼴의 저장이 읽힌다).
if (loaded.status === 'old') persist(emptySave5());

// 화면이 가려질 때 저장한다(태블릿을 덮거나 다른 앱으로 갈 때). beforeunload에는 기대지 않는다.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('pagehide', () => saveNow());
}

// ── 이어 갈 수 없을 때 ─────────────────────────────────────────

function report(error: unknown): void {
  // 만드는 사람이 까닭을 볼 수 있게 콘솔에 남긴다. 학생에게는 화면의 쉬운 말만 보인다.
  console.error('[조선에서 한 해 살기] 이야기를 이어 갈 수 없다:', error);
}

function clearOverlays(): void {
  askingHome.value = false;
  talk.value = null;
  missionQueue.value = [];
  panel.value = null;
}

/** 엔진이 던졌을 때: 빈 화면 대신 '이어 갈 수 없어요' 화면으로 간다. 거기서 처음으로 갈 수 있다. */
function fail(error: unknown): void {
  report(error);
  troubles += 1;
  clearOverlays();
  screen.value = 'trouble';
}

/** 화면을 그리다 멈췄을 때 App이 알린다(같은 저장으로 거듭 멈추는지 센다) */
export function noteTrouble(): void {
  troubles += 1;
}

/** 하던 에피소드를 비운다(화면의 판도). 저장은 부르는 쪽이 한다 */
function dropRun(): void {
  owed = [];
  walkedNow = '';
  clearOverlays();
  game.value = null;
  run.value = null;
  situationId.value = null;
  episodeId.value = null;
  devField.value = null;
}

/**
 * 하던 에피소드를 이어 갈 수 없을 때: 그것만 내려놓고(주인공·돈·깬 기록·서당 기록은 그대로) 제목에서 쉬운 말로 알린다.
 * 내려놓기 전의 저장은 꼴 5의 한 벌(BACKUP5_KEY)에 남긴다.
 */
function loseRun(): void {
  try {
    const raw = disk?.getItem(SAVE_KEY);
    if (raw) disk?.setItem(BACKUP5_KEY, raw);
  } catch {
    // 남기지 못해도 게임은 그대로 된다
  }
  dropRun();
  const { current, ...rest } = save.value;
  void current;
  persist(rest);
  loadStatus.value = 'trimmed';
  troubles = 0;
  moveTo('title');
}

// ── 제목 ────────────────────────────────────────────────────

/** 제목 → 처음부터. 화면이 먼저 두 번 묻고(기록이 있으면) 부른다: 저장을 지우고 모습 고르기로 */
export function startFresh(): void {
  if (tooSoon()) return;
  wipeSave5(disk);
  dropRun();
  gameNo.value += 1;
  const fresh = emptySave5();
  save.value = fresh;
  loadStatus.value = 'empty';
  saveFailed.value = false;
  screen.value = 'look';
}

/** 제목 → 이어 하기: 하던 에피소드가 있으면 그 자리(현장 — 서 있던 칸 · 겨루기 — 그 겨루기의 처음부터 · 결과 종이), 없으면 거점 */
export function continueGame(): void {
  if (tooSoon()) return;
  const s = save.value;
  const cur = s.current;
  if (!cur) {
    if (s.hub.intro) screen.value = 'hub';
    return;
  }
  try {
    const ep = episodeOf(cur.episode);
    const p = ep ? getPack(cur.game.situationId) : undefined;
    if (!ep || !p || ep.story !== p.situation.id) throw new Error(`이어 갈 수 없는 에피소드다: ${cur.episode}`);
    const role = p.situation.roles.find((r) => r.id === cur.game.role);
    if (!role || !role.looks.includes(cur.game.look)) throw new Error(`이어 갈 수 없는 역할이나 모습이다: ${cur.game.role}/${cur.game.look}`);
    const fp = fieldPack(p, ep);
    // 새 판에서 없어진 일·미션·카드·물건이 저장에 있으면 그 항목만 버린다
    let kept = pruneGame(cur.game, {
      happenings: new Set(p.happenings.map((h) => h.id)),
      missions: new Set(p.missions.map((m) => m.id)),
      cards: new Set(allCards.map((c) => c.id)),
      items: new Set(allItems.map((i) => i.id)),
    });
    // 남은 해 ☀는 에피소드의 해에서 이번 판에 쓴 해를 뺀 것을 넘지 못한다(띠에 "3/2"처럼 뜨지 않게)
    const used = kept.history.reduce((sum, deed) => sum + deed.sun, 0);
    const cap = Math.max(0, ep.suns - used);
    if (kept.sunsLeft > cap) kept = { ...kept, sunsLeft: cap };
    // 그 판으로 화면을 그릴 수 있는지 미리 본다(엔진이 던지면 여기서 잡힌다)
    openHappenings(fp, kept);
    canBoss(p, ep, kept);
    situationId.value = p.situation.id;
    episodeId.value = ep.id;
    seed.value = kept.seed;
    game.value = kept;
    const { game: _g, walked, papers, ...rest } = cur;
    void _g;
    run.value = rest;
    walkedNow = walked ?? '';
    clearOverlays();
    gameNo.value += 1;
    // 닫지 못한 "미션이 풀림" 종이가 있으면 맵에 들어서자마자 뜬다
    owed = (papers ?? []).filter((id) => kept.solved.includes(id) && fp.missions.some((m) => m.id === id));
    const at = resumeAt(s);
    if (at === 'field') {
      missionQueue.value = owed;
      screen.value = 'map';
    } else if (at === 'battle') screen.value = 'battle';
    else screen.value = 'result';
  } catch (error) {
    report(error);
    loseRun();
  }
}

// ── 모습 고르기 · 마을 소개 · 거점 ──────────────────────────────────

/** 모습 고르기(거점의 주인공 — 남자아이·여자아이) → 처음이면 마을 소개, 아니면 거점. "시험 판" 알림은 이때 본 것으로 적는다 */
export function pickLook(look: Look): void {
  if (tooSoon()) return;
  const s = save.value;
  const seen = s.hub.seen.includes('trial') ? s.hub.seen : [...s.hub.seen, 'trial'];
  persist({ ...s, hero: { ...s.hero, look }, hub: { ...s.hub, seen } });
  screen.value = s.hub.intro ? 'hub' : 'hubIntro';
}

/** 마을 소개를 마친다(건너뛰어도 첫 선물은 받는다): 돈 주머니 쌀 3되·베 2자, 창고의 도리깨 → 거점 */
export function finishHubIntro(): void {
  if (tooSoon()) return;
  const s = save.value;
  if (!s.hub.intro) {
    const items = [...s.items, ...spirit.giftItems.filter((id) => !s.items.includes(id))];
    persist({ ...s, purse: addPurse(s.purse, introGift()), items, hub: { ...s.hub, intro: true } });
  }
  requestPersist();
  screen.value = 'hub';
}

/** 거점의 시설을 연다(㉢의 임시 마을 종이는 시간의 문·알림판만) */
export function openFacility(id: 'gate' | 'board'): void {
  if (tooSoon()) return;
  screen.value = id;
}

export function backToHub(): void {
  if (tooSoon()) return;
  prepFor.value = null;
  screen.value = 'hub';
}

// ── 시간의 문 → 출전 준비 → 의뢰 소개 ────────────────────────────────

/** 그 에피소드를 할 수 있는가(4-1은 ①-1만 — 에피소드 표에 있는 것, 묶음과 역할이 있는 것) */
export function episodeOpen(id: string): boolean {
  const ep = episodeOf(id);
  const p = ep ? getPack(ep.story) : undefined;
  return Boolean(ep && p && playableRoles(p).length > 0);
}

/** 연표에서 에피소드를 고른다 → 출전 준비. replay = 깬 에피소드를 다시 한다 */
export function openPrep(id: string, replay: boolean): void {
  if (!episodeOpen(id)) return;
  const ep = episodeOf(id) as Episode;
  if (replay && !save.value.stories[ep.story]?.episodes[id]?.cleared) return;
  if (tooSoon()) return;
  prepFor.value = { episode: id, replay };
  seed.value = freshSeed();
  screen.value = 'prep';
}

/** 출전 준비에서 집·모습·장비를 정했다 → 의뢰 소개. 여기서 하던 에피소드가 생기고 처음 저장한다 */
export function settleRun(roleIn: RoleId, lookIn: Look, hand: string | undefined): void {
  let role = roleIn;
  let look = lookIn;
  const prep = prepFor.value;
  const ep = episodeOf(prep?.episode);
  const p = ep ? getPack(ep.story) : undefined;
  if (!prep || !ep || !p) return;
  // 이야기를 이미 시작했으면(다시 하기·뒤 에피소드) 그 이야기의 역할·모습으로 이어 간다(7.6 — 집을 다시 뽑지 않는다)
  const known = save.value.stories[ep.story];
  if (known) {
    role = known.role;
    look = known.look;
  }
  if (!playableRoles(p).includes(role) || !roleOf(p, role).looks.includes(look)) return; // 준비 중인 집
  // 장비는 가진 것에서, 그 이야기에 가져갈 수 있는 것만(도리깨는 ①에 잠긴다 — 5.5)
  const tool = hand ? allGear.find((g) => g.id === hand) : undefined;
  if (hand && (!tool || !save.value.items.includes(hand) || !tool.eras.includes(ep.story))) return;
  if (tooSoon()) return;
  try {
    const s = save.value;
    const story = s.stories[ep.story];
    const current = beginEpisode(p, ep, { role, look, seed: seed.value, story, replay: prep.replay });
    situationId.value = ep.story;
    episodeId.value = ep.id;
    game.value = current.game;
    const { game: _g, ...rest } = current;
    void _g;
    run.value = rest;
    walkedNow = '';
    owed = [];
    clearOverlays();
    gameNo.value += 1;
    persist({ ...s, hero: { ...s.hero, gear: { ...s.hero.gear, hand: tool?.id } }, current });
    prepFor.value = null;
    screen.value = 'intro';
  } catch (error) {
    fail(error);
  }
}

/** 의뢰 소개 → 현장(봄의 맵) */
export function beginField(): void {
  if (!game.value) return;
  if (tooSoon()) return;
  requestPersist();
  saveNow();
  screen.value = 'map';
}

// ── 현장 ─────────────────────────────────────────────────────

/** 맵에서 자리에 닿아 일을 연다(대화 장면이 맵 위에 얹힌다) */
export function openTalk(happeningId: string): void {
  if (!game.value || talk.value !== null) return;
  panel.value = null;
  talk.value = happeningId;
}

/** 그 일에서 먼저 넘길 짧은 겨루기(아직 마치지 않은 것). 대화 장면이 고른 뒤·놀이 앞에서 묻는다 */
export function minorPending(happeningId: string): MinorDef | undefined {
  const ep = episode.value;
  const r = run.value;
  if (!ep || !r) return undefined;
  return minorBefore(ep, happeningId, r.minors);
}

/**
 * 대화 장면이 부른다: 고른 선택지와 놀이의 끝난 모습을 넘겨 일을 마친다.
 * 결과(Deed)를 돌려주고, 대화 장면은 그것으로 결과 대화·수치 변화·쪽지를 보여 준다. 이어 갈 수 없으면 null.
 */
export function commitTalk(input: DoInput): Deed | null {
  const p = storyPack.value;
  const ep = episode.value;
  const g = game.value;
  const r = run.value;
  if (!p || !g) return null;
  try {
    let next: GameState;
    if (ep && r) {
      const cur = doField(p, ep, { ...r, game: g }, input);
      next = cur.game;
      run.value = { ...r, minors: cur.minors };
    } else {
      // 보류한 계절 보기(개발 판 — 에피소드 없이 그 계절의 일만 담은 묶음)
      next = doFieldDev(input, g);
    }
    const deed = lastDeed(next);
    // 이 일로 풀린 미션의 종이는 닫을 때까지 빚으로 적어 둔다(결과를 보다가 화면을 덮어도 다음에 뜬다)
    if (deed && deed.solved.length > 0) owed = [...owed, ...deed.solved.filter((id) => !owed.includes(id))];
    troubles = 0;
    game.value = next;
    saveNow();
    return deed;
  } catch (error) {
    fail(error);
    return null;
  }
}

/** 대화 장면을 닫고 맵으로 돌아온다. 그 일로 풀린 미션이 있으면 "미션이 풀림" 종이가 뜬다. */
export function closeTalk(): void {
  talk.value = null;
  lastMove = Date.now();
  missionQueue.value = owed;
  saveNow();
}

/** "미션이 풀림" 종이를 한 장 넘긴다 */
export function closeMissionDone(): void {
  if (tooSoon()) return;
  owed = owed.slice(1);
  missionQueue.value = owed;
  saveNow();
}

export function openPanel(which: 'bag' | 'past'): void {
  if (talk.value !== null) return;
  panel.value = panel.value === which ? null : which;
}

export function closePanel(): void {
  panel.value = null;
}

/** "큰 고비로"가 뜨는가 = 꼭 할 일을 다 했다(3판 canCloseSeason을 에피소드의 일만 담은 묶음으로) */
export const bossReady = computed<boolean>(() => {
  const p = storyPack.value;
  const ep = episode.value;
  const g = game.value;
  return Boolean(p && ep && g && canBoss(p, ep, g));
});

/** "큰 고비로": 꼭 할 일을 다 했을 때만 된다 → 겨루기 화면(저장에는 phase 'battle'만 — 끄면 그 겨루기의 처음부터) */
export function goBoss(): void {
  const p = storyPack.value;
  const ep = episode.value;
  const g = game.value;
  const r = run.value;
  if (!p || !ep || !g || !r || !canBoss(p, ep, g)) return;
  if (tooSoon()) return;
  try {
    const cur = toBoss(p, ep, { ...r, game: g });
    run.value = { ...r, phase: cur.phase };
    owed = [];
    clearOverlays();
    saveNow();
    screen.value = 'battle';
  } catch (error) {
    fail(error);
  }
}

// ── 겨루기 ───────────────────────────────────────────────────

/** 겨루기에 내는 문제(이야기 문제 + 서당 은행). ㉢에는 지도에서 찍기의 창이 없어 그 꼴은 내지 않는다(㉣) */
export function battleQuestions(): Question[] {
  return four.questions.filter((q) => q.form !== 'map');
}

export interface BattleKit {
  setup: BattleSetup;
  ask: ReturnType<typeof battleAsk>;
  questions: Question[];
}

/** 큰 고비('boss') 또는 짧은 겨루기(MinorDef)의 준비: 덱·능력치·장비·기운(현장의 기력)·씨앗, 문제 고르개(이 판에서 한 일을 먼저) */
export function battleKit(target: 'boss' | MinorDef): BattleKit | null {
  const ep = episode.value;
  const g = game.value;
  if (!ep || !g) return null;
  const s = save.value;
  const setup = battleSetupFor({ foes: four.foes, cards: four.skills, gear: allGear }, ep, target, { hero: s.hero, game: g });
  const questions = battleQuestions();
  const earlier = PLANS.find((plan) => plan.story === ep.story)?.episodes.filter((e) => e.order < ep.order).map((e) => e.storyTopic) ?? [];
  const ask = battleAsk({
    questions,
    logs: s.quiz,
    episode: ep,
    earlier,
    done: g.history.map((d) => d.happeningId),
    seed: subSeed(setup.seed, 'ask'),
  });
  return { setup, ask, questions };
}

/** 짧은 겨루기를 마쳤다(넘김·구해 줌·마무리 모두 넘긴 것): 낸 문제를 서당 기록에 적고, 그 작은 고비를 마친 것으로 적는다 */
export function finishMinor(minor: MinorDef, b: Battle): void {
  const r = run.value;
  const g = game.value;
  if (!r || !g) return;
  try {
    const cur = minorDone({ ...r, game: g }, minor.id);
    run.value = { ...r, minors: cur.minors };
    const quiz = recordAnswers(save.value.quiz, b.asked, battleQuestions());
    save.value = { ...save.value, quiz };
    troubles = 0;
    saveNow();
  } catch (error) {
    fail(error);
  }
}

/** 이번 판에 가 본 자리·만난 사람(도감 몫 — 처음 가 본 구역과 대화 장면에 선 사람) */
export function metOf(p: SituationPack, g: GameState): string[] {
  const out = new Set<string>(g.seen.map((z) => `zone:${z}`));
  for (const deed of g.history) {
    const h = p.happenings.find((x) => x.id === deed.happeningId);
    for (const c of h?.stage.cast ?? []) out.add(`who:${c.who}`);
  }
  return [...out];
}

/** 결과 종이가 그리는 것(엔진 finishEpisode의 종이 — 다 보기 전에 끈 때는 current.result에서 다시 짓는다) */
export const paper = signal<EpisodePaper | null>(null);

/**
 * 큰 고비가 끝났다(넘김·구해 줌·해거름 — 끝의 말을 다 보인 뒤): 결과를 셈해 주인공·돈·가진 것·이야기의 기록·서당 기록을 적고
 * 하던 에피소드를 결과 종이(phase 'result')로 → 결과 종이
 */
export function finishBoss(b: Battle): void {
  const p = storyPack.value;
  const ep = episode.value;
  const g = game.value;
  const r = run.value;
  const result = battleResult(b);
  if (!p || !ep || !g || !r || !result) return;
  try {
    const s = save.value;
    const out = finishEpisode({
      episode: ep,
      replay: r.replay,
      game: g,
      minors: r.minors,
      boss: result,
      hero: s.hero,
      purse: s.purse,
      items: s.items,
      story: s.stories[ep.story],
      met: metOf(p, g),
      today: s.today,
      date: todayDate(),
      cap: LEVEL_CAP_41,
    });
    const quiz = recordAnswers(s.quiz, b.asked, battleQuestions());
    const cur = toResult({ ...r, game: g }, out.paper);
    run.value = { ...r, phase: 'result', result: cur.result };
    paper.value = out.paper;
    owed = [];
    persist({ ...s, hero: out.hero, purse: out.purse, items: out.items, stories: { ...s.stories, [ep.story]: out.story }, today: out.today, quiz, current: { ...cur, walked: walkedNow || undefined } });
    troubles = 0;
    // 겨루기 끝의 말을 넘긴 누름이 결과 종이의 첫 누름이 되지 않게 다른 화면처럼 moveTo로(0.3초 막음 — 권고 ㅊ)
    moveTo('result');
  } catch (error) {
    fail(error);
  }
}

/** 결과 종이에 그릴 것: 방금 셈한 종이, 없으면(이어 하기로 들어옴) current.result에서 */
export function paperNow(): EpisodePaper | null {
  if (paper.value) return paper.value;
  const res = run.value?.result;
  if (!res) return null;
  const stepped = res.stepped ?? [];
  return {
    first: res.first ?? true,
    stars: res.stars,
    newStars: res.newStars ?? res.stars,
    score: res.score,
    best: res.best ?? res.score,
    bestNew: res.bestNew ?? false,
    xp: res.xp,
    levels: res.levels ?? 0,
    banked: res.banked ?? 0,
    purse: res.purse,
    cards: res.cards.filter((id) => !stepped.includes(id)),
    stepped,
    relics: res.relics ?? [],
    rescued: res.rescued ?? !res.stars[1],
    bodyLoss: 0,
  };
}

/** 결과 종이를 닫는다(정령의 물음을 "생각해 봤어요"로 넘긴 뒤): 둘 능력치 점이 있으면 자람, 없으면 거점 */
export function closeResult(): void {
  if (tooSoon()) return;
  if (save.value.hero.points > 0) {
    screen.value = 'growth';
    return;
  }
  leaveEpisode();
}

/** 자람: 능력치 점 하나를 둔다(하나에 15까지) */
export function placeStat(kind: CardKind): void {
  if (tooSoon()) return;
  try {
    const s = save.value;
    persist({ ...s, hero: placePoint(s.hero, kind) });
  } catch (error) {
    report(error);
  }
}

/** 에피소드를 마치고 거점으로(하던 에피소드를 비운다) */
export function leaveEpisode(): void {
  dropRun();
  paper.value = null;
  gameNo.value += 1;
  const { current, ...rest } = save.value;
  void current;
  persist(rest);
  moveTo('hub');
}

// ── 처음으로 ───────────────────────────────────────────────────

export function askHome(): void {
  askingHome.value = true;
}

export function cancelHome(): void {
  askingHome.value = false;
}

/** 처음 화면으로. 하던 에피소드는 저장되어 있어 "이어 하기"로 돌아올 수 있다. */
export function goHome(): void {
  // 같은 저장으로 거듭 멈췄으면 하던 에피소드를 내려놓는다("이어 하기 → 멈춤 → 처음으로"가 되풀이되지 않게)
  if (troubles >= 2) {
    loseRun();
    return;
  }
  if (devField.value) {
    dropRun();
  } else {
    saveNow();
    owed = [];
    clearOverlays();
    game.value = null;
    run.value = null;
    situationId.value = null;
    episodeId.value = null;
  }
  paper.value = null;
  prepFor.value = null;
  moveTo('title');
}

export function backToTitle(): void {
  if (tooSoon()) return;
  goHome();
}

export function goSheet(): void {
  if (tooSoon()) return;
  screen.value = 'sheet';
}

// ── 개발 판의 길(빌드에는 들지 않는다 — import.meta.env.DEV) ─────────────────────

/** 보류한 계절 보기의 일 하나(그 계절의 일만 담은 묶음으로 — 저장하지 않는다) */
function doFieldDev(input: DoInput, g: GameState): GameState {
  if (!devPack) throw new Error('보류한 계절 보기가 아니다');
  return doHappening(devPack, g, input);
}

/** 그 계절의 꼭 할 일·덤을 담은 꾸민 에피소드(개발 판의 ?field= 길) */
function devEpisode(p: SituationPack, season: Season, role: RoleId): Episode {
  const base = s1395Plan.episodes[0];
  const missions = p.missions.filter((m) => m.must && m.season === season && (!m.roles || m.roles.includes(role))).map((m) => m.id);
  const parts = new Set(p.missions.flatMap((m) => [...m.parts, ...(m.rescue ? [m.rescue] : [])]));
  const extras = p.happenings.filter((h) => h.season === season && h.cost > 0 && !parts.has(h.id) && (!h.roles || h.roles.includes(role))).map((h) => h.id);
  return { ...base, id: `dev-${season}`, season, missions, extras, minors: [], skills: [], suns: roleOf(p, role).suns };
}

/**
 * 주소로 바로 들어가기(만드는 사람이 화면을 찍어 볼 때 쓴다. 개발 서버에서만 먹는다 — 빌드본에서는 맨 앞에서 돌아간다).
 *   ?view=sheet&season=autumn         그림 견본
 *   ?view=map&who=farmer-girl          ①-1의 현장에서 바로 시작(새 판, 거점은 그대로)
 *   ?view=map&who=farmer-boy&talk=s1395-spring-sow   그 일의 대화 장면을 바로 연다
 *   ?field=summer|autumn|winter&who=farmer-girl      보류한 계절의 맵을 저장하지 않고 열기만 한다(1-라 권고 ③④⑤⑧을 눈으로 — spec 11.1 가 ④)
 */
export function openFromUrl(): void {
  if (!import.meta.env.DEV) return;
  try {
    const q = new URLSearchParams(window.location.search);
    const view = q.get('view');
    const season = q.get('season') as Season | null;
    if (view === 'sheet') {
      if (season && SEASONS.includes(season)) artSeason.value = season;
      screen.value = 'sheet';
      return;
    }
    const [role, look] = (q.get('who') ?? 'farmer-boy').split('-') as [RoleId, Look | undefined];
    const field = q.get('field') as Season | null;
    const p = getPack('s1395');
    if (!p) return;
    if (field && SEASONS.includes(field) && field !== 'spring') {
      const ep = devEpisode(p, field, role);
      devPack = fieldPack(p, ep);
      devField.value = field;
      situationId.value = 's1395';
      episodeId.value = null;
      seed.value = freshSeed();
      game.value = startField(p, ep, { role, look: look === 'girl' ? 'girl' : 'boy', seed: seed.value });
      run.value = null;
      walkedNow = '';
      owed = [];
      gameNo.value += 1;
      screen.value = 'map';
      return;
    }
    if (view === 'map') {
      prepFor.value = { episode: 's1395-1', replay: false };
      seed.value = freshSeed();
      const s = save.value;
      if (!s.hub.intro) save.value = { ...s, hub: { ...s.hub, intro: true } };
      lastMove = 0;
      settleRun(role, look === 'girl' ? 'girl' : 'boy', undefined);
      screen.value = 'map';
      const first = q.get('talk');
      const g = game.value;
      const fp = pack.value;
      if (first && g && fp && openHappenings(fp, g).some((v) => v.happening.id === first && !v.noSun)) talk.value = first;
    }
  } catch (error) {
    report(error);
  }
}
