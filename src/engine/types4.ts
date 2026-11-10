// 4판의 꼴(4-1 ㉡ — spec 11.1 다). 3판의 꼴(types.ts의 Happening·Mission·Situation·RoleDef·GameState·Deed)은 바꾸지 않고 그 위에 더한다.
// 10.2와 어긋나면 11.1 다가 앞선다. 이름을 다듬은 곳과 11.1 다에 없는 칸은 [더함]이라고 적었다(칸의 뜻은 11.1 다 그대로).
//
// 이 파일을 쓰는 곳
//   - 엔진(battle·episode·growth·quiz·economy) — 화면·브라우저·저장·시계를 모르는 순수한 셈
//   - 내용(content/episodes·foes·skills·gear·outfits·relics·hub, situations/<이야기>/questions, bank/**) — 자료
//   - 검사(content/bankRules — 문제 검사 규칙, content/validate — 묶음 검사)
//   - 저장(state/save5 — 꼴 5. 4-1 ㉡에서는 앱에 잇지 않는다)
// 엔진의 꼴이라 화면·브라우저·시간을 모른다.

import type { GameState, Line, Look, RoleId, Season, StatDelta, Stats, ThemeId, Condition } from './types';

// ── 갈래와 돈 ────────────────────────────────────────────────

/** 카드의 갈래 = 능력치 넷의 이름(힘·지혜·솜씨·어울림 — 13.2의 2번: 능력치 쪽을 "어울림"으로) */
export const CARD_KINDS = ['power', 'wisdom', 'craft', 'heart'] as const;
export type CardKind = (typeof CARD_KINDS)[number];
export const CARD_KIND_LABELS: Record<CardKind, string> = { power: '힘', wisdom: '지혜', craft: '솜씨', heart: '어울림' };

/** 돈 주머니: 쌀(되)·베(자)·엽전(닢). ①~④는 쌀·베만 쓴다(6.5) */
export interface Purse {
  rice: number;
  cloth: number;
  coin: number;
}

// ── 에피소드 ────────────────────────────────────────────────

/** 작은 고비 하나: 어느 일(Happening id)에서 열리나. 짧은 겨루기면 고비(Foe id). before: 'play'면 그 일의 놀이 앞에서 열린다 */
export interface MinorDef {
  id: string;
  kind: 'battle' | 'play';
  foe?: string;
  at: string;
  before?: 'play';
}

/**
 * [더함] 현장에서 얻는 솜씨 카드(11.1 다의 "카드" 줄, 고칠 것 4). 3판의 일(spring.ts)은 고치지 않고 에피소드 쪽 표로 잇는다.
 * at의 일을 마치면(choice·play를 적으면 그 선택·놀이의 끝난 모습일 때만) card를 얻는다. 그 판의 큰 고비 덱에 저절로 더한다.
 */
export interface FieldSkill {
  at: string;
  choice?: string;
  play?: string;
  card: string;
}

export interface Episode {
  /** 's1395-1' */
  id: string;
  /** 이야기 id 's1395' */
  story: string;
  /** 이야기 안의 차례(1부터) */
  order: number;
  /** '새 도읍의 봄' */
  title: string;
  /** '1395년 이월~삼월' */
  when: string;
  /** 맵의 빛깔과 현장의 계절(3판 GameState.seasonIndex가 이것을 따른다) */
  season: Season;
  /** 의뢰 한 줄(40자) */
  goal: string;
  /** 권장 레벨 */
  level: number;
  /** 지도서 차시('2단원 2~3차시') */
  lessons: string;
  /** 견주기 물음 */
  themes: ThemeId[];
  /** 꼭 할 일(3판 Mission id) */
  missions: string[];
  /** 덤(Happening id) */
  extras: string[];
  /** 해 ☀(역할의 해보다 앞선다. 기력이 2 이하이면 하나 준다 — 3판 그대로) */
  suns: number;
  minors: MinorDef[];
  /** 큰 고비(Foe id) */
  boss: string;
  /** 첫 판에 정해 주는 덱(①-1은 여섯) */
  starter?: string[];
  /** [더함] 현장에서 얻는 솜씨 카드 */
  skills: FieldSkill[];
  /** 이야기 문제의 주제('ep-s1395-1') */
  storyTopic: string;
  /** 이어진 서당 주제('soc5-2-1' …) */
  topics: string[];
  /** 핵심 물음(Question id 6~9개 — 지혜 겨루기가 여기서 낸다) */
  core: string[];
  /** 큰 고비를 처음 넘기면(현장에서 얻는 카드는 skills에) */
  rewards: { cards: string[]; relics: string[]; purse: Purse };
  /** 앞 에피소드의 선택이 돌아오는 것(4-3부터) */
  carries?: { when: Condition; foe?: { shield?: number; hp?: number }; effects?: StatDelta; line?: string }[];
  /** 끝의 정령 물음(정답 없음) */
  ask: string;
}

/** content/episodes/<이야기>.ts가 내보낸다 */
export interface StoryPlan {
  story: string;
  episodes: Episode[];
  /**
   * 맵·놀이가 읽는 표시의 이름표(1-라 Review 43번 — neutigol.ts·plays에 박혀 있던 농민 집 표시를 이 표로 읽는다).
   * 열쇠는 맵·놀이가 부르는 이름, 값은 그 이야기의 일이 남기는 표시. 검사기가 값을 그 이야기의 일이 실제로 남기는지 본다.
   */
  marks: Record<string, string>;
}

// ── 고비 ────────────────────────────────────────────────────

export const FOE_EFFECTS = ['steal-momentum', 'raise-shield', 'heal', 'weaken-next', 'freeze-card'] as const;
export type FoeEffect = (typeof FOE_EFFECTS)[number];

/** 고비가 미리 보이는 할 일 하나 */
export interface FoeMove {
  id: string;
  /** 예고 한 줄(30자 — 4.5) */
  line: string;
  /** 기록 줄: 그 차례에 고비가 한 일을 일어난 일로("도깨비가 씨름을 걸었다" — 겨루기 화면의 "방금 일어난 일". 없으면 고비의 이름) */
  did?: string;
  /** 그림 표시의 이름 */
  icon: string;
  /** 이 차례에 센 갈래(도깨비의 판: 수수께끼 → wisdom, 씨름 → power, 일 겨루기 → craft) */
  strong?: CardKind;
  /** 깎는 기운의 범위(씨앗으로 고른다) */
  hit?: [number, number];
  effect?: FoeEffect;
  weight: number;
}

/**
 * Foe.weak에 넣는 표: "이 차례의 센 갈래(FoeMove.strong)가 아닌 카드"는 약하다.
 * 도깨비의 내기는 그 판과 갈래가 다른 카드가 약하다(8.3).
 */
export const OFF_TURN = 'off-turn';

export interface Foe {
  id: string;
  name: string;
  /** 삶의 고비 · 옛이야기 속 존재 */
  kind: 'life' | 'tale';
  hp: number;
  /** 작은 고비는 1 */
  phases: 1 | 2 | 3;
  /** 다음 단계가 열릴 때 세우는 방패(큰 고비는 3, 작은 고비는 0) */
  shield: number;
  /** 늘 센·약한 카드(갈래나 카드 id, weak에는 OFF_TURN도). 판마다 바뀌는 것은 FoeMove.strong */
  strong: string[];
  weak: string[];
  moves: FoeMove[];
  order: 'cycle' | 'weighted';
  /** 여는 말 · 넘긴 뒤 · 구해 준 뒤(3판 Line) */
  opening: Line[];
  win: Line[];
  rescue: Line[];
  /** [더함] 16차례가 되어 함께 마무리할 때("해가 저문다. 함께 마무리하자") */
  dusk: Line[];
  /** [더함] 다음 단계가 열릴 때의 말(2단계의 말). 작은 고비는 빈 목록 */
  phaseOpen: Line[];
  /** [더함] 지혜 겨루기의 들머리. 작은 고비는 빈 목록 */
  wisdom: Line[];
  /** [더함] 방패가 저절로 한 칸 깎일 때의 한 줄("물이 조금씩 빠진다", "도깨비가 지친다"). 작은 고비는 '' */
  fade: string;
  /** 그림 자리('char/s1395/dokkaebi'), 도트 대역 */
  picture: string;
  sprite?: string;
  /** 근거(옛이야기는 F70~F74) */
  facts: string[];
  /** 「옛이야기」 표시(7.8) */
  tale?: true;
}

// ── 카드·장비·꾸미기·유물 ───────────────────────────────────────

export const CARD_BONUSES = ['shield', 'heal', 'weaken', 'momentum'] as const;
export type CardBonus = (typeof CARD_BONUSES)[number];

/** 솜씨 카드(겨루기의 카드). 3판의 생활 카드(engine/types의 Card)와 이름을 가른다(8.2) */
export interface SkillCard {
  /** 'skill-…' — 3판 카드 id('s1395-…')와 겹치지 않는다 */
  id: string;
  /** 이름 12자 */
  name: string;
  /** 가지(농사·마을·값과 셈·글 …) */
  branch: string;
  kind: CardKind;
  /** 기본 힘 6~12 */
  base: number;
  /** 맞혔을 때의 덧효과 하나: 방패 한 칸 깎기 · 기운 회복 · 고비의 다음 일을 약하게 · 기세 한 칸 더 */
  bonus: CardBonus;
  /** 지식 꼬리표 — 'ep:s1395-1'·'topic:soc5-2-1'·'theme:duty'(이름이 아니라 id로). 꼬리표마다 문제가 20개 이상 */
  tags: string[];
  /** 가져갈 수 있는 이야기 */
  eras: string[];
  /** 업그레이드(4-3부터) */
  becomes?: { card: string; at: string };
  /** 글 60자 */
  text: string;
  facts: string[];
}

export interface Gear {
  id: string;
  name: string;
  slot: 'hand' | 'pack';
  /** 호미: 흙·김매기 카드 +2 등(F80에 맞춘다) */
  boost: { cards?: string[]; kinds?: CardKind[]; add: number };
  /** 가져갈 수 있는 이야기 · 잠긴 까닭 한 줄(30자) */
  eras: string[];
  lock: string;
  /** 도구점에서 파는 값(없으면 팔지 않는다 — 도리깨) */
  price?: Purse;
  text: string;
  facts: string[];
}

export interface Outfit {
  id: string;
  part: 'ribbon' | 'jacket';
  label: string;
  /** people.ts 매개변수로 들어가는 빛깔('#rrggbb') */
  color: string;
  /** 시대 · 신분 */
  era: string;
  who: string;
  /** "꾸민 차림"인가 */
  made: boolean;
  price: Purse;
  /** 거울의 쪽지 */
  note: string;
  /** 근거(F82). made가 아니면 1개 이상 */
  facts: string[];
}

/** [더함] 유물(「볍씨 자루」 — 박물관은 4-3. 그때까지 가진 것에 둔다) */
export interface Relic {
  id: string;
  name: string;
  /** 어느 이야기의 것인가 */
  era: string;
  text: string;
  facts: string[];
}

// ── 거점 ────────────────────────────────────────────────────

/** 시설 열하나(6.3). 4-1에 열린 것은 시간의 문·알림판·도구점·포목점(댕기방)·서당 */
export const FACILITY_IDS = ['gate', 'board', 'tools', 'workshop', 'wardrobe', 'market', 'museum', 'home', 'seodang', 'inn', 'studio'] as const;
export type FacilityId = (typeof FACILITY_IDS)[number];

export interface Facility {
  id: FacilityId;
  /** 화면의 이름('시간의 문', '포목점·댕기방') */
  name: string;
  /** 4-1에 열려 있는가(닫힌 곳은 "곧 열려요") */
  open: boolean;
  /** 하는 일 한 줄(30자) */
  does: string;
  /** 시설지기(Keeper id). 시간의 문·알림판은 없다 */
  keeper?: string;
}

/** 시설지기(꾸민 사람 — 6.3. 남녀노소를 고루) */
export interface Keeper {
  id: string;
  /** 이름표 6자 */
  label: string;
  sex: 'm' | 'f';
  age: 'child' | 'young' | 'adult' | 'old';
  /** 처음 들어설 때의 말 */
  greet: Line[];
}

/** 알림판의 종이. request = 의뢰(에피소드), small = 작은 의뢰(안내일 뿐 보상이 없다 — 5.6의 1번) */
export interface BoardNote {
  id: string;
  kind: 'request' | 'small';
  title: string;
  text: string;
  /** 이어진 에피소드(의뢰) */
  episode?: string;
  /** 언제 뜨나: 그 에피소드를 깨기 전 · 깬 뒤 · 늘 */
  when: 'before' | 'after' | 'always';
  /** 이 에피소드 id를 깨기 전/뒤를 가린다(없으면 episode) */
  after?: string;
}

// ── 문제 ────────────────────────────────────────────────────

export const SUBJECTS = ['social', 'korean', 'math', 'science', 'english', 'class'] as const;
/** class = 선생님 문제 */
export type Subject = (typeof SUBJECTS)[number];
export const QUESTION_FORMS = ['pick', 'ox', 'order', 'match', 'map', 'blank', 'number', 'picture', 'listen', 'passage'] as const;
export type QuestionForm = (typeof QUESTION_FORMS)[number];

/** 9.3의 Question + 4-1의 다듬기(11.1 고칠 것 5): 답은 0부터, 꼬리표는 id로, lesson */
export interface Question {
  /**
   * 은행 'soc5-2-1-0042', 이야기 'ep-s1395-1-007'. 뒤 번호(마지막 '-' 뒤의 수)가 비트 묶음의 자리다.
   * 한 번 정하면 바꾸지 않는다(기기의 "푼 문제"가 id로 적힌다).
   */
  id: string;
  grade: 5 | 6;
  subject: Subject;
  /** 주제 id('soc5-2-1', 'ep-s1395-1') */
  topic: string;
  /** 성취기준 코드 '[6사05-01]'. 이야기 문제는 그 에피소드가 잇는 성취기준 */
  standard: string;
  form: QuestionForm;
  /** 물음(80자 안) */
  ask: string;
  /** 고를 것(고르기 2~4개, 하나에 30자 안). OX는 적지 않는다(화면이 O·X 두 단추를 보인다) */
  choices?: string[];
  /**
   * 고르기: 0부터 센 차례 번호(화면은 고를 것을 섞어 보이고 답을 따라 옮긴다).
   * OX: 0 = O(맞다), 1 = X(아니다).
   * 순서·짝: 차례 배열(items·pairs를 맞는 차례로 적으므로 [0, 1, …]).
   * 지도에서 찍기: 찍을 곳의 이름(글자). 수 넣기: 글자로 쓴 수('3/4', '2.5').
   */
  answer: number | number[] | string;
  /** 순서 맞추기(맞는 차례로 적고 화면이 섞는다) */
  items?: string[];
  /** 짝 맞추기 */
  pairs?: [string, string][];
  /** 지도에서 찍기(map은 코드로 그리는 지도의 이름) */
  spot?: { map: string; x: number; y: number; r: number };
  /** 글 읽고 풀기의 글(새로 쓴 글만 — 9.7) */
  passage?: string;
  /** 그림 id(코드로 그리는 SVG — 9.8) */
  figure?: string;
  /** 소리로 읽어 줄 글(영어 듣기) */
  say?: string;
  /** 풀이(60자 안, "~요"로 끝남) */
  explain: string;
  /** 쉬움·보통·어려움(평가원 성취수준 C·B·A — E6) */
  level: 1 | 2 | 3;
  /** 근거 번호(F··, E··). 수학은 'calc' */
  facts: string[];
  /** 겨루기와 잇는 꼬리표: 'ep:s1395-1', 'card:<카드 id>', 'theme:paying', 'core'(핵심 물음) */
  tags?: string[];
  /** 지도서·교과서에 기대는 문제의 차시('2단원 2~3차시') — facts에 'E9'와 함께. 쪽수·글은 적지 않는다 */
  lesson?: string;
  by: 'claude' | 'admin' | 'teacher';
  /** 검증한 에이전트나 사람과 날 */
  checked?: { by: string; on: string };
  /** 문제의 판. 고칠 때마다 1 늘린다(id는 그대로) */
  ver: number;
}

export interface Topic {
  id: string;
  grade: 5 | 6;
  subject: Subject;
  /** '조선의 건국과 한양' */
  title: string;
  /** '5-2 2단원' */
  unit: string;
  /** '2~3차시' */
  lessons?: string;
  standards: string[];
  /** 문제 수(파일의 questions 수와 같다) */
  count: number;
  /** 묶음의 판('2026-11-02') */
  bankVer: string;
  /** 'story'는 에피소드의 이야기 문제(서당 목록에 따로 뜨지 않는다) */
  kind: 'bank' | 'story';
}

// ── 주인공·서당 기록·겨루기 ──────────────────────────────────────

export interface Hero {
  look: Look;
  level: number;
  /** 지금 레벨 안에서 모은 경험치(다음 레벨까지 100 + 15 × L) */
  xp: number;
  /** 레벨 상한에 걸려 쌓아 둔 경험치(다음 이야기가 열리면 들어간다 — 5.6의 4번) */
  banked: number;
  /** 시작 3·3·3·3, 하나에 15까지 */
  stats: Record<CardKind, number>;
  /** 아직 두지 않은 능력치 점 */
  points: number;
  outfit: { ribbon?: string; jacket?: string };
  titles: string[];
  /** 가진 솜씨 카드와 단계 */
  cards: Record<string, 1 | 2 | 3>;
  /** 고른 덱(여덟 장 — 첫 판은 정해 준 여섯) */
  deck: string[];
  gear: { hand?: string; pack?: string };
}

/** 주제마다 — 서당과 겨루기가 함께 쓴다 */
export interface QuizLog {
  /** 이번 바퀴에 낸 문제(비트 묶음 — id의 뒤 번호 자리. 16진수 두 글자가 여덟 칸) */
  seen: string;
  /** 한 번이라도 맞힌 문제(비트 묶음) */
  right: string;
  /** 다시 볼 문제(전에 틀렸고 아직 맞히지 않은 것) */
  wrong: string[];
  /** 맞힌 차례(오래전 것이 앞) */
  lastRight: string[];
  /** 서당 한 판의 최고 점수 */
  best: number;
  /** 한 바퀴를 다 푼 횟수 */
  laps: number;
  /** 서당 판 수 */
  rounds: number;
}

/** 겨루기 안의 것. 저장하지 않는다(도중에 끄면 그 겨루기의 처음부터 — 5.8). 엔진(battle.ts)이 칸을 더할 수 있다([더함]) */
export interface BattleState {
  foe: string;
  seed: number;
  /** 지금까지 마친 차례 수(카드 하나 또는 합동 기술 하나가 한 차례) */
  turn: number;
  /** 지금 단계(1부터) */
  phase: number;
  foeHp: number;
  foeMax: number;
  shield: number;
  me: number;
  meMax: number;
  momentum: number;
  hand: string[];
  pile: string[];
  used: string[];
  /** 얼어서 이 차례에 낼 수 없는 카드 */
  frozen?: string;
  /** 예고한 다음 할 일(FoeMove id) */
  intent: string;
  /** 틀린 문제를 다시 낼 차례 */
  retry: { q: string; at: number }[];
  /** 남은 귀띔 */
  hints: number;
  /** 낸 문제: again = 틀려서 다시 나온 것(별 ③은 처음 것만 센다 — 5.6의 5번), strong = 상성이 맞는 카드였나 */
  asked: { q: string; right: boolean; again: boolean; card?: string; strong: boolean }[];
  /** 고비에게 준 힘의 합(점수 재료) */
  dealt: number;
  end?: 'win' | 'rescue' | 'dusk';
}

// ── 저장 꼴 5 ────────────────────────────────────────────────

export const SAVE5_SCHEMA = 5;

/** 이야기 하나의 기록(그 이야기 안의 형편은 3판 그대로) */
export interface StoryRecord {
  role: RoleId;
  look: Look;
  stats: Stats;
  flags: string[];
  /** 3판 생활 카드 */
  cards: string[];
  items: string[];
  /** 처음 깬 판의 선택(Happening id → Choice id, 고르는 것이 없던 일은 '') */
  firstRun: Record<string, string>;
  episodes: Record<string, EpisodeRecord>;
  /** 도감 몫(처음 가 본 자리·만난 사람) */
  met: string[];
  legacy?: string;
  title?: string;
}

export interface EpisodeRecord {
  stars: [boolean, boolean, boolean];
  best: number;
  plays: number;
  cleared: boolean;
}

export interface Save5 {
  schema: 5;
  build: string;
  hero: Hero;
  purse: Purse;
  /** 가진 것(도리깨, 볍씨 자루 …) */
  items: string[];
  /** 거점에 서 있던 칸, 마을 소개를 봤나, 본 알림(시험 판 등) */
  hub: { at?: string; intro: boolean; seen: string[] };
  stories: Record<string, StoryRecord>;
  /** 하던 에피소드(3판 "진행 중인 해"의 자리) */
  current?: {
    episode: string;
    replay: boolean;
    /** 현장의 판(3판 그대로 — 서 있던 칸 at 포함) */
    game: GameState;
    phase: 'field' | 'battle' | 'result';
    /** 마친 작은 고비(MinorDef id) */
    minors: string[];
    /** 맵에서 가 본 칸(비트를 글자로 묶은 것) */
    walked?: string;
    /** 아직 보여 주지 않은 "미션이 풀림" 종이 */
    papers?: string[];
    /**
     * 결과 종이를 다 보기 전에 끈 때(11.1 다). cards = 새로 얻은 카드(단계가 오른 카드도 함께 — ㉡의 꼴).
     * [더함 — 4-1 ㉢] 결과 종이를 그대로 다시 그릴 칸: 처음 깬 판인가 · 새로 받은 별 · 내 최고 기록과 이번에 넘었나 · 오른 레벨 수 ·
     * 상한에 걸려 쌓아 둔 경험치 · 단계가 오른 카드 · 유물 · 구해 줌(해거름 포함). 모두 없어도 된다(㉡의 견본).
     */
    result?: {
      stars: [boolean, boolean, boolean];
      score: number;
      xp: number;
      purse: Purse;
      cards: string[];
      first?: boolean;
      newStars?: [boolean, boolean, boolean];
      best?: number;
      bestNew?: boolean;
      levels?: number;
      banked?: number;
      stepped?: string[];
      relics?: string[];
      rescued?: boolean;
    };
  };
  quiz: Record<string, QuizLog>;
  today: { date: string; xp: number; topics: Record<string, number>; replays: Record<string, number> };
  classCode?: string;
  unlocked: string[];
}
