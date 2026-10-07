// 자료와 상태의 꼴. spec.md 10절 "자료의 꼴"을 따르고, 거기에 없는 칸은 [더함]이라고 적었다.
// 이 파일과 engine 폴더는 화면·브라우저·시간을 모른다.

export const GROUP_IDS = ['early', 'middle', 'late', 'opening'] as const; // 3단원 때 묶음을 더한다
export type GroupId = (typeof GROUP_IDS)[number];

export const ROLE_IDS = ['son', 'daughter', 'farmer', 'nobi'] as const; // 이름·소개는 상황이 정한다
export type RoleId = (typeof ROLE_IDS)[number];

export const STATS = ['living', 'body', 'trust'] as const; // 살림·기력·인심
export type Stat = (typeof STATS)[number];

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

// 6.2의 일곱 물음
export const THEME_IDS = ['farming', 'paying', 'marriage', 'inheritance', 'learning', 'duty', 'play'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type Stats = Record<Stat, number>;
export type StatDelta = Partial<Record<Stat, number>>;

/** 수치는 0~10, 선택 하나의 변화는 -3~+3 (5절 2번) */
export const STAT_MIN = 0;
export const STAT_MAX = 10;
export const EFFECT_MIN = -3;
export const EFFECT_MAX = 3;
/** 한 판은 8장면: 계절 넷 × (내 장면 1 + 세상 장면 1) */
export const SCENES_PER_SEASON = 2;
export const SCENES_PER_YEAR = SEASONS.length * SCENES_PER_SEASON;

export type DrawKind = 'weather' | 'war' | 'none';

/**
 * 조건. 적힌 칸을 모두 채워야 참이다. 아무것도 적지 않으면 언제나 참이다.
 * [더함] max, notFlags — "살림이 2 이하면", "아버지가 공사에 가지 않았으면" 같은 조건에 쓴다.
 */
export interface Condition {
  roles?: RoleId[];
  min?: StatDelta;
  max?: StatDelta;
  flags?: string[];
  notFlags?: string[];
  draw?: string;
}

export interface Outcome {
  effects?: StatDelta;
  setFlags?: string[];
  cards?: string[];
  result: string;
}

export interface Choice extends Outcome {
  id: string;
  label: string;
  /** 잠김 조건과 보여 줄 까닭. unless가 참이면 열리고, 거짓이면 잠긴다. */
  lock?: { unless: Condition; reason: string };
  /**
   * 집·수치·앞선 선택·뽑기에 따라 갈리는 결과.
   * 위에서부터 보아 when이 처음 맞는 것 하나가 바탕 결과를 통째로 갈음한다(합치지 않는다).
   */
  variants?: (Outcome & { when: Condition })[];
}

export interface Scene {
  id: string;
  situation: string;
  season: Season;
  kind: 'mine' | 'world';
  role?: RoleId; // kind가 'mine'일 때만
  order: 1 | 2;
  theme: ThemeId;
  place: string;
  text: string;
  /** [더함] 뽑기·앞선 선택에 따라 달라지는 지문. 처음 맞는 것 하나가 text를 갈음한다. */
  textVariants?: { when: Condition; text: string }[];
  choices: Choice[];
  note: string; // 배움 쪽지
  facts: string[]; // 근거 F번호, 1개 이상
  /** [더함] 견본 장면 표시. 대본을 쓸 때 다시 다듬을 장면이다. */
  sample?: boolean;
}

/** [더함] 올해의 바람이 이루어졌는지 가리는 줄. 위에서부터 처음 맞는 것을 쓴다. 마지막 줄은 조건이 없어야 한다. */
export interface WishOutcome {
  when?: Condition;
  fulfilled: boolean;
  reason: string;
}

export interface RoleDef {
  label: string;
  intro: string;
  start: Stats;
  wish: string;
  /** [더함] 아직 장면이 없는 집은 비워 둘 수 있다. */
  wishOutcomes: WishOutcome[];
}

/** [더함] 한 해 이름(끝맺음). 위에서부터 처음 맞는 것을 쓴다. 마지막 줄은 조건이 없어야 한다. */
export interface Ending {
  id: string;
  title: string;
  line: string;
  when?: Condition;
}

export interface Situation {
  id: string;
  group: GroupId;
  year: number;
  title: string;
  lessons: string; // 지도서 차시
  calendar: 'lunar' | 'solar';
  roles: Record<RoleId, RoleDef>;
  draw: { kind: DrawKind; season?: Season };
  statusLocks: boolean; // 신분으로 잠그는가(⑦은 false)
  themes: Record<ThemeId, string>; // 견주기 물음 일곱 개의 이 상황 답
  epilogue: string; // 뒷이야기
  openQuestion: string; // 끝 물음
  /** [더함] 한 해 이름 목록 */
  endings: Ending[];
}

/** 상황 하나와 그 장면들. 엔진의 모든 함수는 이것을 받아서 일한다. */
export interface SituationPack {
  situation: Situation;
  scenes: Scene[];
}

// ── 곁 자료의 꼴 ──────────────────────────────────────────────

export interface Group {
  id: GroupId;
  label: string;
}

export interface Theme {
  id: ThemeId;
  question: string;
}

export interface Card {
  id: string;
  situation: string;
  title: string;
  text: string;
  facts: string[];
}

export interface Source {
  id: string; // F번호
  fact: string;
  source: string;
  check: string;
}

export interface Place {
  id: string;
  label: string;
}

/** 고르기 화면에 늘어놓는 상황 한 줄. 장면 폴더가 없으면 "준비 중"으로 보인다. */
export interface CatalogEntry {
  id: string;
  group: GroupId;
  year: number;
  title: string;
  blurb: string;
  lessons: string;
}

// ── 판의 상태 ────────────────────────────────────────────────

export type Phase = 'seasonOpen' | 'scene' | 'result' | 'seasonClose' | 'done';

/** 고른 일 하나의 기록 */
export interface Turn {
  sceneId: string;
  season: Season;
  kind: 'mine' | 'world';
  theme: ThemeId;
  choiceId: string;
  label: string;
  result: string;
  note: string;
  /** 자료에 적힌 변화(-3~+3으로 다듬은 것) */
  requested: Stats;
  /** 0~10 안에서 실제로 바뀐 만큼 */
  delta: Stats;
  before: Stats;
  after: Stats;
  newCards: string[];
  newFlags: string[];
}

export interface GameState {
  situationId: string;
  role: RoleId;
  seed: number;
  stats: Stats;
  flags: string[];
  cards: string[];
  /** 뽑기 결과. 뽑는 계절에 들어서기 전에는 null이다. */
  draw: string | null;
  seasonIndex: number; // 0~3
  slot: number; // 계절 안의 몇 번째 장면인가: 0 또는 1
  phase: Phase;
  history: Turn[];
  /** 수치의 흐름: [처음, 봄을 보낸 뒤, 여름을 보낸 뒤, …] */
  flow: Stats[];
}

/** 조건을 가릴 때 보는 것 */
export interface Facts {
  role: RoleId;
  stats: Stats;
  flags: readonly string[];
  draw: string | null;
}
