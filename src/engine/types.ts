// 자료와 상태의 꼴(바퀴 1-다에서 "미션과 일"로 고쳐 썼다). spec.md 10절 "자료의 꼴"을 따르고, 거기에 없는 칸은 [더함]이라고 적었다.
// 이 파일과 engine 폴더는 화면·브라우저·시간·맵의 좌표를 모른다.

export const GROUP_IDS = ['early', 'middle', 'late', 'opening'] as const; // 3단원 때 묶음을 더한다
export type GroupId = (typeof GROUP_IDS)[number];

/** 역할의 이름은 이야기가 정한다(①은 son·daughter·farmer·nobi) */
export type RoleId = string;

/** 주인공의 모습. 남녀 어느 쪽이든 될 수 있는 역할은 시작할 때 고른다. */
export type Look = 'boy' | 'girl';

export const STATS = ['living', 'body', 'trust'] as const; // 살림·기력·인심
export type Stat = (typeof STATS)[number];

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

// 6.2의 일곱 물음
export const THEME_IDS = ['farming', 'paying', 'marriage', 'inheritance', 'learning', 'duty', 'play'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type Stats = Record<Stat, number>;
export type StatDelta = Partial<Record<Stat, number>>;

/** 수치는 0~10 */
export const STAT_MIN = 0;
export const STAT_MAX = 10;
/** 미션의 선택 하나는 -3~+3, 덤으로 하는 일은 -1~+1 (5.2의 1번) */
export const EFFECT_MIN = -3;
export const EFFECT_MAX = 3;
export const EXTRA_EFFECT_MAX = 1;
/** 기력이 이 값 이하이면 계절의 해 ☀가 하나 준다(5.1) */
export const TIRED_AT = 2;

export type DrawKind = 'weather' | 'war' | 'none';

/**
 * 조건. 적힌 칸을 모두 채워야 참이다. 아무것도 적지 않으면 언제나 참이다.
 */
export interface Condition {
  roles?: RoleId[];
  min?: StatDelta;
  max?: StatDelta;
  flags?: string[];
  notFlags?: string[];
  draw?: string;
  /** 이 가운데 하나라도 참("또는") */
  anyOf?: Condition[];
  /** 봇짐에 이 물건이 모두 있어야 */
  items?: string[];
  /** 고른 주인공 모습 */
  look?: Look;
}

/** 대화창 한 창. who가 없으면 "나"의 이야기 줄이다. */
export interface Line {
  who?: string;
  pose?: 'plain' | 'glad' | 'worried';
  text: string;
}

export interface Outcome {
  effects?: StatDelta;
  setFlags?: string[];
  cards?: string[];
  items?: string[];
  /** 결과 대화(세 창까지) */
  lines: Line[];
  /** 이 선택에만 붙는 쪽지(있으면 일의 쪽지를 갈음한다) */
  note?: string;
  /** 고른 일을 마치러 갈 맵의 자리(화살표가 그리로 옮겨 간다) */
  goTo?: string;
}

export interface Choice extends Outcome {
  id: string;
  label: string;
  /** 잠김 조건과 보여 줄 까닭. unless가 참이면 열리고, 거짓이면 잠긴다. */
  lock?: { unless: Condition; reason: string };
  /**
   * 역할·수치·앞선 선택·뽑기·일 놀이의 끝난 모습에 따라 갈리는 결과.
   * 위에서부터 보아 when이 처음 맞는 것 하나가 바탕 결과를 통째로 갈음한다(합치지 않는다).
   */
  variants?: (Outcome & { when: Condition })[];
  /** 이 역할들에게만 보인다(그 사람의 삶에 아예 없는 일은 잠그지 않고 숨긴다) */
  only?: RoleId[];
}

/** 일 하나 = 대화 장면 하나. 맵의 자리에 닿으면 열린다. */
export interface Happening {
  id: string;
  situation: string;
  season: Season;
  /** 이 역할들에게만 생긴다(없으면 모든 역할) */
  roles?: RoleId[];
  theme: ThemeId;
  /** 맵의 자리 이름 */
  spot: string;
  /** 조건이 맞아야 맵에 나타난다 */
  shows?: Condition;
  /** 드는 해 ☀(미션의 일은 0, 덤으로 하는 일은 1) */
  cost: 0 | 1;
  /**
   * [더함] 가 보고 싶게 만드는 한마디(덤으로 하는 일에 단다. 24자 안, 무슨 일이 벌어질지 답을 미리 말하지 않는다).
   * 할 일 쪽지의 덤 줄과, 맵에서 그 말풍선에 다가갔을 때 보인다. 예: "아주머니가 한양 이야기를 한다더라"
   */
  lure?: string;
  /** 대화 장면의 배경(그림 자리의 자리 이름)과 선 사람(두 명까지) */
  stage: { place: string; cast?: { who: string; at?: 'left' | 'center' | 'right' }[] };
  /** 여는 대화 */
  lines: Line[];
  lineVariants?: { when: Condition; lines: Line[] }[];
  /** 선택지(2~3개). 없으면 듣거나 해내기만 하는 일이다. */
  choices?: Choice[];
  /**
   * 일 놀이. flags는 놀이가 끝난 모습(예: 'even', 'heaped', 'left')마다 남기는 표시다.
   * 놀이는 선택 뒤, 결과 대화 앞에 한다. 결과의 갈림(variants)은 놀이가 남긴 표시를 볼 수 있다.
   */
  play?: { game: string; rules: string; flags: Record<string, string> };
  /** [더함] 선택지가 없는 일의 결과(대화만 듣고 끝나는 일, 놀이만 하는 일) */
  after?: Outcome & { variants?: (Outcome & { when: Condition })[] };
  /** 배움 쪽지("~요"로 끝난다) */
  note: string;
  /** 근거 F번호, 1개 이상 */
  facts: string[];
}

export type MissionKind = 'live' | 'do' | 'ask' | 'carry' | 'compare' | 'collect'; // 겪는·해내는·알아보는·전하는·견주는·모으는

export interface Mission {
  id: string;
  situation: string;
  /** 이 계절에 푼다. 한 해 내내 푸는 덤 미션은 'year'. */
  season: Season | 'year';
  /** 없으면 그 이야기의 모든 역할이 함께 푼다 */
  roles?: RoleId[];
  /** 꼭 푸는 미션인가(모두 풀면 이야기를 깬다) */
  must: boolean;
  kind: MissionKind;
  /** 할 일 쪽지의 이름(18자)과 할 일 한 줄(40자) */
  title: string;
  goal: string;
  /** 이 미션을 이루는 일(Happening)의 id */
  parts: string[];
  /** 풀렸는지 가리는 조건(표시) */
  done: Condition;
  /** 막혔을 때 열리는 도움의 일(Happening의 id) */
  rescue?: string;
  /** "해낸 일" 한 줄 */
  doneLine: string;
  /** 지도서 차시와 학습 내용 */
  lesson: string;
  theme: ThemeId;
}

/** 올해의 바람이 이루어졌는지 가리는 줄. 위에서부터 처음 맞는 것을 쓴다. 마지막 줄은 조건이 없어야 한다. */
export interface WishOutcome {
  when?: Condition;
  fulfilled: boolean;
  reason: string;
}

export interface RoleDef {
  id: RoleId;
  label: string;
  /** 소개 글(100자) */
  intro: string;
  start: Stats;
  wish: string;
  wishOutcomes: WishOutcome[];
  /** 신분 역할인가 현장 역할인가 */
  kind: 'status' | 'scene';
  age: number;
  /** 무대(맵의 이름) */
  map: string;
  /** 계절의 해 ☀ */
  suns: number;
  /** 될 수 있는 모습. 둘이면 시작할 때 고른다. */
  looks: Look[];
  /** [더함] 소개 화면의 식구 한 줄 */
  family?: string;
  /** 앞 이야기의 어느 집안의 후손인가 */
  heirOf?: { situation: string; role: RoleId };
}

/** 한 해 이름(끝맺음). 위에서부터 처음 맞는 것을 쓴다. 마지막 줄은 조건이 없어야 한다. */
export interface Ending {
  id: string;
  title: string;
  line: string;
  when?: Condition;
}

/** 등장인물. 대화의 who와 무대의 cast가 이 이름을 쓴다. */
export interface Person {
  /** 이름표(6자) */
  label: string;
  sex: 'm' | 'f';
  age: 'child' | 'young' | 'adult' | 'old';
  /** 실제 인물인가(수첩에 "꾸민 말" 알림) */
  real?: boolean;
  /** [더함] 대화 장면의 그림 자리 이름(char/<이야기>/<pic>-<표정>). 없으면 사람의 이름을 쓴다. */
  pic?: string;
  /** [더함] 맵의 도트 그림 이름. 그림 파일이 없으면 이 도트 그림을 크게 키워 세운다. */
  sprite?: string;
}

/** 나중에 나타나는 결과: 계절을 닫을 때 앞선 선택과 뽑기에 따라 붙는 변화 */
export interface Later {
  at: Season;
  when: Condition;
  effects?: StatDelta;
  cards?: string[];
  line: string;
  facts?: string[];
}

/** 이야기 하나(코드의 이름은 1-가 그대로 Situation으로 둔다) */
export interface Situation {
  id: string;
  group: GroupId;
  year: number;
  title: string;
  lessons: string; // 지도서 차시
  calendar: 'lunar' | 'solar';
  /** 2~4개. 순서가 고르기 화면의 순서 */
  roles: RoleDef[];
  /** 처음에 뽑는가 고르는가 */
  pickBy: 'draw' | 'choose';
  draw: { kind: DrawKind; season?: Season; labels?: Record<string, { label: string; line: string }> };
  statusLocks: boolean; // 신분으로 잠그는가(⑦은 false)
  /** 계절 첫 줄(40자) */
  seasons: Record<Season, { line: string; lineVariants?: { when: Condition; line: string }[] }>;
  later?: Later[];
  /** 남길 것 */
  legacy: { id: string; label: string; kind: 'tree' | 'thing' | 'story' }[];
  people: Record<string, Person>;
  themes: Record<ThemeId, string>; // 견주기 물음 일곱 개의 이 이야기 답
  epilogue: string; // 뒷이야기
  openQuestion: string; // 끝 물음
  endings: Ending[];
  /** 견주기 답과 뒷이야기의 근거 */
  proof: { themes: Partial<Record<ThemeId, string[]>>; epilogue: string[] };
}

/** 이야기 하나와 그 미션·일. 엔진의 모든 함수는 이것을 받아서 일한다. */
export interface SituationPack {
  situation: Situation;
  missions: Mission[];
  happenings: Happening[];
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

/** 봇짐에 드는 물건 */
export interface Item {
  id: string;
  label: string;
  text: string;
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

/** 이야기책에 늘어놓는 이야기 한 줄. 폴더가 없으면 "준비 중"으로 보인다. */
export interface CatalogEntry {
  id: string;
  group: GroupId;
  year: number;
  title: string;
  blurb: string;
  lessons: string;
}

// ── 판의 상태 ────────────────────────────────────────────────

/** season: 맵을 돌아다니며 일을 한다 · seasonClose: 계절을 닫는 중 · done: 한 해가 끝났다 */
export type Phase = 'season' | 'seasonClose' | 'done';

/** 한 일 하나의 기록 */
export interface Deed {
  happeningId: string;
  season: Season;
  /** 이 일이 속한 미션(없으면 덤으로 한 일) */
  missionId?: string;
  theme: ThemeId;
  choiceId?: string;
  /** 고른 선택지의 글 */
  label?: string;
  /** 일 놀이가 끝난 모습 */
  play?: string;
  /** 결과 대화 */
  lines: Line[];
  note: string;
  /** 자료에 적힌 변화(한도로 다듬은 것) */
  requested: Stats;
  /** 0~10 안에서 실제로 바뀐 만큼 */
  delta: Stats;
  before: Stats;
  after: Stats;
  newCards: string[];
  newItems: string[];
  newFlags: string[];
  /** 이 일로 풀린 미션들 */
  solved: string[];
  /** 쓴 해 ☀ */
  sun: 0 | 1;
  goTo?: string;
}

/** 계절을 닫을 때 생긴 일(나중에 나타나는 결과) */
export interface Closing {
  season: Season;
  /** 계절 동안 수치가 바뀐 만큼(나중 결과 포함) */
  delta: Stats;
  before: Stats;
  after: Stats;
  /** 나중에 나타난 결과의 줄들 */
  lines: string[];
  newCards: string[];
}

export interface GameState {
  situationId: string;
  role: RoleId;
  look: Look;
  seed: number;
  stats: Stats;
  flags: string[];
  cards: string[];
  /** 봇짐 */
  items: string[];
  /** 뽑기 결과. 뽑는 계절에 들어서기 전에는 null이다. */
  draw: string | null;
  seasonIndex: number; // 0~3
  phase: Phase;
  /** 이 계절에 남은 해 ☀ */
  sunsLeft: number;
  /** 한 일(Happening의 id) */
  done: string[];
  /** 푼 미션(Mission의 id) */
  solved: string[];
  history: Deed[];
  /** 수치의 흐름: [처음, 봄을 보낸 뒤, 여름을 보낸 뒤, …] */
  flow: Stats[];
  /** 계절을 닫은 기록(계절마다 하나) */
  closings: Closing[];
  /** 고른 일을 마치러 갈 자리(화살표) */
  goTo?: string;
  /** 서 있던 자리("칸,칸"). 엔진은 뜻을 모른다 — 맵 화면이 적고 읽는다. */
  at?: string;
  /** 가 본 구역 */
  seen: string[];
}

/** 조건을 가릴 때 보는 것 */
export interface Facts {
  role: RoleId;
  look: Look;
  stats: Stats;
  flags: readonly string[];
  draw: string | null;
  items: readonly string[];
}
