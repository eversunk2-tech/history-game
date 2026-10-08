// 화면 상태(signals)와 기기 저장. 규칙은 모두 engine에 있고, 여기서는 차례만 잇는다.
//
// 화면 차례: 제목 → 이야기책 → 누가 될까 → 나를 소개합니다 → 맵(그 위에 대화 장면·미션이 풀림·봇짐·지난 이야기가 얹힌다)
//            → 계절 닫기 → (다음 계절의 맵 | "다음에 만들어요").
// 엔진은 약속이 깨지면 던진다. 던진 것이 화면까지 올라가면 빈 화면이 되므로, 여기서 모두 받아 '이어 갈 수 없어요'(trouble)로 보낸다.
//
// 저절로 저장하는 때(spec 5.4): 일을 마치고 맵으로 돌아올 때, 미션이 풀릴 때, 계절을 넘길 때, 화면이 가려질 때.

import { computed, signal } from '@preact/signals';
import { cards as allCards, getPack, items as allItems } from '../content';
import {
  canCloseSeason,
  closeSeason,
  currentSeason,
  doHappening,
  lastDeed,
  newGame,
  nextSeason,
  openHappenings,
  playableRoles,
  roleOf,
  seasonReady,
  type DoInput,
} from '../engine/game';
import { SEASONS, type Deed, type GameState, type Look, type RoleId, type Season, type SituationPack } from '../engine/types';
import {
  dropBackup,
  keepBackup,
  loadSave,
  pruneGame,
  requestPersist,
  wipeSave,
  withCards,
  withCurrent,
  writeSave,
  type LoadStatus,
  type Save,
} from './storage';

export type Screen = 'title' | 'book' | 'rolePick' | 'intro' | 'map' | 'seasonClose' | 'next' | 'trouble' | 'sheet';

const loaded = loadSave();

export const screen = signal<Screen>('title');
export const situationId = signal<string | null>(null);
export const game = signal<GameState | null>(null);
/** 이번 판의 씨앗. 집 뽑기와 날씨 뽑기가 여기서 나온다. */
export const seed = signal<number>(0);
export const save = signal<Save>(loaded.save);
/** 저장을 읽은 결과(제목 화면이 쉬운 말로 알린다): 'noStorage' · 'yearLost' · 'unreadable' · 'newer' · 'migrated' */
export const loadStatus = signal<LoadStatus>(loaded.status);
/** 저장이 실패했는가(공간 없음, 막힌 창). 위쪽 띠에 한 줄로 알린다. */
export const saveFailed = signal(false);
/** "처음 화면으로 돌아갈까요?"를 묻는 중인가 */
export const askingHome = signal(false);

/** 맵 위에 얹힌 대화 장면: 지금 하고 있는 일(Happening)의 id. 없으면 null. */
export const talk = signal<string | null>(null);
/** "미션이 풀림" 종이로 보여 줄 미션의 id들(앞에서부터 하나씩 보인다) */
export const missionQueue = signal<string[]>([]);
/** 맵 위에 얹힌 작은 창: 봇짐 · 지난 이야기 */
export const panel = signal<'bag' | 'past' | null>(null);
/**
 * 이 창에서 몇 번째로 연 판인가. 새 판을 만들 때마다 하나씩 는다(맵 화면이 들고 있던 앞 판의 자리를 버리게 한다 —
 * 같은 씨앗·같은 모습으로 다시 시작해도 앞 판에서 서 있던 칸에서 시작하지 않게).
 */
export const gameNo = signal(0);
/** 그림 견본 화면과 맵의 계절 빛(개발용) */
export const artSeason = signal<Season>('spring');

export const pack = computed<SituationPack | null>(() => (situationId.value ? (getPack(situationId.value) ?? null) : null));

/** 이어 할 것이 있는가(제목의 "이어 하기") */
export const canContinue = computed<boolean>(() => {
  const cur = save.value.current;
  return Boolean(cur && getPack(cur.situationId) && cur.phase !== 'done');
});

/** 맵 위에 무언가 얹혀 있어 걷기를 멈춰야 하는가 */
export const mapBusy = computed<boolean>(() => talk.value !== null || missionQueue.value.length > 0 || panel.value !== null || askingHome.value);

/** 맵에서 쓰는 주인공 그림의 이름('farmer-boy', 'daughter' …) */
export function heroName(role: RoleId, look: Look): string {
  if (role === 'son' || role === 'daughter') return role;
  return `${role}-${look}`;
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

// ── 저장 ─────────────────────────────────────────────────────

/** 맵 화면이 알려 주는 것: 가 본 칸을 묶은 글자(저장할 때 함께 적는다). 빈 글자는 "아직 아무 데도 가지 않았다"이다. */
let walkedNow: string = loaded.save.walked ?? '';
/**
 * 풀렸지만 "미션이 풀림" 종이를 아직 닫지 않은 미션들(저장에 함께 적는다).
 * 일을 마치는 순간부터 종이를 닫을 때까지 여기 남아 있어, 그사이에 화면을 덮어도 다음에 이어 하면 종이가 뜬다.
 */
let owed: string[] = [];
/** 이어 가다 멈춘 횟수(일을 하나 마치면 0으로 돌아간다). 같은 저장으로 거듭 멈추면 그 해를 내려놓는다. */
let troubles = 0;

function persist(next: Save): void {
  save.value = next;
  saveFailed.value = !writeSave(next);
}

/** 지금의 판을 기기에 적는다 */
export function saveNow(): void {
  const g = game.value;
  if (!g) return;
  persist(withCurrent(withCards(save.value, g.cards), g, walkedNow, owed));
}

/** 맵 화면이 부른다: 서 있는 칸("칸,칸"), 가 본 구역, 가 본 칸을 묶은 글자. 저장은 하지 않는다(가려질 때·일을 마칠 때 한다). */
export function markPlace(at: string, seen: readonly string[], walked?: string): void {
  const g = game.value;
  if (!g) return;
  if (walked !== undefined) walkedNow = walked;
  if (g.at === at && g.seen.length === seen.length) return;
  game.value = { ...g, at, seen: [...seen] };
}

/** 가 본 칸을 묶은 글자(이어 할 때 맵 화면이 읽는다). 새 판과 새 계절에는 비어 있다. */
export function walkedText(): string {
  return walkedNow;
}

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

/** 엔진이 던졌을 때: 빈 화면 대신 '이어 갈 수 없어요' 화면으로 간다. 거기서 처음으로 갈 수 있다. */
function fail(error: unknown): void {
  report(error);
  troubles += 1;
  askingHome.value = false;
  talk.value = null;
  missionQueue.value = [];
  panel.value = null;
  screen.value = 'trouble';
}

// ── 움직임 ───────────────────────────────────────────────────

/** 제목 → 이야기책(처음부터). 진행 중인 해가 있으면 화면이 먼저 "하던 이야기는 지워져요"를 묻는다. */
export function goBook(): void {
  if (tooSoon()) return;
  screen.value = 'book';
}

/**
 * 진행 중인 해를 이어 갈 수 없을 때: 그 해만 내려놓고(깬 기록과 카드는 그대로) 제목에서 쉬운 말로 알린다.
 * 내려놓기 전의 글자는 'joseon-year/backup'에 한 벌 남긴다.
 */
function loseYear(): void {
  keepBackup();
  owed = [];
  walkedNow = '';
  persist(withCurrent(save.value, undefined));
  loadStatus.value = 'yearLost';
  askingHome.value = false;
  talk.value = null;
  missionQueue.value = [];
  panel.value = null;
  game.value = null;
  situationId.value = null;
  troubles = 0;
  screen.value = 'title';
}

/** 화면을 그리다 멈췄을 때 App이 알린다(같은 저장으로 거듭 멈추는지 센다) */
export function noteTrouble(): void {
  troubles += 1;
}

/** 제목 → 이어 하기: 그 계절의 맵, 마지막에 서 있던 자리에서. 어떤 저장이 와도 화면이 멈추지 않는다. */
export function continueGame(): void {
  const cur = save.value.current;
  const p = cur ? getPack(cur.situationId) : undefined;
  if (!cur || !p) return;
  if (tooSoon()) return;
  try {
    // 그 이야기에 없는 역할이나 될 수 없는 모습이면 이어 갈 수 없다
    const role = p.situation.roles.find((r) => r.id === cur.role);
    if (!role || !role.looks.includes(cur.look)) throw new Error(`이어 갈 수 없는 역할이나 모습이다: ${cur.role}/${cur.look}`);
    // 새 판에서 없어진 일·미션·카드·물건이 저장에 있으면 그 항목만 버린다
    const kept = pruneGame(cur, {
      happenings: new Set(p.happenings.map((h) => h.id)),
      missions: new Set(p.missions.map((m) => m.id)),
      cards: new Set(allCards.map((c) => c.id)),
      items: new Set(allItems.map((i) => i.id)),
    });
    // 남은 해 ☀는 그 역할의 해를 넘지 못한다
    const next = kept.sunsLeft > role.suns ? { ...kept, sunsLeft: role.suns } : kept;
    // 그 판으로 화면을 그릴 수 있는지 미리 본다(엔진이 던지면 여기서 잡힌다)
    if (next.phase === 'season' && seasonReady(p, next.role, currentSeason(next))) {
      openHappenings(p, next);
      canCloseSeason(p, next);
    }
    situationId.value = cur.situationId;
    seed.value = cur.seed;
    game.value = next;
    walkedNow = save.value.walked ?? '';
    talk.value = null;
    panel.value = null;
    // 닫지 못한 "미션이 풀림" 종이가 있으면 맵에 들어서자마자 뜬다
    owed = (save.value.papers ?? []).filter((id) => next.solved.includes(id) && p.missions.some((m) => m.id === id));
    missionQueue.value = next.phase === 'season' ? owed : [];
    if (next.phase === 'seasonClose') screen.value = 'seasonClose';
    else if (next.phase === 'season' && seasonReady(p, next.role, currentSeason(next))) screen.value = 'map';
    else screen.value = 'next';
  } catch (error) {
    report(error);
    loseYear();
  }
}

/** 이야기책에서 이야기를 고른다 → 누가 될까 */
export function openStory(id: string): void {
  const target = getPack(id);
  if (!target || playableRoles(target).length === 0) return; // 준비 중
  if (tooSoon()) return;
  situationId.value = id;
  game.value = null;
  seed.value = freshSeed();
  screen.value = 'rolePick';
}

/** 누가 될까에서 역할과 모습을 정한다 → 나를 소개합니다 */
export function settleRole(role: RoleId, look: Look): void {
  const p = pack.value;
  if (!p || !playableRoles(p).includes(role)) return; // 준비 중인 집
  if (!roleOf(p, role).looks.includes(look)) return;
  if (tooSoon()) return;
  try {
    game.value = newGame(p, role, look, seed.value);
    walkedNow = '';
    owed = [];
    gameNo.value += 1;
    screen.value = 'intro';
  } catch (error) {
    fail(error);
  }
}

/** 나를 소개합니다 → 봄의 맵. 여기서 처음 저장한다. */
export function beginYear(): void {
  if (!game.value) return;
  if (tooSoon()) return;
  requestPersist();
  saveNow();
  screen.value = 'map';
}

/** 맵에서 자리에 닿아 일을 연다(대화 장면이 맵 위에 얹힌다) */
export function openTalk(happeningId: string): void {
  if (!game.value || talk.value !== null) return;
  panel.value = null;
  talk.value = happeningId;
}

/**
 * 대화 장면이 부른다: 고른 선택지와 놀이의 끝난 모습을 넘겨 일을 마친다.
 * 결과(Deed)를 돌려주고, 대화 장면은 그것으로 결과 대화·수치 변화·쪽지를 보여 준다. 이어 갈 수 없으면 null.
 */
export function commitTalk(input: DoInput): Deed | null {
  const p = pack.value;
  const g = game.value;
  if (!p || !g) return null;
  try {
    const next = doHappening(p, g, input);
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

/** "계절을 보낸다": 꼭 푸는 미션을 다 풀었을 때만 된다 → 계절 닫기 */
export function closeSeasonNow(): void {
  const p = pack.value;
  const g = game.value;
  if (!p || !g || !canCloseSeason(p, g)) return;
  if (tooSoon()) return;
  try {
    game.value = closeSeason(p, g);
    panel.value = null;
    owed = [];
    missionQueue.value = [];
    saveNow();
    // 옛 꼴을 옮기며 남겨 둔 한 벌은 계절을 하나 넘기면 지운다
    if (!saveFailed.value) dropBackup();
    screen.value = 'seasonClose';
  } catch (error) {
    fail(error);
  }
}

/** 계절 닫기 → 다음 계절의 맵. 그 계절이 아직 만들어지지 않았으면 "다음에 만들어요". */
export function goNextSeason(): void {
  const p = pack.value;
  const g = game.value;
  if (!p || !g || g.phase !== 'seasonClose') return;
  if (tooSoon()) return;
  try {
    const next = nextSeason(p, g);
    game.value = next;
    // 계절마다 새로 걷는다(작은 지도가 다시 엷어진다)
    walkedNow = '';
    saveNow();
    screen.value = next.phase === 'season' && seasonReady(p, next.role, currentSeason(next)) ? 'map' : 'next';
  } catch (error) {
    fail(error);
  }
}

/** 다음 계절이 만들어져 있는가(계절 닫기 화면의 단추 글을 고를 때) */
export function nextSeasonReady(): boolean {
  const p = pack.value;
  const g = game.value;
  if (!p || !g) return false;
  const index = g.phase === 'seasonClose' ? g.seasonIndex + 1 : g.seasonIndex;
  return index < SEASONS.length && seasonReady(p, g.role, SEASONS[index]);
}

export function askHome(): void {
  askingHome.value = true;
}

export function cancelHome(): void {
  askingHome.value = false;
}

/** 처음 화면으로. 하던 해는 저장되어 있어 "이어 하기"로 돌아올 수 있다. */
export function goHome(): void {
  // 같은 저장으로 거듭 멈췄으면 그 해를 내려놓는다("이어 하기 → 멈춤 → 처음으로"가 되풀이되지 않게)
  if (troubles >= 2) {
    loseYear();
    lastMove = Date.now();
    return;
  }
  saveNow();
  askingHome.value = false;
  talk.value = null;
  missionQueue.value = [];
  panel.value = null;
  game.value = null;
  situationId.value = null;
  screen.value = 'title';
  lastMove = Date.now();
}

export function backToTitle(): void {
  if (tooSoon()) return;
  goHome();
}

/** "모두 지우고 처음부터"(화면이 두 번 물은 뒤에 부른다) */
export function wipeAll(): void {
  wipeSave();
  walkedNow = '';
  owed = [];
  gameNo.value += 1;
  save.value = { ...save.value, cleared: {}, cards: [], current: undefined, walked: undefined };
  loadStatus.value = 'empty';
  game.value = null;
  situationId.value = null;
  screen.value = 'title';
  lastMove = Date.now();
}

/** 진행 중인 해만 지운다(처음부터 새로 시작할 때) */
export function dropCurrent(): void {
  walkedNow = '';
  owed = [];
  gameNo.value += 1;
  persist(withCurrent(save.value, undefined));
}

export function goSheet(): void {
  if (tooSoon()) return;
  screen.value = 'sheet';
}

/**
 * 주소로 바로 들어가기(만드는 사람이 화면을 찍어 볼 때 쓴다. 개발 서버에서만 먹는다).
 *   ?view=sheet&season=autumn    그림 견본
 *   ?view=map&who=farmer-girl    봄의 맵에서 바로 시작(새 판)
 *   ?view=map&who=farmer-boy&talk=s1395-spring-sow   그 일의 대화 장면을 바로 연다
 */
export function openFromUrl(): void {
  // 빌드본에서는 먹지 않는다
  if (!import.meta.env.DEV) return;
  try {
    const q = new URLSearchParams(window.location.search);
    const view = q.get('view');
    const season = q.get('season') as Season | null;
    if (season && SEASONS.includes(season)) artSeason.value = season;
    if (view === 'sheet') screen.value = 'sheet';
    else if (view === 'map' || view === 'walk') {
      const [role, look] = (q.get('who') ?? 'farmer-boy').split('-') as [RoleId, Look | undefined];
      const p = getPack('s1395');
      if (!p) return;
      situationId.value = 's1395';
      seed.value = freshSeed();
      game.value = newGame(p, role, look === 'girl' ? 'girl' : 'boy', seed.value);
      walkedNow = '';
      owed = [];
      gameNo.value += 1;
      screen.value = 'map';
      // &talk=일의 id: 그 일의 대화 장면을 바로 연다(화면을 찍어 볼 때)
      const first = q.get('talk');
      if (first && game.value && openHappenings(p, game.value).some((v) => v.happening.id === first && !v.noSun)) talk.value = first;
    }
  } catch (error) {
    report(error);
  }
}
