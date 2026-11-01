// 콘텐츠 검사기 (spec 10절 "검사기에 더할 것", 5.2의 10번 글의 한도). 바퀴 1-다에서 미션과 일의 꼴로 고쳐 썼다.
//
// level 'error' = 고쳐야 하는 잘못. 하나라도 있으면 통과하지 못한다.
// level 'gap'   = 알림. 통과를 막지 않는다. 세 갈래가 있다.
//   - 아직 만들지 않은 곳: 준비 중인 이야기, 미션이 없는 역할, 만들지 않은 계절, 한 해가 다 차야 맞는 것(미션 수, 일곱 물음)
//   - 사람이 한 번 봐야 하는 곳: 읽히지 않는 표시, 근거 글에 없는 숫자, 갈린 결과가 빠뜨린 카드·표시, 인물의 쏠림
//   - 이 검사기가 더한 한도(SOFT_BUDGET)를 넘은 글
//
// 한 해가 다 차야 맞는 것은 "그 역할의 네 계절이 다 만들어졌을 때" 잘못으로 바뀐다(바퀴 1-라 — 다른 역할이 아직 없어도):
//   꼭 푸는 미션 6~10개, 올해의 바람을 가릴 줄, 인심이 깎이는 선택과 살림·기력 잠김, 그 역할의 일만 남기는 표시가 읽히지 않는 것,
//   그 역할의 미션·바람이 읽는 표시를 남기는 곳이 없는 것. 일곱 물음은 이야기 전체(모든 역할)가 다 차야 잘못이 되고,
//   그 전에는 역할마다 "이 역할이 미션으로 만나지 못하는 물음"을 알림으로 적는다(농민 집 아이는 혼인을 만나지 못한다 — spec 6.3).
//
// "만들어졌다"는 것: 그 역할의 그 계절에 꼭 푸는 미션이 하나라도 있다(엔진의 seasonReady). 봄부터 이어진 계절만 친다.
// 만들어진 역할·계절에 대해서만 맵의 자리, 선택지 수, 막다른 길을 본다. 막다른 길은 엔진으로 실제로 걸어서 찾는다.

import { isLocked, linesOf, meets } from '../engine/conditions';
import {
  canCloseSeason,
  choiceViews,
  currentSeason,
  doHappening,
  happeningOf,
  missingMusts,
  missionsOf,
  newGame,
  openChoiceIds,
  openHappenings,
  seasonLine,
  seasonReady,
  sunsFor,
  type DoInput,
} from '../engine/game';
import { drawValues } from '../engine/rng';
import {
  EFFECT_MAX,
  EFFECT_MIN,
  EXTRA_EFFECT_MAX,
  GROUP_IDS,
  SEASONS,
  STATS,
  STAT_MAX,
  STAT_MIN,
  THEME_IDS,
  type Card,
  type CatalogEntry,
  type Condition,
  type Facts,
  type GameState,
  type Group,
  type Happening,
  type Item,
  type Line,
  type Look,
  type Mission,
  type Outcome,
  type Place,
  type RoleDef,
  type RoleId,
  type Season,
  type SituationPack,
  type Source,
  type Stat,
  type Stats,
  type Theme,
} from '../engine/types';

export interface Issue {
  level: 'error' | 'gap';
  rule: string;
  where: string;
  message: string;
}

/** 검사기가 보는 맵: 자리가 있는가, 이 사람이 걸어서 닿는가. 맵의 좌표는 모른다(content/index.ts가 만들어 넘긴다). */
export interface MapRef {
  id: string;
  hasSpot(spot: string): boolean;
  canReach(spot: string, who: { role: RoleId; look: Look }): boolean;
}

export interface ContentBundle {
  packs: SituationPack[];
  catalog: CatalogEntry[];
  groups: Group[];
  themes: Theme[];
  cards: Card[];
  items: Item[];
  sources: Source[];
  places: Place[];
  maps: MapRef[];
}

/** 글의 한도 (5.2의 10번). 빈칸과 문장 부호까지 센다. 넘으면 잘못이다. */
export const BUDGET = {
  /** 대화창 한 창(세 줄 90자까지) */
  line: 90,
  /** 미션의 일: 여는 대화 다섯 창 200자, 결과 세 창 120자 */
  openWindows: 5,
  openChars: 200,
  resultWindows: 3,
  resultChars: 120,
  /** 덤으로 하는 일: 여는 대화 세 창 120자, 결과 두 창 80자 */
  extraOpenWindows: 3,
  extraOpenChars: 120,
  extraResultWindows: 2,
  extraResultChars: 80,
  label: 26,
  lockReason: 30,
  note: 50,
  /** 덤으로 하는 일의 한마디(할 일 쪽지의 덤 줄 "우물가 — <한마디>"). spec에 없는 한도다 — 쪽지 한 줄에 들어가게 잡았다(바퀴 1-다 고치기) */
  lure: 24,
  intro: 100,
  seasonLine: 40,
  missionTitle: 18,
  missionGoal: 40,
  personLabel: 6,
  cardTitle: 12,
  cardText: 60,
  // 1-가의 예산을 잇는 것
  wish: 30,
  wishReason: 70,
  endingTitle: 20,
  endingLine: 60,
  epilogue: 90,
  blurb: 44,
} as const;

/** 이 검사기가 화면에 맞추려고 더한 한도(spec에 없다). 넘으면 알림만 한다. */
export const SOFT_BUDGET = {
  doneLine: 40,
  laterLine: 90,
  family: 60,
  itemLabel: 12,
  itemText: 60,
  drawLabel: 12,
  drawLine: 60,
} as const;

/** 시간 어림(5.2의 11번, 가정): 소리 내어 읽는 속도 분당 300자, 일 하나에 걸어가기 40초, 일 놀이 1분, 계절 열고 닫기 1분 */
export const READ_PER_MINUTE = 300;
export const WALK_SECONDS = 40;
export const PLAY_SECONDS = 60;
export const SEASON_SECONDS = 60;

/** 빈칸과 문장 부호까지 센다. */
export function countChars(text: string): number {
  return [...text].length;
}

/**
 * 쓰지 않기로 한 낱말 (7.3 "무거운 내용을 다루는 원칙", 5.3 "넣지 않는 것", 5.2의 7번).
 * except: 그 낱말을 설명으로 다룰 수 있는 칸. 지금은 배움 쪽지(note)뿐이다.
 */
export const BANNED_WORDS: { word: string; why: string; except?: 'note'[] }[] = [
  // 노비 — 낮춰 부르는 말을 쓰지 않는다
  { word: '종놈', why: '노비를 낮춰 부르는 말' },
  { word: '종년', why: '노비를 낮춰 부르는 말' },
  { word: '계집종', why: '노비를 낮춰 부르는 말' },
  { word: '머슴놈', why: '사람을 낮춰 부르는 말' },
  { word: '천것', why: '신분을 낮춰 부르는 말' },
  { word: '아랫것', why: '신분을 낮춰 부르는 말' },
  { word: '상놈', why: '신분을 낮춰 부르는 말' },
  { word: '쌍놈', why: '신분을 낮춰 부르는 말' },
  { word: '상것', why: '신분을 낮춰 부르는 말' },
  // 여성 — 놀리거나 꾸짖지 않는다
  { word: '계집', why: '여성을 낮춰 부르는 말' },
  { word: '여편네', why: '여성을 낮춰 부르는 말' },
  // 전쟁 — "왜군" "청군"이라고만 쓴다. 청을 낮추어 본 것은 배움 쪽지에서 설명으로만 다룬다
  { word: '왜놈', why: '그 나라 사람 전체를 낮추는 말' },
  { word: '왜적', why: '"왜군"이라고만 쓴다' },
  { word: '쪽발이', why: '그 나라 사람 전체를 낮추는 말' },
  { word: '되놈', why: '그 나라 사람 전체를 낮추는 말' },
  { word: '떼놈', why: '그 나라 사람 전체를 낮추는 말' },
  { word: '오랑캐', why: '그 나라 사람 전체를 낮추는 말(배움 쪽지의 설명은 됨)', except: ['note'] },
  // 때리거나 벌주는 묘사, 죽음과 싸움 장면을 그리지 않는다
  { word: '매질', why: '때리거나 벌주는 묘사' },
  { word: '곤장', why: '때리거나 벌주는 묘사' },
  { word: '채찍', why: '때리거나 벌주는 묘사' },
  { word: '시체', why: '죽음을 그리는 묘사' },
  { word: '주검', why: '죽음을 그리는 묘사' },
  { word: '피투성이', why: '싸움을 그리는 묘사' },
  { word: '목을 베', why: '싸움을 그리는 묘사' },
  // 믿음 — 어느 쪽도 옳다 그르다 하지 않는다
  { word: '미신', why: '믿음을 그르다고 하는 말' },
  { word: '사이비', why: '믿음을 그르다고 하는 말' },
  { word: '이단', why: '믿음을 그르다고 하는 말' },
  { word: '우상', why: '믿음을 그르다고 하는 말' },
  // 퀴즈가 아니다 — 맞음·틀림, 점수, 등수가 없다. 바람을 이루지 못해도 실패라고 하지 않는다
  { word: '정답', why: '맞고 틀림을 가리는 말' },
  { word: '오답', why: '맞고 틀림을 가리는 말' },
  { word: '틀렸', why: '맞고 틀림을 가리는 말' },
  { word: '맞혔', why: '맞고 틀림을 가리는 말' },
  { word: '맞았어요', why: '풀었을 때 "맞았어요"라고 하지 않는다' },
  { word: '점수', why: '점수를 매기는 말' },
  { word: '등수', why: '등수를 매기는 말' },
  { word: '실패', why: '실패라고 하지 않는다' },
  { word: '탈락', why: '실패라고 하지 않는다' },
];

/** 잠긴 까닭은 사람 탓이 아니라 제도·형편을 주어로 쓴다(5.2의 2번). 사람을 탓하는 말투를 잡는다. */
export const BLAME_WORDS = ['네가', '너는', '네 탓', '게을러', '못나서', '모자란 아이'];

// ── 묶음 검사 ─────────────────────────────────────────────────

export interface ValidateOptions {
  /** 막다른 길을 찾으러 엔진으로 걸어 볼 것인가(기본: 걷는다). 글과 꼴만 볼 때 끈다. */
  walk?: boolean;
}

/** 묶음 전체를 검사한다. */
export function validateContent(bundle: ContentBundle, options: ValidateOptions = {}): Issue[] {
  const issues: Issue[] = [];
  checkShared(bundle, issues);
  for (const pack of bundle.packs) issues.push(...validatePack(pack, bundle, options));
  return issues;
}

export function errorsOf(issues: Issue[]): Issue[] {
  return issues.filter((issue) => issue.level === 'error');
}

export function gapsOf(issues: Issue[]): Issue[] {
  return issues.filter((issue) => issue.level === 'gap');
}

/** 사람이 읽을 한 줄 */
export function formatIssue(issue: Issue): string {
  return `[${issue.level === 'error' ? '잘못' : '알림'}] ${issue.where} — ${issue.message} (${issue.rule})`;
}

type Refs = Pick<ContentBundle, 'cards' | 'items' | 'sources' | 'places' | 'groups' | 'themes' | 'catalog' | 'maps'>;
type Report = (rule: string, where: string, message: string) => void;
type AnyOutcome = Outcome & { variants?: (Outcome & { when: Condition })[] };

const LOOKS: readonly Look[] = ['boy', 'girl'];
const POSES = ['plain', 'glad', 'worried'];
const MISSION_KINDS = ['live', 'do', 'ask', 'carry', 'compare', 'collect'];
const SEX = ['m', 'f'];
const AGES = ['child', 'young', 'adult', 'old'];

// ── 이야기 하나 ────────────────────────────────────────────────

/** 이 역할에게 만들어진 계절들: 봄부터 끊기지 않고 이어진 것 */
export function builtSeasons(pack: SituationPack, role: RoleId): Season[] {
  const out: Season[] = [];
  for (const season of SEASONS) {
    if (!seasonReady(pack, role, season)) break;
    out.push(season);
  }
  return out;
}

/** 이야기 하나를 검사한다. */
export function validatePack(pack: SituationPack, refs: Refs, options: ValidateOptions = {}): Issue[] {
  const issues: Issue[] = [];
  const situation = pack.situation;
  const missions = pack.missions ?? [];
  const happenings = pack.happenings ?? [];
  const sid = situation.id || '(이름 없는 이야기)';
  const err: Report = (rule, where, message) => issues.push({ level: 'error', rule, where, message });
  const gap: Report = (rule, where, message) => issues.push({ level: 'gap', rule, where, message });

  const sourceIds = new Set(refs.sources.map((source) => source.id));
  const cardIds = new Set(refs.cards.map((card) => card.id));
  const itemIds = new Set(refs.items.map((item) => item.id));
  const draws = drawValues(situation.draw?.kind ?? 'none');
  const roles = situation.roles ?? [];
  const roleIds = new Set(roles.map((role) => role.id));
  const people = situation.people ?? {};
  const happeningById = new Map(happenings.map((h) => [h.id, h]));

  // 만들어진 역할과 계절
  const built = new Map<RoleId, Season[]>();
  for (const role of roles) built.set(role.id, builtSeasons(pack, role.id));
  const builtRoles = roles.filter((role) => (built.get(role.id) ?? []).length > 0);
  const isComplete = (role: RoleId) => (built.get(role) ?? []).length === SEASONS.length;
  const anyComplete = roles.some((role) => isComplete(role.id));
  const allComplete = roles.length > 0 && roles.every((role) => isComplete(role.id));
  /** 이 역할들만의 것인가, 그리고 그 역할들의 한 해가 모두 다 만들어졌는가(역할을 적지 않은 것은 모든 역할의 것이다) */
  const settledFor = (only: RoleId[] | undefined): boolean => {
    const mine = only ?? roles.map((role) => role.id);
    return mine.length > 0 && mine.every((role) => isComplete(role));
  };
  /** 이 일이 지금 실제로 벌어지는 사람들(만들어진 역할·계절) */
  const liveFor = (h: Happening): RoleDef[] =>
    builtRoles.filter((role) => (!h.roles || h.roles.includes(role.id)) && (built.get(role.id) ?? []).includes(h.season));

  // ── 이야기의 뼈대 ──
  if (!situation.id) err('situation', sid, '이야기 id가 없다');
  if (!GROUP_IDS.includes(situation.group)) err('situation', sid, `없는 시기 묶음 "${situation.group}"`);
  if (!situation.title) err('situation', sid, '이름이 없다');
  if (!Number.isInteger(situation.year)) err('situation', sid, '대표 해가 없다');
  if (!situation.epilogue) err('situation', sid, '뒷이야기가 없다');
  if (!situation.openQuestion) err('situation', sid, '끝 물음이 없다');
  if (situation.pickBy !== 'draw' && situation.pickBy !== 'choose') err('situation', sid, '처음에 뽑는지 고르는지(pickBy)가 없다');
  checkBudget(err, `${sid} 뒷이야기`, 'budget-epilogue', situation.epilogue ?? '', BUDGET.epilogue);

  const entry = refs.catalog.find((row) => row.id === situation.id);
  if (!entry) {
    err('catalog', sid, '이야기 목록(catalog.ts)에 이 이야기가 없다');
  } else {
    if (entry.group !== situation.group) err('catalog', sid, '시기 묶음이 이야기 목록과 다르다');
    if (entry.year !== situation.year) err('catalog', sid, '대표 해가 이야기 목록과 다르다');
    if (entry.title !== situation.title) err('catalog', sid, '이름이 이야기 목록과 다르다');
    if (entry.lessons !== situation.lessons) err('catalog', sid, '지도서 차시가 이야기 목록과 다르다');
  }

  // 견주기 물음 일곱 개의 이 이야기 답
  for (const theme of THEME_IDS) {
    if (!situation.themes?.[theme]?.trim()) err('themes', sid, `견주기 물음 "${theme}"의 답이 비었다`);
    for (const fact of situation.proof?.themes?.[theme] ?? []) {
      if (!sourceIds.has(fact)) err('facts', `${sid} 견주기 ${theme}`, `sources.ts에 없는 근거 번호 "${fact}"`);
    }
  }
  for (const fact of situation.proof?.epilogue ?? []) {
    if (!sourceIds.has(fact)) err('facts', `${sid} 뒷이야기`, `sources.ts에 없는 근거 번호 "${fact}"`);
  }

  // 뽑기
  if (situation.draw?.kind && situation.draw.kind !== 'none') {
    if (!situation.draw.season) err('draw', sid, '뽑기를 하는 계절(draw.season)이 없다');
    if (draws.length === 0) err('draw', sid, `엔진에 아직 없는 뽑기 "${situation.draw.kind}"`);
  }
  for (const [value, label] of Object.entries(situation.draw?.labels ?? {})) {
    const where = `${sid} 뽑기 ${value}`;
    if (!draws.includes(value)) err('draw-unknown', where, `이 이야기의 뽑기에 없는 값 "${value}"`);
    if (!label.label?.trim() || !label.line?.trim()) err('draw', where, '뽑기 값의 이름이나 한 줄이 비었다');
    checkBudget(gap, where, 'budget-soft', label.label ?? '', SOFT_BUDGET.drawLabel);
    checkBudget(gap, where, 'budget-soft', label.line ?? '', SOFT_BUDGET.drawLine);
  }

  // 등장인물
  const personIds = Object.keys(people);
  for (const [id, person] of Object.entries(people)) {
    const where = `${sid} 사람 ${id}`;
    if (!person.label?.trim()) err('people', where, '이름표가 없다');
    checkBudget(err, `${where} 이름표`, 'budget-person', person.label ?? '', BUDGET.personLabel);
    if (!SEX.includes(person.sex)) err('people', where, `성별이 없다("${String(person.sex)}")`);
    if (!AGES.includes(person.age)) err('people', where, `나이대가 없다("${String(person.age)}")`);
  }
  if (personIds.length >= 3) {
    const men = personIds.filter((id) => people[id].sex === 'm').length;
    const women = personIds.filter((id) => people[id].sex === 'f').length;
    if (Math.min(men, women) * 3 < men + women) {
      gap('people-balance', sid, `등장인물이 한쪽으로 쏠렸다(남 ${men}, 여 ${women}). 적은 쪽이 셋에 하나는 되어야 한다(한쪽만 있던 자리는 빼고 본다)`);
    }
    const bands = AGES.filter((age) => personIds.some((id) => people[id].age === age));
    if (personIds.length >= 4 && bands.length < 3) {
      gap('people-balance', sid, `등장인물의 나이대가 ${bands.length}가지뿐이다(${bands.join(', ')})`);
    }
  }

  // 역할
  if (roles.length < 2 || roles.length > 4) err('roles', sid, `역할이 ${roles.length}개다(2~4개여야 한다)`);
  const seenRoles = new Set<string>();
  for (const def of roles) {
    const where = `${sid} 역할 ${def.id}`;
    const isBuilt = (built.get(def.id) ?? []).length > 0;
    const strict = isBuilt ? err : gap;
    if (!def.id || seenRoles.has(def.id)) err('roles', where, '역할 id가 없거나 겹친다');
    seenRoles.add(def.id);
    if (!def.label) err('roles', where, '이름이 없다');
    if (!def.intro) strict('roles', where, '소개 글이 없다');
    if (!def.wish) strict('roles', where, '올해의 바람이 없다');
    checkBudget(err, `${where} 소개`, 'budget-intro', def.intro ?? '', BUDGET.intro);
    checkBudget(err, `${where} 바람`, 'budget-wish', def.wish ?? '', BUDGET.wish);
    checkBudget(gap, `${where} 식구`, 'budget-soft', def.family ?? '', SOFT_BUDGET.family);
    for (const stat of STATS) {
      const value = def.start?.[stat];
      if (!Number.isInteger(value) || value < STAT_MIN || value > STAT_MAX) {
        err('start-range', where, `시작 수치 ${stat}=${String(value)} (0~10이어야 한다)`);
      }
    }
    if (def.kind !== 'status' && def.kind !== 'scene') err('roles', where, '신분 역할인지 현장 역할인지(kind)가 없다');
    if (!Number.isInteger(def.suns) || def.suns < 1) err('roles', where, `계절의 해 ☀가 ${String(def.suns)}이다(1 이상이어야 한다)`);
    if (!def.looks || def.looks.length === 0 || def.looks.some((look) => !LOOKS.includes(look)) || new Set(def.looks).size !== def.looks.length) {
      err('roles', where, '될 수 있는 모습(looks)이 없거나 잘못되었다');
    }
    if (!refs.maps.some((map) => map.id === def.map)) strict('map-unknown', where, `없는 맵 "${def.map}"`);
    if (def.heirOf && !refs.catalog.some((row) => row.id === def.heirOf?.situation)) {
      err('roles', where, `후손의 앞 이야기가 목록에 없다("${def.heirOf.situation}")`);
    }
    // 올해의 바람을 가릴 줄: 한 해가 다 만들어져야 쓰인다
    const rows = def.wishOutcomes ?? [];
    const wishReport = isComplete(def.id) ? err : gap;
    if (rows.length === 0) {
      if (isBuilt) wishReport('wish', where, '올해의 바람을 가릴 줄(wishOutcomes)이 없다(한 해 돌아보기를 만들 때 채운다)');
    } else {
      const last = rows[rows.length - 1];
      if (last.when && Object.keys(last.when).length > 0) err('wish', where, '바람을 가리는 마지막 줄에는 조건이 없어야 한다');
      rows.forEach((row, index) => {
        if (!row.reason?.trim()) err('wish', `${where} 바람 ${index + 1}`, '까닭이 없다');
        checkBudget(err, `${where} 바람 ${index + 1}`, 'budget-wish', row.reason ?? '', BUDGET.wishReason);
      });
    }
  }

  // 한 해 이름
  const endings = situation.endings ?? [];
  if (endings.length === 0) {
    (anyComplete ? err : gap)('endings', sid, '한 해 이름이 하나도 없다(한 해 돌아보기를 만들 때 채운다)');
  } else {
    const last = endings[endings.length - 1];
    if (last.when && Object.keys(last.when).length > 0) {
      err('endings', sid, '마지막 한 해 이름에는 조건이 없어야 한다(언제나 하나는 뽑혀야 한다)');
    }
    const seen = new Set<string>();
    for (const ending of endings) {
      const where = `${sid} 한 해 이름 ${ending.id}`;
      if (!ending.id || seen.has(ending.id)) err('endings', where, 'id가 없거나 겹친다');
      seen.add(ending.id);
      if (!ending.title) err('endings', where, '이름이 없다');
      checkBudget(err, where, 'budget-ending', ending.title ?? '', BUDGET.endingTitle);
      checkBudget(err, where, 'budget-ending', ending.line ?? '', BUDGET.endingLine);
    }
  }

  // 계절 첫 줄
  const anyBuilt = (season: Season) => builtRoles.some((role) => (built.get(role.id) ?? []).includes(season));
  for (const season of SEASONS) {
    const row = situation.seasons?.[season];
    const where = `${sid} ${season} 첫 줄`;
    if (!row?.line?.trim()) {
      (anyBuilt(season) ? err : gap)('season-line', where, '계절 첫 줄이 없다');
      continue;
    }
    checkBudget(err, where, 'budget-season', row.line, BUDGET.seasonLine);
    (row.lineVariants ?? []).forEach((variant, index) => {
      if (!variant.line?.trim()) err('season-line', `${where} 갈림 ${index + 1}`, '글이 없다');
      checkBudget(err, `${where} 갈림 ${index + 1}`, 'budget-season', variant.line ?? '', BUDGET.seasonLine);
    });
  }

  // 남길 것
  const legacyIds = new Set<string>();
  for (const thing of situation.legacy ?? []) {
    if (!thing.id || legacyIds.has(thing.id) || !thing.label) err('legacy', `${sid} 남길 것 ${thing.id}`, 'id·이름이 없거나 겹친다');
    legacyIds.add(thing.id);
  }

  // ── 표시와 물건: 어디서 남기고 어디서 읽는가 ──
  /** 표시 → 그 표시를 남기는 곳 */
  const flagSetters = new Map<string, string[]>();
  const itemGivers = new Set<string>();
  const noteSetter = (flag: string, at: string) => {
    const list = flagSetters.get(flag) ?? [];
    if (!list.includes(at)) list.push(at);
    flagSetters.set(flag, list);
  };
  for (const h of happenings) {
    for (const flag of Object.values(h.play?.flags ?? {})) if (flag) noteSetter(flag, `${h.id} 놀이`);
    for (const [at, outcome] of outcomesOfHappening(h)) {
      for (const flag of outcome.setFlags ?? []) noteSetter(flag, at);
      for (const item of outcome.items ?? []) itemGivers.add(item);
    }
  }
  const flagsRead = new Set<string>();
  const takeRead = (cond: Condition | undefined): void => {
    if (!cond) return;
    for (const flag of [...(cond.flags ?? []), ...(cond.notFlags ?? [])]) flagsRead.add(flag);
    for (const one of cond.anyOf ?? []) takeRead(one);
  };

  /**
   * 조건 하나를 본다. live = 지금 쓰이는 일과 미션의 조건(모르는 표시는 잘못),
   * later = 한 해가 다 만들어져야 쓰이는 조건(한 해 이름, 바람, 뒤 계절의 첫 줄 — 아직 남기는 곳이 없을 수 있어 알림).
   */
  const checkCondition = (cond: Condition | undefined, where: string, when: 'live' | 'later' = 'live', settled = false): void => {
    if (!cond) return;
    takeRead(cond);
    // settled: 이 조건을 쓰는 역할들의 한 해가 다 만들어졌다 — 남기는 곳이 없는 표시를 뒤에 채울 계절이 없다
    const unknown = when === 'live' || allComplete || settled ? err : gap;
    for (const role of cond.roles ?? []) {
      if (!roleIds.has(role)) err('condition', where, `없는 역할 "${String(role)}"`);
    }
    if (cond.look !== undefined && !LOOKS.includes(cond.look)) err('condition', where, `없는 모습 "${String(cond.look)}"`);
    for (const bound of [cond.min, cond.max]) {
      for (const [stat, value] of Object.entries(bound ?? {})) {
        if (!STATS.includes(stat as Stat)) err('condition', where, `없는 수치 "${stat}"`);
        if (!Number.isInteger(value) || value < STAT_MIN || value > STAT_MAX) {
          err('condition', where, `수치 조건 ${stat}=${String(value)} (0~10이어야 한다)`);
        }
      }
    }
    for (const flag of [...(cond.flags ?? []), ...(cond.notFlags ?? [])]) {
      if (!flagSetters.has(flag)) unknown('flag-unknown', where, `읽기만 하고 어디서도 남기지 않는 표시 "${flag}"`);
    }
    if (cond.draw !== undefined && !draws.includes(cond.draw)) {
      err('draw-unknown', where, `이 이야기의 뽑기에 없는 값 "${cond.draw}"`);
    }
    for (const item of cond.items ?? []) {
      if (!itemIds.has(item)) err('item-unknown', where, `items.ts에 없는 물건 "${item}"`);
      else if (!itemGivers.has(item)) unknown('item-unknown', where, `어디서도 얻을 수 없는 물건 "${item}"`);
    }
    if (cond.cardCount !== undefined) {
      const have = refs.cards.filter((card) => card.situation === situation.id).length;
      if (!Number.isInteger(cond.cardCount) || cond.cardCount < 1) err('condition', where, `카드 수 조건 ${String(cond.cardCount)} (1 이상의 정수여야 한다)`);
      else if (cond.cardCount > have) unknown('card-count', where, `카드 ${cond.cardCount}장을 모아야 하는데 이 이야기의 카드는 ${have}장뿐이다`);
    }
    for (const one of cond.anyOf ?? []) checkCondition(one, where, when, settled);
  };

  for (const def of roles) {
    (def.wishOutcomes ?? []).forEach((row, index) =>
      checkCondition(row.when, `${sid} 역할 ${def.id} 바람 ${index + 1}`, 'later', isComplete(def.id)),
    );
  }
  for (const ending of endings) checkCondition(ending.when, `${sid} 한 해 이름 ${ending.id}`, 'later');
  for (const season of SEASONS) {
    (situation.seasons?.[season]?.lineVariants ?? []).forEach((variant, index) =>
      checkCondition(variant.when, `${sid} ${season} 첫 줄 갈림 ${index + 1}`, anyBuilt(season) ? 'live' : 'later'),
    );
  }

  // 나중에 나타나는 결과
  (situation.later ?? []).forEach((later, index) => {
    const where = `${sid} 나중 결과 ${index + 1}`;
    if (!SEASONS.includes(later.at)) err('later', where, `없는 계절 "${String(later.at)}"`);
    if (!later.line?.trim()) err('later', where, '글이 없다');
    checkBudget(gap, where, 'budget-soft', later.line ?? '', SOFT_BUDGET.laterLine);
    checkEffects(err, where, later.effects, EFFECT_MAX);
    for (const card of later.cards ?? []) if (!cardIds.has(card)) err('card-unknown', where, `cards.ts에 없는 카드 "${card}"`);
    for (const fact of later.facts ?? []) if (!sourceIds.has(fact)) err('facts', where, `sources.ts에 없는 근거 번호 "${fact}"`);
    checkCondition(later.when, where, anyBuilt(later.at) ? 'live' : 'later');
  });

  // ── 미션 ──
  const missionIds = new Set<string>();
  /** 꼭 푸는 미션에 든 일(해가 들지 않아야 한다) */
  const inMust = new Set<string>();
  const rescueIds = new Set<string>();
  for (const m of missions) {
    const where = `미션 ${m.id || '(id 없음)'}`;
    if (!m.id || missionIds.has(m.id)) err('mission', where, '미션 id가 없거나 겹친다');
    missionIds.add(m.id);
    if (m.situation !== situation.id) err('mission', where, `다른 이야기의 미션이다("${m.situation}")`);
    if (m.season !== 'year' && !SEASONS.includes(m.season)) err('mission', where, `없는 계절 "${String(m.season)}"`);
    if (m.must && m.season === 'year') err('mission', where, '꼭 푸는 미션은 푸는 계절이 있어야 한다(한 해 내내 푸는 것은 덤 미션뿐이다)');
    for (const role of m.roles ?? []) if (!roleIds.has(role)) err('mission', where, `없는 역할 "${role}"`);
    if (!MISSION_KINDS.includes(m.kind)) err('mission', where, `없는 갈래 "${String(m.kind)}"`);
    if (!THEME_IDS.includes(m.theme)) err('mission', where, `없는 견주기 물음 "${String(m.theme)}"`);
    if (!m.title?.trim()) err('mission', where, '미션 이름이 없다');
    if (!m.goal?.trim()) err('mission', where, '할 일 한 줄이 없다');
    if (!m.doneLine?.trim()) err('mission', where, '"해낸 일" 한 줄이 없다');
    if (!m.lesson?.trim()) err('lesson', where, '지도서 차시와 학습 내용(lesson)이 없다');
    checkBudget(err, `${where} 이름`, 'budget-mission', m.title ?? '', BUDGET.missionTitle);
    checkBudget(err, `${where} 할 일`, 'budget-mission', m.goal ?? '', BUDGET.missionGoal);
    checkBudget(gap, `${where} 해낸 일`, 'budget-soft', m.doneLine ?? '', SOFT_BUDGET.doneLine);

    // 카드를 세는 덤 미션은 딸린 일이 따로 없어도 된다(카드는 어느 일에서 얻은 것이든 센다)
    const countsCards = !m.must && m.done?.cardCount !== undefined;
    if ((!m.parts || m.parts.length === 0) && !countsCards) err('mission-parts', where, '이 미션을 이루는 일(parts)이 없다');
    for (const part of m.parts ?? []) {
      const h = happeningById.get(part);
      if (m.must) inMust.add(part);
      if (!h) {
        err('mission-parts', where, `없는 일 "${part}"`);
        continue;
      }
      if (m.season !== 'year' && h.season !== m.season) err('mission-parts', where, `일 "${part}"의 계절(${h.season})이 미션의 계절(${m.season})과 다르다`);
    }
    if (m.rescue !== undefined) {
      const h = happeningById.get(m.rescue);
      if (rescueIds.has(m.rescue)) err('mission-rescue', where, `도움의 일 "${m.rescue}"을(를) 다른 미션도 쓴다(미션마다 따로 둔다)`);
      rescueIds.add(m.rescue);
      if (m.must) inMust.add(m.rescue);
      if (!h) err('mission-rescue', where, `없는 도움의 일 "${m.rescue}"`);
      else if (m.season !== 'year' && h.season !== m.season) err('mission-rescue', where, `도움의 일 "${m.rescue}"의 계절이 미션의 계절과 다르다`);
      if ((m.parts ?? []).includes(m.rescue)) err('mission-rescue', where, '도움의 일이 미션의 일(parts)에도 들어 있다');
    }

    // 한 해 내내 푸는 덤 미션과 아직 만들지 않은 계절의 미션은 뒤 계절의 일이 남길 표시를 읽을 수 있다(그때까지는 알림)
    const liveMission = m.season !== 'year' && SEASONS.includes(m.season) && anyBuilt(m.season);
    // 한 해 내내 푸는 덤 미션도, 그 미션을 푸는 역할들의 한 해가 다 만들어졌으면 표시를 남기는 곳이 있어야 한다
    checkCondition(m.done, `${where} 풀림 조건`, liveMission ? 'live' : 'later', settledFor(m.roles));
    // 처음부터 풀려 있으면 안 된다(가서, 듣고, 고르고, 해내야 풀린다)
    const solvedAtStart = roles
      .filter((role) => !m.roles || m.roles.includes(role.id))
      .flatMap((def) => (def.looks ?? []).map((look) => ({ def, look })))
      .find(({ def, look }) => meets(m.done, { role: def.id, look, stats: def.start, flags: [], draw: null, items: [] }));
    if (solvedAtStart) {
      err(
        'mission-done',
        where,
        `아무 일도 하지 않았는데 풀려 있다(${solvedAtStart.def.id}/${solvedAtStart.look}). 풀림 조건(done)은 일이 남긴 표시를 읽어야 한다`,
      );
    }
  }

  // 한 일이 두 미션에 들어 있으면 그 일의 기록(Deed.missionId)과 맵의 깃발은 앞에 적힌 미션 것만 된다
  const overlap = (a: Mission, b: Mission) => !a.roles || !b.roles || a.roles.some((role) => b.roles?.includes(role));
  for (const h of happenings) {
    const owners = missions.filter((m) => (m.parts ?? []).includes(h.id) || m.rescue === h.id);
    for (let i = 1; i < owners.length; i++) {
      if (overlap(owners[0], owners[i])) {
        gap('mission-overlap', h.id, `두 미션(${owners[0].id}, ${owners[i].id})에 함께 들어 있다. 기록과 깃발은 앞의 미션 것으로만 적힌다`);
      }
    }
  }

  // 같은 계절에 같은 자리를 쓰는 일들: 맵에서 표시가 겹칠 수 있다(차례로 나타나는 것이면 그대로 둔다)
  for (let i = 0; i < happenings.length; i++) {
    for (let j = i + 1; j < happenings.length; j++) {
      const [a, b] = [happenings[i], happenings[j]];
      if (!a.spot || a.spot !== b.spot || a.season !== b.season) continue;
      const shared = builtRoles.some((role) => liveFor(a).includes(role) && liveFor(b).includes(role));
      if (!shared) continue;
      // 함께 나타날 수 없는 짝은 알리지 않는다: 모습이 다른 사람의 일이거나, 한쪽이 다른 쪽을 마친 뒤에야 나타나는 일(차례로 나타난다)
      if (a.shows?.look && b.shows?.look && a.shows.look !== b.shows.look) continue;
      if (showsAfter(a, b) || showsAfter(b, a)) continue;
      gap('spot-shared', `${a.id} · ${b.id}`, `같은 계절에 같은 자리("${a.spot}")를 쓴다. 함께 나타나면 맵에서 표시가 겹친다`);
    }
  }

  // ── 일 하나하나 ──
  const seenHappenings = new Set<string>();
  for (const h of happenings) {
    const where = h.id || '(id 없는 일)';
    const isMission = h.cost === 0;
    // 아직 쓰이지 않는 일(뒤 계절이나 만들지 않은 역할의 것)의 조건은 '나중' 조건으로 본다
    const mode: 'live' | 'later' = liveFor(h).length > 0 ? 'live' : 'later';
    if (!h.id) err('happening', where, '일 id가 없다');
    if (seenHappenings.has(h.id)) err('happening', where, '일 id가 겹친다');
    seenHappenings.add(h.id);
    if (h.situation !== situation.id) err('happening', where, `다른 이야기의 일이다("${h.situation}")`);
    if (!SEASONS.includes(h.season)) err('happening', where, `없는 계절 "${String(h.season)}"`);
    for (const role of h.roles ?? []) if (!roleIds.has(role)) err('happening', where, `없는 역할 "${role}"`);
    if (!THEME_IDS.includes(h.theme)) err('happening', where, `없는 견주기 물음 "${String(h.theme)}"`);
    if (h.cost !== 0 && h.cost !== 1) err('cost', where, `드는 해 ☀가 ${String(h.cost)}이다(0 또는 1)`);
    if (!h.spot?.trim()) err('spot-unknown', where, '맵의 자리(spot)가 없다');
    if (!h.stage?.place?.trim()) err('stage', where, '대화 장면의 배경(stage.place)이 없다');

    // 해 ☀: 꼭 푸는 미션의 일은 해를 쓰지 않고, 그 밖의 일은 하나를 쓴다
    if (inMust.has(h.id) && h.cost !== 0) err('cost', where, '꼭 푸는 미션의 일은 해 ☀를 쓰지 않는다(cost: 0)');
    if (h.cost === 0 && !inMust.has(h.id)) err('cost', where, '꼭 푸는 미션의 일이 아닌데 해 ☀가 들지 않는다(덤으로 하는 일은 cost: 1)');
    if (rescueIds.has(h.id) && h.shows) gap('rescue-shows', where, '도움의 일은 미션이 막혔을 때 나타난다. shows 조건은 쓰이지 않는다');

    // 덤의 한마디(lure): 할 일 쪽지의 덤 줄에 뜬다. 24자를 넘으면 잘못, 덤으로 하는 일에 없으면 알림(쪽지에 자리 이름만 뜬다).
    // 쓰지 않기로 한 낱말과 근거에 없는 숫자는 아래에서 다른 글과 함께 본다(textsOfHappening).
    if (h.lure !== undefined) checkBudget(err, `${where} 한마디`, 'budget-lure', h.lure, BUDGET.lure);
    if (h.cost === 1 && !h.lure?.trim()) {
      gap('lure-missing', where, '덤으로 하는 일에 가 보고 싶게 만드는 한마디(lure)가 없다(할 일 쪽지에 자리 이름만 뜬다)');
    }

    // 무대에 선 사람
    const cast = h.stage?.cast ?? [];
    if (cast.length > 2) err('cast', where, `무대에 선 사람이 ${cast.length}명이다(두 명까지)`);
    for (const one of cast) {
      if (!(one.who in people)) err('who-unknown', `${where} 무대`, `등장인물 표(people)에 없는 사람 "${one.who}"`);
      if (one.pose !== undefined && !POSES.includes(one.pose)) err('cast', `${where} 무대`, `"${one.who}"의 기본 표정이 없는 표정 "${String(one.pose)}"이다`);
    }

    // 글: 여는 대화
    const checkLines = (lines: Line[] | undefined, at: string, kind: 'open' | 'result') => {
      const list = lines ?? [];
      list.forEach((line, index) => {
        const lw = `${at} ${index + 1}번째 창`;
        if (!line.text?.trim()) err('lines', lw, '글이 없다');
        checkBudget(err, lw, 'budget-line', line.text ?? '', BUDGET.line);
        if (line.who !== undefined && !(line.who in people)) err('who-unknown', lw, `등장인물 표(people)에 없는 사람 "${line.who}"`);
        if (line.pose !== undefined && !POSES.includes(line.pose)) err('lines', lw, `없는 표정 "${String(line.pose)}"`);
      });
      const [windows, chars] =
        kind === 'open'
          ? isMission
            ? [BUDGET.openWindows, BUDGET.openChars]
            : [BUDGET.extraOpenWindows, BUDGET.extraOpenChars]
          : isMission
            ? [BUDGET.resultWindows, BUDGET.resultChars]
            : [BUDGET.extraResultWindows, BUDGET.extraResultChars];
      const total = list.reduce((sum, line) => sum + countChars(line.text ?? ''), 0);
      const rule = kind === 'open' ? 'budget-open' : 'budget-result';
      const name = `${isMission ? '미션의 일' : '덤으로 하는 일'}의 ${kind === 'open' ? '여는 대화' : '결과 대화'}`;
      if (list.length > windows) err(rule, at, `${list.length}창이다(${name}는 ${windows}창까지)`);
      if (total > chars) err(rule, at, `모두 ${total}자다(${name}는 ${chars}자까지)`);
    };
    if (!h.lines || h.lines.length === 0) err('lines', `${where} 여는 대화`, '여는 대화가 없다');
    checkLines(h.lines, `${where} 여는 대화`, 'open');
    (h.lineVariants ?? []).forEach((variant, index) => {
      const at = `${where} 여는 대화 갈림 ${index + 1}`;
      if (!variant.lines || variant.lines.length === 0) err('lines', at, '대화가 없다');
      checkLines(variant.lines, at, 'open');
      checkCondition(variant.when, at, mode);
    });
    checkCondition(h.shows, `${where} 나타나는 조건`, mode);

    // 배움 쪽지
    const checkNote = (note: string | undefined, at: string, required: boolean) => {
      if (note === undefined && !required) return;
      if (!note?.trim()) {
        err('note', at, '배움 쪽지가 없다');
        return;
      }
      checkBudget(err, at, 'budget-note', note, BUDGET.note);
      if (!endsWithYo(note)) err('note-ending', at, `배움 쪽지는 설명체("~요")로 끝난다: "${note}"`);
    };
    checkNote(h.note, `${where} 배움 쪽지`, true);

    // 근거
    if (!h.facts || h.facts.length === 0) {
      err('facts', where, '근거 번호가 없다');
    } else {
      for (const fact of h.facts) {
        if (!sourceIds.has(fact)) err('facts', where, `sources.ts에 없는 근거 번호 "${fact}"`);
      }
    }

    // 결과 하나
    const checkOutcome = (outcome: Outcome, at: string, needLines: boolean) => {
      if (needLines && (!outcome.lines || outcome.lines.length === 0)) err('lines', at, '결과 대화가 없다');
      checkLines(outcome.lines, at, 'result');
      checkEffects(err, at, outcome.effects, isMission ? EFFECT_MAX : EXTRA_EFFECT_MAX);
      for (const card of outcome.cards ?? []) {
        if (!cardIds.has(card)) err('card-unknown', at, `cards.ts에 없는 카드 "${card}"`);
      }
      for (const item of outcome.items ?? []) {
        if (!itemIds.has(item)) err('item-unknown', at, `items.ts에 없는 물건 "${item}"`);
      }
      checkNote(outcome.note, `${at} 쪽지`, false);
      if (outcome.goTo !== undefined) {
        for (const role of liveFor(h)) {
          const map = refs.maps.find((one) => one.id === role.map);
          if (map && !map.hasSpot(outcome.goTo)) err('spot-unknown', at, `맵 "${role.map}"에 없는 자리 "${outcome.goTo}"(goTo)`);
        }
      }
    };
    const checkVariants = (base: AnyOutcome, at: string) => {
      (base.variants ?? []).forEach((variant, index) => {
        const vw = `${at} 결과 갈림 ${index + 1}`;
        checkOutcome(variant, vw, true);
        checkCondition(variant.when, vw, mode);
        // 갈린 결과는 바탕 결과를 통째로 갈음한다. 바탕의 카드·표시·물건·갈 자리를 다시 적지 않으면 그 갈림에서는 사라진다.
        const dropped = [
          ...(base.cards ?? []).filter((card) => !(variant.cards ?? []).includes(card)).map((card) => `카드 "${card}"`),
          ...(base.setFlags ?? []).filter((flag) => !(variant.setFlags ?? []).includes(flag)).map((flag) => `표시 "${flag}"`),
          ...(base.items ?? []).filter((item) => !(variant.items ?? []).includes(item)).map((item) => `물건 "${item}"`),
          ...(base.goTo !== undefined && variant.goTo !== base.goTo ? [`갈 자리 "${base.goTo}"`] : []),
        ];
        if (dropped.length > 0) {
          gap('variant-drops', vw, `바탕 결과에 있는 ${dropped.join(', ')}이(가) 이 갈린 결과에는 없다. 뜻한 것이 아니면 다시 적는다`);
        }
      });
    };

    // 선택지
    const choices = h.choices ?? [];
    const choiceIds = new Set<string>();
    for (const choice of choices) {
      const cw = `${where}/${choice.id || '(id 없음)'}`;
      if (!choice.id || choiceIds.has(choice.id)) err('choice', cw, '선택지 id가 없거나 겹친다');
      choiceIds.add(choice.id);
      if (!choice.label?.trim()) err('choice', cw, '선택지 글이 없다');
      checkBudget(err, `${cw} 선택지`, 'budget-label', choice.label ?? '', BUDGET.label);
      checkOutcome(choice, cw, true);
      checkVariants(choice, cw);
      for (const role of choice.only ?? []) if (!roleIds.has(role)) err('condition', cw, `없는 역할 "${role}"(only)`);
      if (choice.lock) {
        if (!choice.lock.reason?.trim()) err('lock-reason', cw, '잠긴 까닭이 없다');
        checkBudget(err, `${cw} 잠긴 까닭`, 'budget-lock', choice.lock.reason ?? '', BUDGET.lockReason);
        for (const blame of BLAME_WORDS) {
          if (choice.lock.reason?.includes(blame)) {
            err('lock-blame', cw, `잠긴 까닭이 사람을 탓한다("${blame}"). 제도나 형편을 주어로 쓴다`);
          }
        }
        checkCondition(choice.lock.unless, `${cw} 잠김`, mode);
        if (!situation.statusLocks && readsRoles(choice.lock.unless)) {
          err('status-lock', cw, '이 이야기는 신분으로 잠그지 않는다(statusLocks: false)');
        }
        // 잠긴 까닭이 형편마다 갈릴 때(처음 맞는 것이 뜬다). 바탕 까닭과 같은 잣대로 본다.
        (choice.lock.reasons ?? []).forEach((one, index) => {
          const rw = `${cw} 잠긴 까닭 갈림 ${index + 1}`;
          if (!one.reason?.trim()) err('lock-reason', rw, '잠긴 까닭이 없다');
          checkBudget(err, rw, 'budget-lock', one.reason ?? '', BUDGET.lockReason);
          for (const blame of BLAME_WORDS) {
            if (one.reason?.includes(blame)) {
              err('lock-blame', rw, `잠긴 까닭이 사람을 탓한다("${blame}"). 제도나 형편을 주어로 쓴다`);
            }
          }
          checkCondition(one.when, `${rw} 조건`, mode);
          if (!situation.statusLocks && readsRoles(one.when)) {
            err('status-lock', rw, '이 이야기는 신분으로 잠그지 않는다(statusLocks: false)');
          }
          if (one.reason === choice.lock?.reason) gap('lock-reason-same', rw, '바탕 까닭과 글이 같아 갈림이 쓸모없다');
        });
      }
    }
    // 선택지가 없는 일의 결과
    if (h.after) {
      if (choices.length > 0) gap('after-unused', where, '선택지가 있는 일의 after는 쓰이지 않는다');
      checkOutcome(h.after, `${where} 결과`, false);
      checkVariants(h.after, `${where} 결과`);
    }

    // 일 놀이
    if (h.play) {
      const flags = Object.entries(h.play.flags ?? {});
      if (!h.play.game?.trim()) err('play', where, '일 놀이의 이름(play.game)이 없다');
      if (flags.length === 0) err('play', where, '일 놀이가 끝난 모습(play.flags)이 하나도 없다');
      for (const [end, flag] of flags) if (!flag?.trim()) err('play', where, `놀이가 "${end}"로 끝났을 때 남길 표시가 없다`);
    }

    // 대화·결과·쪽지에 나온 숫자(연도 포함)가 이 일이 가리키는 근거의 글에 있는가
    const sourced = new Set(
      refs.sources.filter((source) => (h.facts ?? []).includes(source.id)).flatMap((source) => numbersIn(source.fact)),
    );
    for (const piece of textsOfHappening(h)) {
      if (piece.field === 'label' || piece.field === 'reason') continue;
      for (const number of new Set(numbersIn(piece.text))) {
        if (!sourced.has(number)) {
          gap(
            'number-unsourced',
            piece.where,
            `숫자 "${number}"가 이 일의 근거(${(h.facts ?? []).join(', ') || '없음'}) 글에 없다. 근거를 더하거나 숫자를 뺀다`,
          );
        }
      }
    }

    // ── 지금 이 일이 벌어지는 사람마다: 맵의 자리, 보이는 선택지, 어느 수치에서도 하나는 열림 ──
    const live = liveFor(h);
    if (live.length === 0 && SEASONS.includes(h.season)) {
      gap('happening-idle', where, `아직 쓰이지 않는 일이다(${h.season}에 이 일을 만날 역할이 만들어지지 않았다)`);
    }
    for (const role of live) {
      const who = `${where} (${role.id})`;
      const map = refs.maps.find((one) => one.id === role.map);
      if (map && h.spot) {
        if (!map.hasSpot(h.spot)) {
          err('spot-unknown', who, `맵 "${role.map}"에 없는 자리 "${h.spot}"`);
        } else {
          // 한쪽 모습에만 나타나는 일(shows.look)은 그 모습이 닿으면 된다(향교 가는 길은 남자아이 모습만 닿는다)
          for (const look of looksOf(h, role)) {
            if (!map.canReach(h.spot, { role: role.id, look })) {
              err('spot-unreachable', `${where} (${role.id}/${look})`, `자리 "${h.spot}"에 걸어서 닿을 수 없다`);
            }
          }
        }
      }
      if (choices.length === 0) continue;
      const shown = choices.filter((choice) => !choice.only || choice.only.includes(role.id));
      if (shown.length < 2 || shown.length > 3) {
        err('choices-count', who, `보이는 선택지가 ${shown.length}개다(2~3개여야 한다)`);
      }
      // 미션에 도움의 일이 있으면 모든 선택지가 잠겨도 길이 있다
      const rescued = missions.some(
        (m) => (!m.roles || m.roles.includes(role.id)) && m.parts.includes(h.id) && m.rescue !== undefined && happeningById.has(m.rescue),
      );
      if (rescued) continue;
      for (const look of looksOf(h, role)) {
        const stuck = findAllLocked(h, { role: role.id, look }, possibleDraws(pack, h.season));
        if (stuck) {
          err(
            'always-one-open',
            `${where} (${role.id}/${look})`,
            `고를 수 있는 선택지가 없는 때가 있다: 살림 ${stuck.stats.living}, 기력 ${stuck.stats.body}, 인심 ${stuck.stats.trust}, 표시 [${stuck.flags.join(', ')}], 물건 [${stuck.items.join(', ')}], 뽑기 ${stuck.draw ?? '없음'}`,
          );
          break;
        }
      }
    }
  }

  // ── 만들어진 것과 아직 없는 것 ──
  if (missions.length === 0 && happenings.length === 0) {
    gap('empty', sid, '미션과 일이 아직 하나도 없다');
  }
  for (const def of roles) {
    const where = `${sid} ${def.id}`;
    const seasons = built.get(def.id) ?? [];
    const mine = missions.filter((m) => m.must && (!m.roles || m.roles.includes(def.id)));
    if (seasons.length === 0) {
      if (mine.length > 0) err('season-order', where, '봄의 꼭 푸는 미션이 없는데 뒤 계절의 미션이 있다(봄부터 차례로 만든다)');
      else gap('role-empty', where, '이 역할의 미션이 아직 없다("준비 중"으로 보인다)');
      continue;
    }
    const ahead = mine.filter((m) => m.season !== 'year' && !seasons.includes(m.season as Season));
    if (ahead.length > 0) err('season-order', where, `앞 계절이 비었는데 뒤 계절의 미션이 있다: ${ahead.map((m) => m.id).join(', ')}`);
    const missing = SEASONS.filter((season) => !seasons.includes(season));
    if (missing.length > 0) gap('season-soon', where, `아직 만들지 않은 계절: ${missing.join(', ')}`);
    // 역할마다 꼭 푸는 미션 6~10개: 한 해가 다 만들어져야 맞는다
    if (mine.length < 6 || mine.length > 10) {
      (isComplete(def.id) ? err : gap)('mission-count', where, `꼭 푸는 미션이 ${mine.length}개다(한 해에 6~10개, 계절마다 1개 이상)`);
    }

    for (const season of seasons) {
      const sw = `${where} ${season}`;
      // 덤으로 하는 일이 해 ☀보다 많아야 어디로 갈지가 선택이 된다
      const extras = happenings.filter(
        (h) => h.season === season && h.cost === 1 && !rescueIds.has(h.id) && (!h.roles || h.roles.includes(def.id)),
      );
      // 봄은 덤이 해 ☀보다 많아야 한다(어디로 갈지가 선택이다 — 5.1). 뒤 계절은 봄보다 가볍게 잡아(1-라, 한 해 30분 안팎)
      // 둘은 있어야 하고(고를 것이 있게), 해보다 많지 않으면 알림만 한다.
      if (season === SEASONS[0] ? extras.length <= def.suns : extras.length < 2) {
        err(
          'extras-count',
          sw,
          season === SEASONS[0]
            ? `덤으로 하는 일이 ${extras.length}개다(해 ☀ ${def.suns}개보다 많아야 한다)`
            : `덤으로 하는 일이 ${extras.length}개다(둘은 있어야 한다)`,
        );
      } else if (extras.length <= def.suns) {
        gap('extras-few', sw, `덤으로 하는 일이 ${extras.length}개다(해 ☀ ${def.suns}개보다 많지 않아, 덤을 다 할 수 있다)`);
      }
    }

    // 인심이 깎이는 선택, 살림·기력 잠김: 한 해가 다 만들어진 역할이면 잘못, 그 전에는 알림. (신분 역할의 이야기) 신분 잠김은 알림
    const need = isComplete(def.id) ? err : gap;
    const mineH = happenings.filter((h) => (!h.roles || h.roles.includes(def.id)) && seasons.includes(h.season));
    const outcomes = mineH.flatMap((h) =>
      outcomesOfHappening(h, def.id).map(([, outcome]) => outcome),
    );
    const locks = mineH.flatMap((h) => (h.choices ?? []).filter((c) => (!c.only || c.only.includes(def.id)) && c.lock).map((c) => c.lock!.unless));
    if (!outcomes.some((outcome) => (outcome.effects?.trust ?? 0) < 0)) {
      need('trust-loss', where, '인심이 깎이는 선택이 하나도 없다(인심이 쌓이기만 해서는 안 된다 — 5.2의 9번)');
    }
    if (!locks.some((cond) => readsStat(cond, 'living'))) need('stat-lock', where, '살림 때문에 잠기는 선택지가 하나도 없다');
    if (!locks.some((cond) => readsStat(cond, 'body'))) need('stat-lock', where, '기력 때문에 잠기는 선택지가 하나도 없다');
    if (situation.statusLocks && def.kind === 'status' && !locks.some((cond) => readsRoles(cond))) {
      const hidden = mineH.some((h) => (h.choices ?? []).some((c) => c.only));
      if (!hidden) gap('status-lock-missing', where, '신분 때문에 잠기거나 숨는 선택지가 하나도 없다');
    }
  }

  // 일곱 물음이 미션에서 빠짐없이 다뤄지는가(6.2). 한 해가 다 만들어져야 맞는다.
  const covered = new Set<string>([
    ...missions.map((m) => m.theme),
    ...(roles.some((role) => role.kind === 'scene') ? happenings.map((h) => h.theme) : []),
  ]);
  for (const theme of THEME_IDS) {
    if ((missions.length > 0 || happenings.length > 0) && !covered.has(theme)) {
      const message = `견주기 물음 "${theme}"을 다루는 미션이 없다`;
      if (allComplete) err('theme-coverage', sid, message);
      else gap('theme-coverage', sid, `${message}(이야기를 다 만들 때까지는 알림만)`);
    }
  }

  // 한 해가 다 만들어진 역할마다: 그 역할이 미션(꼭 푸는 것과 덤 미션)으로 만나지 못하는 물음을 알린다.
  // 잘못은 아니다 — 이야기를 깨면 역할이 무엇이든 일곱 칸이 열리고(6.2), 농민 집 아이는 혼인을 미션으로 만나지 못한다(6.3).
  for (const def of roles) {
    if (!isComplete(def.id)) continue;
    const met = new Set<string>(missions.filter((m) => !m.roles || m.roles.includes(def.id)).map((m) => m.theme));
    const missed = THEME_IDS.filter((theme) => !met.has(theme));
    if (missed.length > 0) {
      gap('theme-role', `${sid} ${def.id}`, `이 역할이 미션으로 만나지 못하는 견주기 물음: ${missed.map((theme) => `"${theme}"`).join(', ')}`);
    }
  }

  // 남기기만 하고 아무 조건도 읽지 않는 표시. 뒤 계절이 아직 없어 읽히지 않는 것일 수 있으므로 한 해를 다 만들기 전에는 알림이다.
  // 그 표시를 남기는 일이 모두 한 해가 다 만들어진 역할의 것이면(뒤에 읽을 계절이 없다) 잘못이다.
  // 일 놀이의 끝난 모습 표시는 따로 본다: 놀이의 끝 가운데 하나라도 읽히면, 읽히지 않는 끝은 "그 밖의 끝"(바탕 결과)으로 쓰인 것이다.
  const playEnds = new Map<string, string[]>();
  for (const h of happenings) {
    const ends = Object.values(h.play?.flags ?? {}).filter(Boolean);
    for (const flag of ends) playEnds.set(flag, ends);
  }
  /** 표시 → 그 표시를 남기는 일들 */
  const setterHappenings = (flag: string): Happening[] =>
    happenings.filter(
      (h) => Object.values(h.play?.flags ?? {}).includes(flag) || outcomesOfHappening(h).some(([, outcome]) => (outcome.setFlags ?? []).includes(flag)),
    );
  for (const [flag, setters] of flagSetters) {
    if (flagsRead.has(flag)) continue;
    const siblings = playEnds.get(flag);
    if (siblings && siblings.some((other) => other !== flag && flagsRead.has(other))) continue;
    const final = allComplete || setterHappenings(flag).every((h) => settledFor(h.roles));
    (final ? err : gap)(
      'flag-unread',
      `${sid} 표시 ${flag}`,
      `남기기만 하고 아무 조건도 읽지 않는 표시다(남기는 곳: ${setters.join(', ')})${final ? '' : ' — 뒤 계절이 읽을 것이면 그대로 둔다'}`,
    );
  }

  // ── 막다른 길: 엔진으로 실제로 걸어 본다 ──
  // 뼈대가 어긋난 자료(없는 일을 가리키는 미션 등)는 걸어 보아도 뜻이 없으므로 그 잘못부터 고치게 한다.
  const broken = issues.some(
    (issue) => issue.level === 'error' && ['mission-parts', 'mission-rescue', 'happening', 'mission', 'roles', 'start-range', 'draw'].includes(issue.rule),
  );
  if (!broken && options.walk !== false) {
    for (const role of builtRoles) issues.push(...walkRole(pack, role.id).issues);
  }

  // ── 쓰지 않기로 한 낱말 ──
  for (const piece of textsOfPack(pack)) checkBanned(err, piece);

  return issues;
}

// ── 묶음에 함께 쓰는 자료 ──────────────────────────────────────

function checkShared(bundle: ContentBundle, issues: Issue[]): void {
  const err: Report = (rule, where, message) => issues.push({ level: 'error', rule, where, message });
  const gap: Report = (rule, where, message) => issues.push({ level: 'gap', rule, where, message });

  // 시기 묶음, 견주기 물음
  for (const id of GROUP_IDS) {
    if (bundle.groups.filter((group) => group.id === id).length !== 1) {
      err('groups', 'groups.ts', `시기 묶음 "${id}"가 없거나 겹친다`);
    }
  }
  for (const id of THEME_IDS) {
    const found = bundle.themes.filter((theme) => theme.id === id);
    if (found.length !== 1 || !found[0].question) err('themes', 'themes.ts', `견주기 물음 "${id}"가 없거나 겹친다`);
  }

  // 근거 목록
  const sourceIds = new Set<string>();
  for (const source of bundle.sources) {
    if (!/^F\d{2}$/.test(source.id)) err('sources', `sources.ts ${source.id}`, '근거 번호는 F와 숫자 두 자리다');
    if (sourceIds.has(source.id)) err('sources', `sources.ts ${source.id}`, '근거 번호가 겹친다');
    sourceIds.add(source.id);
    if (!source.fact || !source.source) err('sources', `sources.ts ${source.id}`, '사실이나 출처가 비었다');
  }

  // 장소
  const placeIds = new Set<string>();
  for (const place of bundle.places) {
    if (!place.id || placeIds.has(place.id) || !place.label) err('places', `장소 ${place.id}`, '장소 id·이름이 없거나 겹친다');
    placeIds.add(place.id);
  }

  // 맵
  const mapIds = new Set<string>();
  for (const map of bundle.maps) {
    if (!map.id || mapIds.has(map.id)) err('maps', `맵 ${map.id}`, '맵 id가 없거나 겹친다');
    mapIds.add(map.id);
  }

  // 이야기 목록
  const catalogIds = new Set<string>();
  const packIds = new Set(bundle.packs.map((pack) => pack.situation.id));
  for (const entry of bundle.catalog) {
    const where = `catalog.ts ${entry.id}`;
    if (!entry.id || catalogIds.has(entry.id)) err('catalog', where, '이야기 id가 없거나 겹친다');
    catalogIds.add(entry.id);
    if (!GROUP_IDS.includes(entry.group)) err('catalog', where, `없는 시기 묶음 "${entry.group}"`);
    if (!entry.title || !entry.blurb || !Number.isInteger(entry.year)) err('catalog', where, '이름·대표 해·한 줄 소개가 비었다');
    checkBudget(err, `${where} 한 줄 소개`, 'budget-blurb', entry.blurb ?? '', BUDGET.blurb);
    checkBanned(err, { where, field: 'blurb', text: `${entry.title} ${entry.blurb}` });
    if (!packIds.has(entry.id)) gap('situation-soon', where, '이야기 폴더가 아직 없다(준비 중으로 보인다)');
  }
  if (packIds.size !== bundle.packs.length) err('catalog', 'situations', '이야기 id가 겹치는 폴더가 있다');

  // 생활 카드
  const cardIds = new Set<string>();
  for (const card of bundle.cards) {
    const where = `cards.ts ${card.id}`;
    if (!card.id || cardIds.has(card.id)) err('cards', where, '카드 id가 없거나 겹친다');
    cardIds.add(card.id);
    if (!card.title || !card.text) err('cards', where, '카드 이름이나 글이 비었다');
    if (!catalogIds.has(card.situation)) err('cards', where, `없는 이야기 "${card.situation}"`);
    checkBudget(err, `${where} 이름`, 'budget-card', card.title ?? '', BUDGET.cardTitle);
    checkBudget(err, `${where} 글`, 'budget-card', card.text ?? '', BUDGET.cardText);
    if (!card.facts || card.facts.length === 0) err('facts', where, '근거 번호가 없다');
    for (const fact of card.facts ?? []) {
      if (!sourceIds.has(fact)) err('facts', where, `sources.ts에 없는 근거 번호 "${fact}"`);
    }
    checkBanned(err, { where, field: 'card', text: `${card.title} ${card.text}` });
  }

  // 봇짐의 물건
  const itemIds = new Set<string>();
  for (const item of bundle.items) {
    const where = `items.ts ${item.id}`;
    if (!item.id || itemIds.has(item.id)) err('items', where, '물건 id가 없거나 겹친다');
    itemIds.add(item.id);
    if (!item.label || !item.text) err('items', where, '물건 이름이나 글이 비었다');
    checkBudget(gap, `${where} 이름`, 'budget-soft', item.label ?? '', SOFT_BUDGET.itemLabel);
    checkBudget(gap, `${where} 글`, 'budget-soft', item.text ?? '', SOFT_BUDGET.itemText);
    checkBanned(err, { where, field: 'card', text: `${item.label} ${item.text}` });
  }
}

// ── 도구 ────────────────────────────────────────────────────

function checkBudget(report: Report, where: string, rule: string, text: string, limit: number): void {
  const length = countChars(text);
  if (length > limit) report(rule, where, `${length}자다(${limit}자까지)`);
}

function checkEffects(err: Report, where: string, effects: Outcome['effects'], limit: number): void {
  const lo = Math.max(EFFECT_MIN, -limit);
  const hi = Math.min(EFFECT_MAX, limit);
  for (const [stat, value] of Object.entries(effects ?? {})) {
    if (!STATS.includes(stat as Stat)) err('effect-range', where, `없는 수치 "${stat}"`);
    if (!Number.isInteger(value) || value < lo || value > hi) {
      err('effect-range', where, `수치 변화 ${stat} ${String(value)} (${lo}~+${hi}이어야 한다)`);
    }
  }
}

/** 배움 쪽지는 설명체다: 문장 부호를 떼고 "요"로 끝나는가 */
function endsWithYo(text: string): boolean {
  return text
    .trim()
    .replace(/[\s.!?…~"'“”‘’)\]]+$/u, '')
    .endsWith('요');
}

interface TextPiece {
  where: string;
  field: 'line' | 'label' | 'note' | 'reason' | 'lure' | 'role' | 'ending' | 'situation' | 'blurb' | 'card' | 'mission' | 'person';
  text: string;
}

function checkBanned(err: Report, piece: TextPiece): void {
  for (const banned of BANNED_WORDS) {
    if (!piece.text.includes(banned.word)) continue;
    if (piece.field === 'note' && banned.except?.includes('note')) continue;
    err('banned-word', piece.where, `쓰지 않기로 한 낱말 "${banned.word}" — ${banned.why}`);
  }
}

/** 이 일의 모든 결과(선택지와 그 갈림, 선택지가 없는 일의 결과와 그 갈림). role을 주면 그 역할에게 보이는 것만. */
function outcomesOfHappening(h: Happening, role?: RoleId): [string, Outcome][] {
  const out: [string, Outcome][] = [];
  for (const choice of h.choices ?? []) {
    if (role !== undefined && choice.only && !choice.only.includes(role)) continue;
    out.push([`${h.id}/${choice.id}`, choice]);
    (choice.variants ?? []).forEach((variant, index) => out.push([`${h.id}/${choice.id} 갈림 ${index + 1}`, variant]));
  }
  if (h.after) {
    out.push([`${h.id} 결과`, h.after]);
    (h.after.variants ?? []).forEach((variant, index) => out.push([`${h.id} 결과 갈림 ${index + 1}`, variant]));
  }
  return out;
}

function readsStat(cond: Condition | undefined, stat: Stat): boolean {
  if (!cond) return false;
  if (cond.min?.[stat] !== undefined || cond.max?.[stat] !== undefined) return true;
  return (cond.anyOf ?? []).some((one) => readsStat(one, stat));
}

function readsRoles(cond: Condition | undefined): boolean {
  if (!cond) return false;
  return Boolean(cond.roles) || (cond.anyOf ?? []).some((one) => readsRoles(one));
}

/** 이 일이 나타날 수 있는 모습들: 나타나는 조건(shows)이 한쪽 모습만 받으면 그 모습뿐이다 */
function looksOf(h: Happening, role: RoleDef): Look[] {
  const looks = role.looks ?? [];
  return h.shows?.look ? looks.filter((look) => look === h.shows?.look) : looks;
}

/** later가 earlier를 마친 뒤에야 나타나는 일인가: later의 나타나는 조건이 earlier(와 그 놀이)가 남기는 표시를 읽는다 */
function showsAfter(later: Happening, earlier: Happening): boolean {
  const left = new Set<string>([
    ...Object.values(earlier.play?.flags ?? {}),
    ...outcomesOfHappening(earlier).flatMap(([, outcome]) => outcome.setFlags ?? []),
  ]);
  // notFlags로 읽는 것은 "하기 전에만 나타난다"는 뜻이라 뺀다
  const wanted = new Set<string>();
  const want = (cond: Condition | undefined): void => {
    if (!cond) return;
    for (const flag of cond.flags ?? []) wanted.add(flag);
    for (const one of cond.anyOf ?? []) want(one);
  };
  want(later.shows);
  return [...wanted].some((flag) => left.has(flag));
}

/**
 * 글에 나온 아라비아 숫자들. 천 단위 쉼표는 떼고 센다("66,067" → "66067").
 * "구월", "열다섯"처럼 한글로 쓴 수는 잡지 못한다(사람이 본다).
 */
export function numbersIn(text: string): string[] {
  return (text.match(/\d(?:[\d,]*\d)?/g) ?? []).map((token) => token.replace(/,/g, ''));
}

/** 일 하나에서 화면에 보일 수 있는 모든 글 */
function textsOfHappening(h: Happening): TextPiece[] {
  const out: TextPiece[] = [];
  const pushLines = (lines: Line[] | undefined, at: string) =>
    (lines ?? []).forEach((line, index) => out.push({ where: `${at} ${index + 1}번째 창`, field: 'line', text: line.text ?? '' }));
  pushLines(h.lines, `${h.id} 여는 대화`);
  (h.lineVariants ?? []).forEach((variant, index) => pushLines(variant.lines, `${h.id} 여는 대화 갈림 ${index + 1}`));
  out.push({ where: `${h.id} 배움 쪽지`, field: 'note', text: h.note ?? '' });
  if (h.lure !== undefined) out.push({ where: `${h.id} 한마디`, field: 'lure', text: h.lure });
  for (const choice of h.choices ?? []) {
    out.push({ where: `${h.id}/${choice.id} 선택지`, field: 'label', text: choice.label ?? '' });
    if (choice.lock) out.push({ where: `${h.id}/${choice.id} 잠긴 까닭`, field: 'reason', text: choice.lock.reason ?? '' });
    (choice.lock?.reasons ?? []).forEach((one, index) =>
      out.push({ where: `${h.id}/${choice.id} 잠긴 까닭 갈림 ${index + 1}`, field: 'reason', text: one.reason ?? '' }),
    );
  }
  for (const [at, outcome] of outcomesOfHappening(h)) {
    pushLines(outcome.lines, at);
    if (outcome.note !== undefined) out.push({ where: `${at} 쪽지`, field: 'note', text: outcome.note });
  }
  return out;
}

/** 이야기 하나에서 화면에 보일 수 있는 모든 글 */
export function textsOfPack(pack: SituationPack): TextPiece[] {
  const out: TextPiece[] = [];
  const situation = pack.situation;
  const sid = situation.id;
  out.push({ where: `${sid} 이름`, field: 'situation', text: situation.title ?? '' });
  out.push({ where: `${sid} 뒷이야기`, field: 'situation', text: situation.epilogue ?? '' });
  out.push({ where: `${sid} 끝 물음`, field: 'situation', text: situation.openQuestion ?? '' });
  for (const theme of THEME_IDS) {
    out.push({ where: `${sid} 견주기 ${theme}`, field: 'situation', text: situation.themes?.[theme] ?? '' });
  }
  for (const season of SEASONS) {
    const row = situation.seasons?.[season];
    if (!row) continue;
    out.push({ where: `${sid} ${season} 첫 줄`, field: 'situation', text: row.line ?? '' });
    (row.lineVariants ?? []).forEach((variant, index) =>
      out.push({ where: `${sid} ${season} 첫 줄 갈림 ${index + 1}`, field: 'situation', text: variant.line ?? '' }),
    );
  }
  (situation.later ?? []).forEach((later, index) =>
    out.push({ where: `${sid} 나중 결과 ${index + 1}`, field: 'situation', text: later.line ?? '' }),
  );
  for (const [value, label] of Object.entries(situation.draw?.labels ?? {})) {
    out.push({ where: `${sid} 뽑기 ${value}`, field: 'situation', text: `${label.label ?? ''} ${label.line ?? ''}` });
  }
  for (const thing of situation.legacy ?? []) {
    out.push({ where: `${sid} 남길 것 ${thing.id}`, field: 'situation', text: thing.label ?? '' });
  }
  for (const [id, person] of Object.entries(situation.people ?? {})) {
    out.push({ where: `${sid} 사람 ${id}`, field: 'person', text: person.label ?? '' });
  }
  for (const def of situation.roles ?? []) {
    out.push({ where: `${sid} 역할 ${def.id}`, field: 'role', text: `${def.label ?? ''} ${def.intro ?? ''} ${def.wish ?? ''} ${def.family ?? ''}` });
    (def.wishOutcomes ?? []).forEach((row, index) =>
      out.push({ where: `${sid} 역할 ${def.id} 바람 ${index + 1}`, field: 'role', text: row.reason ?? '' }),
    );
  }
  for (const ending of situation.endings ?? []) {
    out.push({ where: `${sid} 한 해 이름 ${ending.id}`, field: 'ending', text: `${ending.title ?? ''} ${ending.line ?? ''}` });
  }
  for (const m of pack.missions ?? []) {
    out.push({ where: `미션 ${m.id}`, field: 'mission', text: `${m.title ?? ''} ${m.goal ?? ''} ${m.doneLine ?? ''}` });
  }
  for (const h of pack.happenings ?? []) out.push(...textsOfHappening(h));
  return out;
}

/** 그 계절의 일에서 뽑기가 가질 수 있는 값. 뽑기 전 계절이면 null뿐이다. */
function possibleDraws(pack: SituationPack, season: Season): (string | null)[] {
  const { kind, season: drawSeason } = pack.situation.draw ?? { kind: 'none' };
  const values = drawValues(kind);
  if (kind === 'none' || !drawSeason || values.length === 0) return [null];
  return SEASONS.indexOf(season) < SEASONS.indexOf(drawSeason) ? [null] : values;
}

/** 조건들에 나오는 수치의 경계, 표시, 물건을 모은다("또는" 안까지) */
function atomsOf(conditions: Condition[]): { stats: Record<Stat, Set<number>>; flags: string[]; items: string[] } {
  const stats: Record<Stat, Set<number>> = {
    living: new Set([STAT_MIN, STAT_MAX]),
    body: new Set([STAT_MIN, STAT_MAX]),
    trust: new Set([STAT_MIN, STAT_MAX]),
  };
  const flags = new Set<string>();
  const items = new Set<string>();
  const take = (cond: Condition): void => {
    for (const stat of STATS) {
      for (const bound of [cond.min?.[stat], cond.max?.[stat]]) {
        if (bound === undefined) continue;
        for (const value of [bound - 1, bound, bound + 1]) {
          if (value >= STAT_MIN && value <= STAT_MAX) stats[stat].add(value);
        }
      }
    }
    for (const flag of [...(cond.flags ?? []), ...(cond.notFlags ?? [])]) flags.add(flag);
    for (const item of cond.items ?? []) items.add(item);
    for (const one of cond.anyOf ?? []) take(one);
  };
  for (const cond of conditions) take(cond);
  return { stats, flags: [...flags].slice(0, 10), items: [...items].slice(0, 4) }; // 조합이 너무 늘지 않게
}

/**
 * 이 사람이 이 일에 왔을 때 보이는 선택지가 모두 잠기는 형편이 있는지 찾는다.
 * 잠김 조건에 나오는 수치의 경계값, 표시와 물건의 모든 조합, 뽑기의 모든 값을 다 넣어 본다.
 * 있으면 그 형편을, 없으면 null을 돌려준다. 선택지가 없는 일은 null이다.
 */
export function findAllLocked(h: Happening, who: { role: RoleId; look: Look }, draws: (string | null)[]): Facts | null {
  const choices = (h.choices ?? []).filter((choice) => !choice.only || choice.only.includes(who.role));
  const nothing: Facts = { ...who, stats: { living: 0, body: 0, trust: 0 }, flags: [], draw: null, items: [] };
  if ((h.choices ?? []).length === 0) return null;
  if (choices.length === 0) return nothing; // 이 사람에게 보이는 것이 하나도 없다
  if (choices.some((choice) => !choice.lock)) return null;

  const atoms = atomsOf(choices.map((choice) => choice.lock!.unless));
  const flagSets = 1 << atoms.flags.length;
  const itemSets = 1 << atoms.items.length;
  for (const draw of draws) {
    for (const living of atoms.stats.living) {
      for (const body of atoms.stats.body) {
        for (const trust of atoms.stats.trust) {
          const stats: Stats = { living, body, trust };
          for (let fm = 0; fm < flagSets; fm++) {
            const flags = atoms.flags.filter((_, index) => (fm >> index) & 1);
            for (let im = 0; im < itemSets; im++) {
              const items = atoms.items.filter((_, index) => (im >> index) & 1);
              const facts: Facts = { ...who, stats, flags, draw, items };
              if (choices.every((choice) => isLocked(choice, facts))) return facts;
            }
          }
        }
      }
    }
  }
  return null;
}

// ── 걸어 보기 ─────────────────────────────────────────────────

/** 한 번의 걸어 보기에서 살피는 상태 수의 한도(넘으면 알림을 남기고 멈춘다) */
const WALK_CAP = 40000;
/**
 * 한 계절에 걸을 수 있는 걸음의 한도. 일 하나는 한 번만 하므로 한 계절의 걸음은 그 계절의 일의 수를 넘지 못한다.
 * 이것을 넘으면 판이 나아가지 않는 것이다(엔진이 한 일을 적지 않는다, 다른 계절의 일이 끝없이 열린다 …).
 * 그때는 걷기를 그만두고 잘못으로 알린다(검사와 시험이 끝나지 않고 멈춰 있지 않게).
 */
const WALK_DEPTH = 80;
/** 다음 계절로 넘기는 "앞선 선택"의 가짓수 한도 */
const CARRY_CAP = 48;

/** 지금 할 수 있는 모든 움직임: 일 × 열린 선택지 × 놀이가 끝난 모습 */
function movesOf(pack: SituationPack, state: GameState): DoInput[] {
  const out: DoInput[] = [];
  for (const view of openHappenings(pack, state)) {
    if (view.noSun) continue;
    const h = view.happening;
    const choices: (string | undefined)[] = h.choices && h.choices.length > 0 ? openChoiceIds(pack, state, h.id) : [undefined];
    const ends = Object.keys(h.play?.flags ?? {});
    const plays: (string | undefined)[] = ends.length > 0 ? ends : [undefined];
    for (const choiceId of choices) for (const play of plays) out.push({ id: h.id, choiceId, play });
  }
  return out;
}

function moveLabel(move: DoInput): string {
  return [move.id, move.choiceId, move.play].filter((part) => part !== undefined).join('/');
}

/** 같은 형편인가를 가리는 열쇠(걸어온 차례가 달라도 형편이 같으면 한 번만 본다) */
function keyOf(state: GameState): string {
  const sorted = (list: readonly string[]) => [...list].sort().join(',');
  return [
    state.stats.living,
    state.stats.body,
    state.stats.trust,
    state.sunsLeft,
    sorted(state.flags),
    sorted(state.items),
    sorted(state.done),
    sorted(state.solved),
  ].join('|');
}

interface DeadEnd {
  path: string[];
  state: GameState;
}

interface WalkOut {
  states: number;
  dead: DeadEnd[];
  thrown: string[];
  /** 계절을 보낼 수 있게 된 형편들 */
  ends: GameState[];
  capped: boolean;
  /** 걸음이 끝없이 이어져 그만두었는가(판이 나아가지 않는다) */
  runaway: boolean;
}

/**
 * 한 계절을 엔진으로 걸어 본다(openHappenings로 할 수 있는 일을 얻고 doHappening으로 실제로 한다).
 * 막다른 길 = 꼭 푸는 미션이 남았는데 어떤 길로도 다 풀 수 없게 된 형편.
 * stopWhenDone이면 계절을 보낼 수 있게 된 뒤로는 더 걷지 않는다(풀린 미션은 다시 잠기지 않는다).
 * allow를 주면 그 일들만 한다(수치의 모서리마다 걸을 때 미션과 상관없는 덤을 빼려고).
 */
function walk(
  pack: SituationPack,
  start: GameState,
  stopWhenDone: boolean,
  onStep?: (after: GameState) => void,
  allow?: (happeningId: string) => boolean,
): WalkOut {
  const memo = new Map<string, boolean>();
  const out: WalkOut = { states: 0, dead: [], thrown: [], ends: [], capped: false, runaway: false };
  const reported = new Set<string>();
  const addDead = (dead: DeadEnd) => {
    const key = keyOf(dead.state);
    if (reported.has(key)) return;
    reported.add(key);
    out.dead.push(dead);
  };

  const visit = (state: GameState, path: string[]): boolean => {
    if (out.runaway) return true;
    if (path.length > WALK_DEPTH) {
      out.runaway = true;
      out.thrown.push(`한 계절에 ${WALK_DEPTH}걸음을 넘게 걸었다(판이 나아가지 않는다): ${path.slice(0, 4).join(' → ')} …`);
      return true;
    }
    const key = keyOf(state);
    const known = memo.get(key);
    if (known !== undefined) return known;
    if (memo.size >= WALK_CAP) {
      out.capped = true;
      return true;
    }
    memo.set(key, false);
    out.states++;
    const closable = canCloseSeason(pack, state);
    if (closable) out.ends.push(state);
    if (closable && stopWhenDone) {
      memo.set(key, true);
      return true;
    }
    let ok = closable;
    const bad: DeadEnd[] = [];
    let moves: DoInput[] = [];
    try {
      moves = movesOf(pack, state);
      if (allow) moves = moves.filter((move) => allow(move.id));
    } catch (error) {
      out.thrown.push(`${path.join(' → ') || '(처음)'}: ${(error as Error).message}`);
    }
    for (const move of moves) {
      const nextPath = [...path, moveLabel(move)];
      let next: GameState;
      try {
        next = doHappening(pack, state, move);
      } catch (error) {
        out.thrown.push(`${nextPath.join(' → ')}: ${(error as Error).message}`);
        continue;
      }
      onStep?.(next);
      if (visit(next, nextPath)) ok = true;
      else bad.push({ path: nextPath, state: next });
    }
    memo.set(key, ok);
    // 여기서는 길이 있는데 그 걸음을 디디면 길이 없어지는 곳만 알린다(그 뒤의 형편들은 되풀이해 알리지 않는다)
    if (ok) for (const dead of bad) addDead(dead);
    return ok;
  };

  if (!visit(start, [])) addDead({ path: [], state: start });
  return out;
}

/** 어느 계절의 처음 형편을 만든다: 수치, 뽑기, 앞 계절에서 넘어온 표시와 물건을 정해서 */
function seasonStart(
  pack: SituationPack,
  role: RoleId,
  look: Look,
  seasonIndex: number,
  stats: Stats,
  draw: string | null,
  carry: { flags: string[]; items: string[] },
): GameState {
  const base = newGame(pack, role, look, 1);
  const before = pack.missions
    .filter((m) => m.must && m.season !== 'year' && SEASONS.indexOf(m.season) < seasonIndex && (!m.roles || m.roles.includes(role)))
    .map((m) => m.id);
  return {
    ...base,
    stats,
    flags: carry.flags,
    items: carry.items,
    draw,
    seasonIndex,
    sunsLeft: sunsFor(pack, role, stats),
    solved: before,
    flow: Array.from({ length: seasonIndex + 1 }, () => stats),
  };
}

/** 조건이 읽는 표시와 물건을 모은다("또는" 안까지) */
function takeReads(cond: Condition | undefined, flags: Set<string>, items: Set<string>): void {
  if (!cond) return;
  for (const flag of [...(cond.flags ?? []), ...(cond.notFlags ?? [])]) flags.add(flag);
  for (const item of cond.items ?? []) items.add(item);
  for (const one of cond.anyOf ?? []) takeReads(one, flags, items);
}

/** 일 하나가 나타나고, 잠기고, 결과가 갈리는 데 읽는 표시와 물건 */
function readsOfHappening(h: Happening, flags: Set<string>, items: Set<string>): void {
  takeReads(h.shows, flags, items);
  for (const choice of h.choices ?? []) {
    takeReads(choice.lock?.unless, flags, items);
    for (const one of choice.lock?.reasons ?? []) takeReads(one.when, flags, items);
    for (const variant of choice.variants ?? []) takeReads(variant.when, flags, items);
  }
  for (const variant of h.after?.variants ?? []) takeReads(variant.when, flags, items);
}

/**
 * 그 계절의 꼭 푸는 미션에 걸리는 일들: 해 ☀가 들지 않는 일(미션의 일과 도움의 일) 모두와,
 * 덤으로 하는 일 가운데 미션의 일이 읽는 표시나 물건을 남기는 것(그런 덤을 거쳐 이어지는 덤까지).
 * 그 밖의 덤은 수치를 ±1 바꿀 뿐이라, 수치의 모서리마다 걸을 때는 빼도 미션이 풀리는지에 걸리지 않는다.
 */
function mustRelated(pack: SituationPack, role: RoleId, season: Season): Set<string> {
  const mine = pack.happenings.filter((h) => h.season === season && (!h.roles || h.roles.includes(role)));
  const related = new Set(mine.filter((h) => h.cost === 0).map((h) => h.id));
  const flags = new Set<string>();
  const items = new Set<string>();
  for (const m of pack.missions) {
    if (m.must && m.season === season && (!m.roles || m.roles.includes(role))) takeReads(m.done, flags, items);
  }
  for (let grew = true; grew; ) {
    grew = false;
    for (const h of mine) if (related.has(h.id)) readsOfHappening(h, flags, items);
    for (const h of mine) {
      if (related.has(h.id)) continue;
      const gives = outcomesOfHappening(h).some(
        ([, outcome]) => (outcome.setFlags ?? []).some((flag) => flags.has(flag)) || (outcome.items ?? []).some((item) => items.has(item)),
      );
      const plays = Object.values(h.play?.flags ?? {}).some((flag) => flags.has(flag));
      if (gives || plays) {
        related.add(h.id);
        grew = true;
      }
    }
  }
  return related;
}

/** 수치 세 가지의 모서리와 가운데(0·5·10의 모든 짝) */
function statGrid(): Stats[] {
  const values = [STAT_MIN, Math.round((STAT_MIN + STAT_MAX) / 2), STAT_MAX];
  const out: Stats[] = [];
  for (const living of values) for (const body of values) for (const trust of values) out.push({ living, body, trust });
  return out;
}

const statsText = (stats: Stats) => `살림 ${stats.living}·기력 ${stats.body}·인심 ${stats.trust}`;

/**
 * 막다른 길이 없는가: 이 역할의 만들어진 계절마다, 두 모습 모두, 뽑기의 모든 값, 앞 계절의 선택마다 엔진으로 걸어,
 * 어느 걸음에서도 꼭 푸는 미션을 다 풀 길이 남아 있는지 본다.
 *   ㉠ 시작 수치와 바닥(0·0·0)에서는 덤까지 모든 길을 걷는다.
 *   ㉡ 수치의 모서리와 가운데(0·5·10의 스물일곱 짝)에서는 미션의 일과 미션에 걸리는 덤의 모든 길을 걷는다
 *      (미션과 상관없는 덤은 수치를 ±1 바꿀 뿐이라 뺀다 — 다 넣으면 계절이 늘 때 너무 느려진다).
 * 함께, 미션마다 푸는 길이 둘 이상이고 길에 따라 결과가 다른지 센다(5.1의 ㉡).
 * 걸어 본 횟수와 살핀 형편의 수도 돌려준다(시험에서 찍어 본다).
 */
export function walkRole(pack: SituationPack, roleId: RoleId): { walks: number; states: number; issues: Issue[] } {
  const issues: Issue[] = [];
  const count = { walks: 0, states: 0, issues };
  const err: Report = (rule, where, message) => issues.push({ level: 'error', rule, where, message });
  const gap: Report = (rule, where, message) => issues.push({ level: 'gap', rule, where, message });
  const role = pack.situation.roles.find((one) => one.id === roleId);
  if (!role) return count;
  const seasons = builtSeasons(pack, roleId);
  const sid = pack.situation.id;
  const ways = new Map<string, Set<string>>();
  const results = new Map<string, Set<string>>();
  const musts = pack.missions.filter((m) => m.must && (!m.roles || m.roles.includes(role.id)) && m.season !== 'year' && seasons.includes(m.season));
  for (const m of musts) {
    ways.set(m.id, new Set());
    results.set(m.id, new Set());
  }
  const onStep = (after: GameState) => {
    const deed = after.history[after.history.length - 1];
    for (const id of deed?.solved ?? []) {
      if (!ways.has(id)) continue;
      const mine = after.history.filter((d) => d.missionId === id && d.season === deed.season);
      ways.get(id)?.add(mine.map((d) => [d.happeningId, d.choiceId ?? '-', d.play ?? '-'].join('/')).join(' → '));
      results.get(id)?.add(JSON.stringify(mine.map((d) => [d.requested, d.newFlags, d.newCards, d.newItems, d.lines.map((line) => line.text)])));
    }
  };

  // 뒤 계절이 읽는 표시와 물건만 넘긴다(가짓수를 줄이려고)
  const readLater = (afterIndex: number): { flags: Set<string>; items: Set<string> } => {
    const flags = new Set<string>();
    const items = new Set<string>();
    for (const h of pack.happenings) {
      if (SEASONS.indexOf(h.season) > afterIndex && (!h.roles || h.roles.includes(role.id))) readsOfHappening(h, flags, items);
    }
    // 뒤 계절의 꼭 푸는 미션이 풀렸는지 가리는 표시(덤 미션은 계절을 넘기는 데 걸리지 않는다)
    for (const m of pack.missions) {
      if (m.must && m.season !== 'year' && SEASONS.indexOf(m.season) > afterIndex) takeReads(m.done, flags, items);
    }
    return { flags, items };
  };

  let carries: { flags: string[]; items: string[] }[] = [{ flags: [], items: [] }];
  let shown = 0;
  const grid = statGrid();
  const floor: Stats = { living: STAT_MIN, body: STAT_MIN, trust: STAT_MIN };
  const middle = grid[13];
  const ceiling: Stats = { living: STAT_MAX, body: STAT_MAX, trust: STAT_MAX };

  for (const season of seasons) {
    const seasonIndex = SEASONS.indexOf(season);
    const next = new Map<string, { flags: string[]; items: string[] }>();
    const keep = seasonIndex + 1 < SEASONS.length && seasons.includes(SEASONS[seasonIndex + 1]) ? readLater(seasonIndex) : null;
    const related = mustRelated(pack, role.id, season);
    // 덤까지 모든 길을 걷는 처음 수치: 봄은 이 역할의 시작 수치와 바닥, 뒤 계절은 가운데와 두 끝
    const fullStarts: Stats[] = seasonIndex === 0 ? [role.start, floor] : [middle, floor, ceiling];

    /** 한 번 걷고 찾은 것을 적는다 */
    const run = (look: Look, draw: string | null, carry: { flags: string[]; items: string[] }, stats: Stats, full: boolean): boolean => {
      const where = `${sid} ${role.id}/${look} ${season}`;
      let start: GameState;
      try {
        start = seasonStart(pack, role.id, look, seasonIndex, stats, draw, carry);
      } catch (error) {
        err('dead-end', where, `걸어 볼 수 없다: ${(error as Error).message}`);
        return false;
      }
      const out = walk(pack, start, true, onStep, full ? undefined : (id) => related.has(id));
      count.walks++;
      count.states += out.states;
      const from = `처음 수치 ${statsText(stats)}, 뽑기 ${draw ?? '없음'}${carry.flags.length > 0 ? `, 앞선 표시 [${carry.flags.join(', ')}]` : ''}`;
      for (const dead of out.dead) {
        if (++shown > 12) break; // 같은 까닭이 수치마다 되풀이되어 쏟아지지 않게
        const missing = missingMusts(pack, dead.state)
          .map((m) => `「${m.title}」`)
          .join(', ');
        err(
          'dead-end',
          where,
          `막다른 길: ${missing}을(를) 풀 길이 없어진다 — ${from}, 걸어온 길 ${dead.path.length > 0 ? dead.path.join(' → ') : '(처음부터)'}, 그때 수치 ${statsText(dead.state.stats)}`,
        );
      }
      for (const thrown of out.thrown.slice(0, 3)) err('walk-throw', where, `걷다가 엔진이 멈췄다 — ${from}: ${thrown}`);
      if (out.capped) gap('walk-capped', where, `길이 너무 많아 ${WALK_CAP}가지 형편까지만 걸어 보았다`);
      // 판이 나아가지 않거나 길이 한도를 넘게 많으면 다른 처음 형편으로 걸어 보아도 같다. 이 역할의 걷기를 그만둔다
      // (한 번에 한도까지 걷는 일을 수십 번 되풀이하지 않게 — 검사와 시험이 멈춰 있지 않게).
      if (out.runaway || out.capped) return false;
      return true;
    };

    for (const look of role.looks) {
      for (const draw of possibleDraws(pack, season)) {
        for (const carry of carries) {
          // ㉠ 덤까지 모든 길
          for (const stats of fullStarts) if (!run(look, draw, carry, stats, true)) return count;
          // ㉡ 수치의 모서리와 가운데(0·5·10의 스물일곱 짝)마다: 미션의 일과 미션에 걸리는 덤의 모든 길
          for (const stats of grid) if (!run(look, draw, carry, stats, false)) return count;
          // 다음 계절로 넘어갈 "앞선 선택": 덤까지 다 걸어, 계절을 보낼 수 있는 형편마다 남은 표시와 물건
          if (keep) {
            const out = walk(pack, seasonStart(pack, role.id, look, seasonIndex, fullStarts[0], draw, carry), false);
            for (const end of out.ends) {
              const flags = end.flags.filter((flag) => keep.flags.has(flag)).sort();
              const items = end.items.filter((item) => keep.items.has(item)).sort();
              next.set(`${flags.join(',')}|${items.join(',')}`, { flags, items });
            }
          }
        }
      }
    }
    if (keep) {
      carries = [...next.values()];
      if (carries.length === 0) carries = [{ flags: [], items: [] }];
      if (carries.length > CARRY_CAP) {
        gap('walk-capped', `${sid} ${role.id} ${season}`, `앞선 선택이 ${carries.length}가지라 ${CARRY_CAP}가지만 다음 계절로 넘겨 걸어 보았다`);
        carries = carries.slice(0, CARRY_CAP);
      }
    }
  }

  // 답을 맞혀야 풀리는 미션이 없다: 푸는 길이 둘 이상이고 길에 따라 결과가 다르다
  for (const m of musts) {
    const where = `미션 ${m.id} (${role.id})`;
    const wayCount = ways.get(m.id)?.size ?? 0;
    const resultCount = results.get(m.id)?.size ?? 0;
    if (wayCount === 0) continue; // 풀 길이 없으면 위에서 막다른 길로 알렸다
    if (wayCount < 2) err('mission-one-way', where, `푸는 길이 하나뿐이다(${[...(ways.get(m.id) ?? [])].join('')}). 미션은 푸는 길이 둘 이상이어야 한다`);
    else if (resultCount < 2) err('mission-one-way', where, '어느 길로 풀어도 결과(수치·얻는 것·이야기)가 같다');
  }
  return count;
}

// ── 글자 수와 시간 어림 ─────────────────────────────────────────

export interface PathSize {
  /** 읽는 글자 수(빈칸 포함): 계절 첫 줄, 할 일 쪽지, 여는 대화, 보이는 선택지와 잠긴 까닭, 결과 대화, 배움 쪽지, "해낸 일" */
  chars: number;
  /** 한 일의 수 */
  happenings: number;
  /** 한 일 놀이의 수 */
  plays: number;
  /** 읽는 데 드는 시간(분, 분당 300자) */
  readMinutes: number;
  /** 걸어가기·일 놀이·계절 열고 닫기를 더한 어림(분) */
  minutes: number;
}

export interface SeasonSize {
  role: RoleId;
  look: Look;
  season: Season;
  /** 꼭 푸는 미션만 한 길(가장 짧은 길과 가장 긴 길) */
  must: { short: PathSize; long: PathSize };
  /** 해 ☀가 닿는 대로 덤까지 다 한 길 */
  all: { short: PathSize; long: PathSize };
}

function sizeOf(chars: number, happenings: number, plays: number): PathSize {
  const readMinutes = chars / READ_PER_MINUTE;
  const minutes = readMinutes + (happenings * WALK_SECONDS + plays * PLAY_SECONDS + SEASON_SECONDS) / 60;
  return { chars, happenings, plays, readMinutes: Math.round(readMinutes * 10) / 10, minutes: Math.round(minutes * 10) / 10 };
}

const sumChars = (texts: (string | undefined)[]): number => texts.reduce((sum: number, text) => sum + countChars(text ?? ''), 0);

/** 이 일을 이 선택으로 했을 때 읽게 되는 글자 수 */
function charsOfStep(pack: SituationPack, before: GameState, move: DoInput, after: GameState): number {
  const h = happeningOf(pack, move.id);
  const facts: Facts = { role: before.role, look: before.look, stats: before.stats, flags: before.flags, draw: before.draw, items: before.items };
  const deed = after.history[after.history.length - 1];
  const views = choiceViews(pack, before, h.id);
  const solved = pack.missions.filter((m) => deed.solved.includes(m.id));
  return sumChars([
    ...linesOf(h, facts).map((line) => line.text),
    ...views.flatMap((view) => [view.label, view.reason]),
    ...deed.lines.map((line) => line.text),
    deed.note,
    ...solved.map((m) => m.doneLine),
  ]);
}

/**
 * 한 계절의 글자 수와 시간 어림. from을 주지 않으면 그 역할·모습으로 새로 시작한 봄을 잰다.
 * 길마다 글이 다르므로 가장 짧은 길과 가장 긴 길을 함께 돌려준다. 풀 수 없는 계절이면 null.
 */
export function measureSeason(pack: SituationPack, role: RoleId, look: Look, from?: GameState): SeasonSize | null {
  const start = from ?? newGame(pack, role, look, 1);
  const season = currentSeason(start);
  const opening = sumChars([seasonLine(pack, start), ...missionsOf(pack, role, season).flatMap((m) => [m.title, m.goal])]);

  type Span = { min: [number, number, number]; max: [number, number, number] } | null;
  const measure = (mustOnly: boolean): Span => {
    const memo = new Map<string, Span>();
    const visit = (state: GameState, depth = 0): Span => {
      if (depth > WALK_DEPTH) throw new Error(`한 계절에 ${WALK_DEPTH}걸음을 넘게 걸었다(판이 나아가지 않는다)`);
      const key = keyOf(state);
      if (memo.has(key)) return memo.get(key) ?? null;
      if (memo.size >= WALK_CAP) throw new Error(`길이 너무 많아 셀 수 없다(${WALK_CAP}가지 형편을 넘는다)`);
      memo.set(key, null);
      const closable = canCloseSeason(pack, state);
      let span: Span = null;
      if (mustOnly && closable) {
        span = { min: [0, 0, 0], max: [0, 0, 0] };
      } else {
        const moves = movesOf(pack, state).filter((move) => !mustOnly || happeningOf(pack, move.id).cost === 0);
        if (moves.length === 0 && closable) span = { min: [0, 0, 0], max: [0, 0, 0] };
        for (const move of moves) {
          const next = doHappening(pack, state, move);
          const rest = visit(next, depth + 1);
          if (!rest) continue;
          const chars = charsOfStep(pack, state, move, next);
          const play = happeningOf(pack, move.id).play ? 1 : 0;
          const low: [number, number, number] = [rest.min[0] + chars, rest.min[1] + 1, rest.min[2] + play];
          const high: [number, number, number] = [rest.max[0] + chars, rest.max[1] + 1, rest.max[2] + play];
          if (!span) span = { min: low, max: high };
          else span = { min: low[0] < span.min[0] ? low : span.min, max: high[0] > span.max[0] ? high : span.max };
        }
      }
      memo.set(key, span);
      return span;
    };
    return visit(start);
  };

  const must = measure(true);
  const all = measure(false);
  if (!must || !all) return null;
  const size = (t: [number, number, number]) => sizeOf(t[0] + opening, t[1], t[2]);
  return {
    role,
    look,
    season,
    must: { short: size(must.min), long: size(must.max) },
    all: { short: size(all.min), long: size(all.max) },
  };
}
