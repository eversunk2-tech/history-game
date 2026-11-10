// 문제 검사 규칙(spec 9.7의 2번, 11.1 다 "문제 전수"). 게임·검사기(validate.ts)·4-2의 교사 화면이 함께 쓰는 공용 모듈이다.
// 화면·Firebase·게임 엔진을 모른다(가져오는 것은 꼴 types4의 이름뿐 — 실행할 때는 아무것도 가져오지 않는다).
// 그래서 교사 화면(저장 전)과 학생 게임(받은 반 묶음을 걸러 낼 때 — filterQuestions)이 그대로 가져다 쓸 수 있다.
//
// 쓰는 법
//   checkQuestion(q, ctx)            — 문제 하나(모르는 꼴의 값도 받는다 — 받은 자료를 거를 때). 칸·한도·답·고를 것·근거·성취기준·풀이·낱말·방향·차시·꼬리표
//   checkTopic(topic, questions, ctx) — 주제 하나와 그 문제들: 주제의 꼴, 문제 수, 어려움 비율, 연도 문제의 몫, id의 꼴과 겹침, 비슷한 물음, 이야기 문제는 겨루기 꼴만
//   checkBank(topics, questions, ctx) — 묶음 전체: 위 둘을 모두 + 주제 id 겹침, 주제 없는 문제, 주제를 건너 겹치는 id·물음
//   filterQuestions(list, ctx)        — 잘못이 없는 문제만 남긴다(꼴이 틀린 것은 버린다)
// 돌려주는 것은 BankIssue[]: level 'error'는 고쳐야 통과, 'gap'은 사람이 한 번 볼 것.
//
// 규칙의 이름(rule)은 시험이 규칙마다 틀린 견본을 넣어 잡는지 본다(tests/bank.test.ts).

import type { Question, QuestionForm, Subject, Topic } from '../engine/types4';

export interface BankIssue {
  level: 'error' | 'gap';
  rule: string;
  where: string;
  message: string;
}

export interface BankContext {
  /** 근거 목록의 번호(content/sources.ts + content/bank/sources.ts). 수학의 'calc'는 따로 받는다 */
  sources: ReadonlySet<string>;
  /** 성취기준 목록(없으면 STANDARDS) */
  standards?: ReadonlySet<string>;
  /** 'card:<id>' 꼬리표가 가리킬 수 있는 솜씨 카드 id(없으면 꼴만 본다) */
  cards?: ReadonlySet<string>;
  /** 'ep:<id>' 꼬리표가 가리킬 수 있는 에피소드 id(없으면 꼴만 본다) */
  episodes?: ReadonlySet<string>;
}

// ── 값과 한도 ────────────────────────────────────────────────

/** 근거 번호의 꼴(spec 12.2·12.5): F01~F85(은행은 F86부터 — 백을 넘으면 세 자리), E1~E13. 검사기(validate.ts)도 이것을 쓴다 */
export const SOURCE_ID = /^(F\d{2,3}|E\d{1,2})$/;

/**
 * 성취기준(2022 개정 사회과 5~6학년 — E1): 역사 아홉([6사04-01]~[6사07-02])과 독도의 역사([6사01-02]).
 * 다른 과목의 은행을 만들 때(9.6) 그 과목의 것을 더한다.
 */
export const STANDARDS: readonly string[] = [
  '[6사01-02]',
  '[6사04-01]',
  '[6사04-02]',
  '[6사04-03]',
  '[6사05-01]',
  '[6사05-02]',
  '[6사06-01]',
  '[6사06-02]',
  '[6사07-01]',
  '[6사07-02]',
];

export const SUBJECT_IDS: readonly Subject[] = ['social', 'korean', 'math', 'science', 'english', 'class'];
export const FORM_IDS: readonly QuestionForm[] = ['pick', 'ox', 'order', 'match', 'map', 'blank', 'number', 'picture', 'listen', 'passage'];

/** 글의 한도(4.5·9.3): 물음 80 · 고를 것 30 · 풀이 60. 순서·짝의 낱장도 고를 것과 같다. 글 읽고 풀기의 글은 200(9.2) */
export const LIMITS = {
  ask: 80,
  choice: 30,
  explain: 60,
  passage: 200,
  /** 고르기의 고를 것 수 */
  choicesMin: 2,
  choicesMax: 4,
  /** 순서 맞추기(카드 3~5장 — 9.2) */
  orderMin: 3,
  orderMax: 5,
  /** 짝 맞추기 */
  pairsMin: 2,
  pairsMax: 4,
} as const;

/** 겨루기에도 나가는 꼴(8.5·9.2): 고르기·OX·순서(셋까지)·짝(두 쌍까지)·지도에서 찍기 */
export const BATTLE_FORMS: readonly QuestionForm[] = ['pick', 'ox', 'order', 'match', 'map'];
export const BATTLE_LIMITS = { order: 3, pairs: 2 } as const;

/** 주제마다 어려움 비율 쉬움 3 : 보통 5 : 어려움 2(9.4), 하나에 ±1까지 */
export const LEVEL_SHARE: readonly [number, number, number] = [0.3, 0.5, 0.2];
export const LEVEL_SLACK = 1;

/** 은행 주제의 문제 수(9.5: 1차시 주제 60, 2차시 주제 80, 덤 독도 40). 이야기 문제는 에피소드마다 15~20(9.5·8.5) */
export const BANK_SIZES: readonly number[] = [40, 60, 80];
export const STORY_SIZE = { min: 15, max: 20 } as const;

/**
 * 9.5의 표에서 주제마다 정한 문제 수(5학년 사회 역사 스물여섯 — id는 'soc5-<단원>-<주제>', 9.3).
 * 은행 주제(kind 'bank')의 id가 이 표에 있으면 문제 수가 이 수와 같아야 한다.
 * 표에 없는 은행 주제(다른 과목·덤 독도 등)는 BANK_SIZES 가운데 하나면 된다. 교사 문제(class)와 이야기 문제(story)는 따로 본다.
 */
export const TOPIC_SIZES: ReadonlyMap<string, number> = new Map([
  // 1단원(740)
  ['soc5-1-1', 80], // 구석기와 신석기 사람들의 생활
  ['soc5-1-2', 80], // 청동기 시대와 고인돌
  ['soc5-1-3', 60], // 고조선
  ['soc5-1-4', 80], // 삼국과 가야의 성립과 발전
  ['soc5-1-5', 80], // 삼국과 가야 사람들의 생활
  ['soc5-1-6', 60], // 통일신라
  ['soc5-1-7', 60], // 발해
  ['soc5-1-8', 80], // 고려의 건국과 사회
  ['soc5-1-9', 80], // 고려와 주변 나라
  ['soc5-1-10', 80], // 고려의 문화
  // 2단원(540)
  ['soc5-2-1', 80], // 조선의 건국과 한양
  ['soc5-2-2', 80], // 유교 질서와 조선 사회
  ['soc5-2-3', 60], // 세종 때의 발전
  ['soc5-2-4', 60], // 주변 나라와 두 전쟁
  ['soc5-2-5', 60], // 조선 후기의 경제 변화
  ['soc5-2-6', 60], // 조선 후기의 사회 변화
  ['soc5-2-7', 60], // 서민 문화
  ['soc5-2-8', 80], // 개항 이후 달라진 생활
  // 3단원(540)
  ['soc5-3-1', 60], // 나라를 지키려는 노력
  ['soc5-3-2', 60], // 1910년대의 식민 통치와 저항
  ['soc5-3-3', 60], // 3·1 운동과 대한민국 임시 정부
  ['soc5-3-4', 60], // 3·1 운동 뒤의 민족 운동
  ['soc5-3-5', 80], // 일제 통치 시기의 생활
  ['soc5-3-6', 80], // 8·15 광복과 대한민국 정부 수립
  ['soc5-3-7', 80], // 6·25 전쟁과 사람들의 생활
  ['soc5-3-8', 60], // 6·25 전쟁 뒤의 사회와 생활
]);

/** 연도를 그대로 묻는 문제는 주제마다 열에 하나 안(9.4) */
export const YEAR_SHARE = 0.1;

/** 물음의 낱말 겹침 비율이 이만큼 넘으면 "아주 비슷한 물음"(답도 같으면 잘못, 다르면 사람이 본다) */
export const SIMILAR_AT = 0.8;

/**
 * 쓰지 않기로 한 낱말(7.8 — 낮추는 말, 때리고 벌주는 묘사, 죽음·싸움의 장면, 믿음을 그르다 하는 말).
 * 이야기 글의 목록(validate.ts의 BANNED_WORDS)에서 문제에도 맞는 것만 옮겼다 — 서당은 문제를 푸는 곳이라 "정답·점수" 같은 말은 막지 않는다.
 */
export const BANK_BANNED: readonly { word: string; why: string }[] = [
  { word: '종놈', why: '노비를 낮춰 부르는 말' },
  { word: '종년', why: '노비를 낮춰 부르는 말' },
  { word: '계집종', why: '노비를 낮춰 부르는 말' },
  { word: '머슴놈', why: '사람을 낮춰 부르는 말' },
  { word: '천것', why: '신분을 낮춰 부르는 말' },
  { word: '아랫것', why: '신분을 낮춰 부르는 말' },
  { word: '상놈', why: '신분을 낮춰 부르는 말' },
  { word: '쌍놈', why: '신분을 낮춰 부르는 말' },
  { word: '상것', why: '신분을 낮춰 부르는 말' },
  { word: '계집', why: '여성을 낮춰 부르는 말' },
  { word: '여편네', why: '여성을 낮춰 부르는 말' },
  { word: '왜놈', why: '그 나라 사람 전체를 낮추는 말' },
  { word: '왜적', why: '"왜군"이라고만 쓴다' },
  { word: '쪽발이', why: '그 나라 사람 전체를 낮추는 말' },
  { word: '되놈', why: '그 나라 사람 전체를 낮추는 말' },
  { word: '떼놈', why: '그 나라 사람 전체를 낮추는 말' },
  { word: '오랑캐', why: '그 나라 사람 전체를 낮추는 말' },
  { word: '매질', why: '때리거나 벌주는 묘사' },
  { word: '곤장', why: '때리거나 벌주는 묘사' },
  { word: '채찍', why: '때리거나 벌주는 묘사' },
  { word: '시체', why: '죽음을 그리는 묘사' },
  { word: '주검', why: '죽음을 그리는 묘사' },
  { word: '피투성이', why: '싸움을 그리는 묘사' },
  { word: '목을 베', why: '싸움을 그리는 묘사' },
  { word: '미신', why: '믿음을 그르다고 하는 말' },
  { word: '사이비', why: '믿음을 그르다고 하는 말' },
  { word: '이단', why: '믿음을 그르다고 하는 말' },
  { word: '우상', why: '믿음을 그르다고 하는 말' },
];

/**
 * 옛이야기 속 존재(8.4 — 고비와 도깨비 내기에만 나온다). 역사 문제(사실 칸)에 섞지 않는다(7.8).
 * 해치(해태)·삼족오는 궁궐 장식·고분 벽화로 박물관과 서당에서 다루므로(8.4) 여기 넣지 않는다.
 */
export const TALE_BEINGS: readonly string[] = ['도깨비', '불가사리', '강철이', '이무기', '구미호', '목도령'];

/** 방향을 왼쪽·오른쪽으로 묻는 낱말(8.5 — "궁궐 왼쪽에 종묘"는 임금이 남쪽을 볼 때의 말). 든 문제는 사람이 검증해야(checked) 통과 */
export const SIDE_WORDS: readonly string[] = ['왼쪽', '오른쪽', '왼편', '오른편'];

/** 지도서·교과서의 차시('2단원 2~3차시', '2단원 8차시'). 쪽수는 적지 않는다(9.7의 4번) */
export const LESSON = /^\d단원 \d{1,2}(~\d{1,2})?차시$/;

/** 꼬리표의 꼴: 'core' · 'ep:<에피소드 id>' · 'card:<카드 id>' · 'theme:<견주기 물음 id>' · 'topic:<주제 id>' */
export const THEME_TAGS: readonly string[] = ['farming', 'paying', 'marriage', 'inheritance', 'learning', 'duty', 'play'];

// ── 작은 셈 ─────────────────────────────────────────────────

export function countChars(text: string): number {
  return [...text].length;
}

/** 풀이가 "~요"로 끝나는가(문장 부호와 닫는 따옴표·괄호는 건너뛴다) */
export function endsWithYo(text: string): boolean {
  return text
    .trim()
    .replace(/[\s.!?…~"'“”‘’)\]]+$/u, '')
    .endsWith('요');
}

/** 비교를 위한 낱말(빈칸·문장 부호로 끊는다) */
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0);
}

/** 두 물음의 낱말 겹침 비율(겹친 낱말 수 ÷ 합친 낱말 수, 0~1) */
export function similarity(a: string, b: string): number {
  const wa = new Set(wordsOf(a));
  const wb = new Set(wordsOf(b));
  if (wa.size === 0 && wb.size === 0) return 1;
  let both = 0;
  for (const w of wa) if (wb.has(w)) both++;
  return both / (wa.size + wb.size - both);
}

/** 겨루기에 낼 수 있는 꼴인가(engine/quiz.ts의 battleReady와 같은 셈 — 시험이 둘을 견준다) */
export function isBattleReady(q: Pick<Question, 'form' | 'items' | 'pairs'>): boolean {
  if (!BATTLE_FORMS.includes(q.form)) return false;
  if (q.form === 'order') return (q.items?.length ?? 0) > 0 && (q.items?.length ?? 0) <= BATTLE_LIMITS.order;
  if (q.form === 'match') return (q.pairs?.length ?? 0) > 0 && (q.pairs?.length ?? 0) <= BATTLE_LIMITS.pairs;
  return true;
}

const YEAR = /^(기원전\s*)?\d{1,4}\s*년/;

/**
 * 연도를 그대로 묻는가: 물음이 "몇 년·어느 해·몇 년도"를 묻거나, 고를 것(순서면 낱장)이 모두 해이거나, 답이 해인 수 넣기.
 * (물음 속에 해가 들어 있기만 한 것 — "1394년에 옮겨 간 곳은?" — 은 해를 묻는 것이 아니다.)
 */
export function asksYear(q: Pick<Question, 'form' | 'ask' | 'choices' | 'items' | 'answer'>): boolean {
  if (/몇\s*년|어느\s*해|몇\s*해에|언제\s*였/u.test(q.ask)) return true;
  const list = q.form === 'order' ? q.items : q.choices;
  if (list && list.length >= 2 && list.every((one) => YEAR.test(one.trim()))) return true;
  if (q.form === 'number' && typeof q.answer === 'string' && /^\d{3,4}$/.test(q.answer)) return true;
  return false;
}

/** id의 뒤 번호(마지막 '-' 뒤의 수 — 비트 묶음의 자리. engine/quiz.ts의 bitIndex와 같은 셈) */
export function slotOf(id: string): number {
  const tail = id.slice(id.lastIndexOf('-') + 1);
  return /^\d+$/.test(tail) ? Number(tail) : -1;
}

/** 문제의 글 칸 모두(낱말·방향 검사가 본다) */
function textsOf(q: Partial<Question>): string[] {
  return [q.ask ?? '', ...(q.choices ?? []), ...(q.items ?? []), ...(q.pairs ?? []).flat(), q.explain ?? '', q.passage ?? ''].filter((t) => typeof t === 'string');
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isIndex = (v: unknown, n: number): boolean => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n;
const isIdentity = (v: unknown, n: number): boolean => Array.isArray(v) && v.length === n && v.every((x, i) => x === i);
const norm = (text: string): string => text.replace(/\s+/g, ' ').trim();

// ── 문제 하나 ────────────────────────────────────────────────

/** 문제 하나를 본다. 받은 자료(교사 문제, 반 묶음)도 받을 수 있게 모르는 값을 받는다 */
export function checkQuestion(input: unknown, ctx: BankContext): BankIssue[] {
  const issues: BankIssue[] = [];
  const id = isObject(input) && typeof input.id === 'string' ? input.id : '(id 없음)';
  const where = `문제 ${id}`;
  const err = (rule: string, message: string) => issues.push({ level: 'error', rule, where, message });
  const gap = (rule: string, message: string) => issues.push({ level: 'gap', rule, where, message });
  if (!isObject(input)) {
    err('shape', '문제가 객체가 아니다');
    return issues;
  }
  const q = input as Partial<Question> & Record<string, unknown>;

  // 1. 칸이 다 있고 제 꼴인가
  if (typeof q.id !== 'string' || q.id.length === 0) err('shape', 'id가 없다');
  if (q.grade !== 5 && q.grade !== 6) err('shape', '학년은 5나 6이다');
  if (!SUBJECT_IDS.includes(q.subject as Subject)) err('shape', `모르는 과목 "${String(q.subject)}"`);
  if (typeof q.topic !== 'string' || q.topic.length === 0) err('shape', '주제가 없다');
  if (!FORM_IDS.includes(q.form as QuestionForm)) err('shape', `모르는 꼴 "${String(q.form)}"`);
  if (typeof q.ask !== 'string' || q.ask.trim().length === 0) err('shape', '물음이 없다');
  if (typeof q.explain !== 'string' || q.explain.trim().length === 0) err('shape', '풀이가 없다');
  if (q.level !== 1 && q.level !== 2 && q.level !== 3) err('shape', '어려움은 1·2·3이다');
  if (!isStrings(q.facts)) err('shape', '근거(facts)가 글자 목록이 아니다');
  if (q.by !== 'claude' && q.by !== 'admin' && q.by !== 'teacher') err('shape', '만든 이(by)는 claude·admin·teacher다');
  if (typeof q.ver !== 'number' || !Number.isInteger(q.ver) || q.ver < 1) err('shape', '판(ver)은 1 이상의 정수다');
  if (q.choices !== undefined && !isStrings(q.choices)) err('shape', '고를 것이 글자 목록이 아니다');
  if (q.items !== undefined && !isStrings(q.items)) err('shape', '순서의 낱장이 글자 목록이 아니다');
  if (q.pairs !== undefined && !(Array.isArray(q.pairs) && q.pairs.every((p) => Array.isArray(p) && p.length === 2 && isStrings(p)))) err('shape', '짝이 [글, 글]의 목록이 아니다');
  if (q.tags !== undefined && !isStrings(q.tags)) err('shape', '꼬리표가 글자 목록이 아니다');
  if (q.checked !== undefined && !(isObject(q.checked) && typeof q.checked.by === 'string' && typeof q.checked.on === 'string')) err('shape', 'checked는 { by, on }이다');
  if (issues.length > 0) return issues; // 꼴이 틀리면 아래 셈을 하지 않는다

  // 2. 글의 한도(물음 80 · 고를 것 30 · 풀이 60)
  if (countChars(q.ask!) > LIMITS.ask) err('budget', `물음이 ${countChars(q.ask!)}자다(${LIMITS.ask}자 안)`);
  if (countChars(q.explain!) > LIMITS.explain) err('budget', `풀이가 ${countChars(q.explain!)}자다(${LIMITS.explain}자 안)`);
  for (const one of [...(q.choices ?? []), ...(q.items ?? []), ...(q.pairs ?? []).flat()]) {
    if (countChars(one) > LIMITS.choice) err('budget', `고를 것 "${one}"이 ${countChars(one)}자다(${LIMITS.choice}자 안)`);
  }
  if (q.passage !== undefined && countChars(q.passage) > LIMITS.passage) err('budget', `읽을 글이 ${countChars(q.passage)}자다(${LIMITS.passage}자 안)`);

  // 3. 답이 고를 것 안에 꼭 하나(꼴마다)
  const answer = q.answer;
  switch (q.form) {
    case 'pick':
    case 'blank':
    case 'picture':
    case 'listen':
    case 'passage': {
      const n = q.choices?.length ?? 0;
      if (n < LIMITS.choicesMin || n > LIMITS.choicesMax) err('answer', `고를 것은 ${LIMITS.choicesMin}~${LIMITS.choicesMax}개다(${n}개)`);
      else if (!isIndex(answer, n)) err('answer', `답은 0부터 센 고를 것의 차례 하나다(받은 것: ${JSON.stringify(answer)})`);
      if (q.form === 'listen' && !q.say) err('answer', '듣고 고르기에 읽어 줄 글(say)이 없다');
      if (q.form === 'passage' && !q.passage) err('answer', '글 읽고 풀기에 글(passage)이 없다');
      if (q.form === 'picture' && !q.figure) err('answer', '그림 고르기에 그림(figure)이 없다');
      break;
    }
    case 'ox':
      if (q.choices !== undefined) err('answer', 'OX는 고를 것을 적지 않는다(화면이 O·X를 보인다)');
      if (answer !== 0 && answer !== 1) err('answer', 'OX의 답은 0(O)이나 1(X)이다');
      break;
    case 'order': {
      const n = q.items?.length ?? 0;
      if (n < LIMITS.orderMin || n > LIMITS.orderMax) err('answer', `순서 맞추기의 낱장은 ${LIMITS.orderMin}~${LIMITS.orderMax}장이다(${n}장)`);
      else if (!isIdentity(answer, n)) err('answer', '순서 맞추기는 낱장을 맞는 차례로 적고 답은 [0, 1, …]이다');
      break;
    }
    case 'match': {
      const n = q.pairs?.length ?? 0;
      if (n < LIMITS.pairsMin || n > LIMITS.pairsMax) err('answer', `짝 맞추기는 ${LIMITS.pairsMin}~${LIMITS.pairsMax}쌍이다(${n}쌍)`);
      else if (!isIdentity(answer, n)) err('answer', '짝 맞추기는 짝을 맞게 적고 답은 [0, 1, …]이다');
      break;
    }
    case 'map':
      if (!(isObject(q.spot) && typeof q.spot.map === 'string' && [q.spot.x, q.spot.y, q.spot.r].every((v) => typeof v === 'number' && Number.isFinite(v)) && q.spot.r > 0)) {
        err('answer', '지도에서 찍기에 찍을 곳(spot: map·x·y·r)이 없다');
      }
      if (typeof answer !== 'string' || answer.trim().length === 0) err('answer', '지도에서 찍기의 답은 찍을 곳의 이름(글자)이다');
      break;
    case 'number':
      if (typeof answer !== 'string' || !/^-?\d+(\.\d+)?$|^\d+\/\d+$|^\d+ \d+\/\d+$/.test(answer)) err('answer', "수 넣기의 답은 글자로 쓴 수다('3/4', '2.5')");
      break;
  }

  // 4. 고를 것끼리 겹치지 않는다
  const dup = (list: readonly string[]) => new Set(list.map(norm)).size !== list.length;
  if (q.choices && dup(q.choices)) err('choices-dup', '고를 것끼리 겹친다');
  if (q.items && dup(q.items)) err('choices-dup', '순서의 낱장끼리 겹친다');
  if (q.pairs && (dup(q.pairs.map((p) => p[0])) || dup(q.pairs.map((p) => p[1])))) err('choices-dup', '짝의 한쪽끼리 겹친다');

  // 5. 근거 번호가 근거 목록에 있다(1개 이상). 수학은 'calc'
  if (q.facts!.length === 0) err('facts', '근거 번호가 없다');
  for (const fact of q.facts!) {
    if (fact === 'calc') {
      if (q.subject !== 'math') err('facts', "'calc'(계산으로 확인)는 수학 문제만 쓴다");
      continue;
    }
    if (!SOURCE_ID.test(fact)) err('facts', `근거 번호의 꼴이 아니다: "${fact}"`);
    else if (!ctx.sources.has(fact)) err('facts', `근거 목록에 없는 번호 "${fact}"`);
  }

  // 6. 성취기준이 목록에 있다
  const standards = ctx.standards ?? new Set(STANDARDS);
  if (q.subject !== 'class' && !standards.has(q.standard ?? '')) err('standard', `성취기준 목록에 없는 코드 "${q.standard ?? ''}"`);

  // 7. 풀이는 "~요"로 끝난다
  if (!endsWithYo(q.explain!)) err('explain-yo', '풀이가 "~요"로 끝나지 않는다');

  // 8. 쓰지 않기로 한 낱말
  const all = textsOf(q).join(' ');
  for (const { word, why } of BANK_BANNED) if (all.includes(word)) err('banned', `"${word}" — ${why}`);

  // 9. 옛이야기 존재는 역사 문제에 섞지 않는다
  for (const being of TALE_BEINGS) if (all.includes(being)) err('tale', `옛이야기 속 존재 "${being}"가 문제에 있다(사실 칸에 섞지 않는다 — 7.8)`);

  // 10. 왼쪽·오른쪽: 사람이 검증해야 통과(8.5)
  const side = SIDE_WORDS.find((word) => all.includes(word));
  if (side && !q.checked) err('side', `"${side}"이 든 문제는 사람이 검증해야 한다(checked) — 동서로 묻거나 "임금이 궁궐에서 남쪽을 바라볼 때"를 붙인다(8.5)`);

  // 11. 지도서·교과서의 차시: facts의 'E9'와 lesson은 함께 다닌다. 쪽수는 적지 않는다
  const e9 = q.facts!.includes('E9');
  if (e9 && !q.lesson) err('lesson', "근거 'E9'(지도서)를 단 문제에 차시(lesson)가 없다");
  if (q.lesson !== undefined && !e9) err('lesson', "차시(lesson)를 단 문제는 근거에 'E9'가 있어야 한다");
  if (q.lesson !== undefined && !LESSON.test(q.lesson)) err('lesson', `차시는 '2단원 2~3차시' 꼴이다(쪽수는 적지 않는다): "${q.lesson}"`);

  // 12. 꼬리표의 꼴
  for (const tag of q.tags ?? []) {
    if (tag === 'core') continue;
    const [kind, value, extra] = tag.split(':');
    if (extra !== undefined || !value) err('tags', `꼬리표의 꼴이 아니다: "${tag}"`);
    else if (kind === 'ep') {
      if (ctx.episodes && !ctx.episodes.has(value)) err('tags', `없는 에피소드 "${value}"`);
    } else if (kind === 'card') {
      if (ctx.cards && !ctx.cards.has(value)) err('tags', `없는 솜씨 카드 "${value}"(꼬리표는 카드 이름이 아니라 id로)`);
    } else if (kind === 'theme') {
      if (!THEME_TAGS.includes(value)) err('tags', `없는 견주기 물음 "${value}"`);
    } else if (kind !== 'topic') err('tags', `모르는 꼬리표 "${tag}"`);
  }

  // 13. 검증한 날의 꼴
  if (q.checked && !/^\d{4}-\d{2}-\d{2}$/.test(q.checked.on)) gap('checked', `검증한 날은 'YYYY-MM-DD' 꼴로: "${q.checked.on}"`);
  return issues;
}

// ── 주제 하나 ────────────────────────────────────────────────

/** 주제의 꼴 */
function checkTopicShape(topic: unknown, err: (rule: string, where: string, message: string) => void): topic is Topic {
  const where = `주제 ${isObject(topic) && typeof topic.id === 'string' ? topic.id : '(id 없음)'}`;
  if (!isObject(topic)) {
    err('topic', where, '주제가 객체가 아니다');
    return false;
  }
  let ok = true;
  const bad = (message: string) => {
    ok = false;
    err('topic', where, message);
  };
  if (typeof topic.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(topic.id)) bad('주제 id는 영문 소문자·숫자와 하이픈이다');
  if (topic.grade !== 5 && topic.grade !== 6) bad('학년은 5나 6이다');
  if (!SUBJECT_IDS.includes(topic.subject as Subject)) bad(`모르는 과목 "${String(topic.subject)}"`);
  if (typeof topic.title !== 'string' || topic.title.length === 0) bad('이름이 없다');
  if (typeof topic.unit !== 'string' || topic.unit.length === 0) bad('단원(unit)이 없다');
  if (!isStrings(topic.standards) || topic.standards.length === 0) bad('성취기준이 없다');
  if (typeof topic.count !== 'number' || !Number.isInteger(topic.count)) bad('문제 수(count)가 정수가 아니다');
  if (typeof topic.bankVer !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(topic.bankVer)) bad("묶음의 판(bankVer)은 'YYYY-MM-DD' 꼴이다");
  if (topic.kind !== 'bank' && topic.kind !== 'story') bad("갈래(kind)는 'bank'나 'story'다");
  return ok;
}

/** 주제 하나와 그 문제들 */
export function checkTopic(topic: Topic, questions: readonly Question[], ctx: BankContext): BankIssue[] {
  const issues: BankIssue[] = [];
  const err = (rule: string, where: string, message: string) => issues.push({ level: 'error', rule, where, message });
  const gap = (rule: string, where: string, message: string) => issues.push({ level: 'gap', rule, where, message });
  if (!checkTopicShape(topic, err)) return issues;
  const where = `주제 ${topic.id}`;
  const standards = ctx.standards ?? new Set(STANDARDS);
  for (const code of topic.standards) if (topic.subject !== 'class' && !standards.has(code)) err('standard', where, `성취기준 목록에 없는 코드 "${code}"`);

  const mine = questions.filter((q) => q.topic === topic.id);
  for (const q of mine) issues.push(...checkQuestion(q, ctx));

  // 문제 수(9.5)
  if (mine.length !== topic.count) err('count', where, `주제의 문제 수(count ${topic.count})와 실제 문제 수(${mine.length})가 다르다`);
  const size = topic.kind === 'bank' ? TOPIC_SIZES.get(topic.id) : undefined;
  if (size !== undefined && mine.length !== size) err('count', where, `9.5의 표에서 이 주제는 ${size}문제다(${mine.length}개)`);
  if (topic.kind === 'bank' && size === undefined && !BANK_SIZES.includes(mine.length)) err('count', where, `은행 주제의 문제 수는 ${BANK_SIZES.join('·')} 가운데 하나다(9.5 — ${mine.length}개)`);
  if (topic.kind === 'story' && (mine.length < STORY_SIZE.min || mine.length > STORY_SIZE.max)) err('count', where, `이야기 문제는 에피소드마다 ${STORY_SIZE.min}~${STORY_SIZE.max}개다(${mine.length}개)`);

  // 어려움 비율 3:5:2(±1)
  if (mine.length > 0) {
    const have = [1, 2, 3].map((level) => mine.filter((q) => q.level === level).length);
    const want = LEVEL_SHARE.map((share) => Math.round(mine.length * share));
    const off = have.map((n, i) => Math.abs(n - want[i]));
    if (off.some((d) => d > LEVEL_SLACK)) err('level-mix', where, `쉬움·보통·어려움이 ${have.join('·')}이다(${want.join('·')} ±${LEVEL_SLACK})`);
  }

  // 연도를 그대로 묻는 문제는 열에 하나 안
  const years = mine.filter((q) => asksYear(q));
  const yearCap = Math.floor(mine.length * YEAR_SHARE);
  if (years.length > yearCap) err('year-share', where, `연도를 그대로 묻는 문제가 ${years.length}개다(${yearCap}개 안 — ${years.map((q) => q.id).join(', ')})`);

  // id의 꼴: 주제 id + '-' + 번호(은행 네 자리, 이야기 세 자리). 번호는 1부터, 겹치지 않는다
  const digits = topic.kind === 'bank' ? 4 : 3;
  const idForm = new RegExp(`^${topic.id.replace(/[-]/g, '\\-')}-\\d{${digits}}$`);
  const slots = new Map<number, string>();
  for (const q of mine) {
    if (!idForm.test(q.id)) err('id', `문제 ${q.id}`, `id는 '${topic.id}-${'0'.repeat(digits - 1)}1' 꼴이다(주제 id + 번호 ${digits}자리)`);
    const slot = slotOf(q.id);
    if (slot < 1) err('id', `문제 ${q.id}`, 'id의 번호는 1부터다');
    const had = slots.get(slot);
    if (had !== undefined) err('id', `문제 ${q.id}`, `번호가 겹친다(${had}) — 비트 묶음의 자리가 같다`);
    slots.set(slot, q.id);
    if (!topic.standards.includes(q.standard) && q.subject !== 'class') err('standard', `문제 ${q.id}`, `주제의 성취기준(${topic.standards.join(', ')})에 없는 "${q.standard}"`);
    if (q.grade !== topic.grade || q.subject !== topic.subject) err('topic', `문제 ${q.id}`, '주제와 학년·과목이 다르다');
  }

  // 이야기 문제는 겨루기에 나가므로 "겨루기에도" 꼴만(순서 셋까지·짝 두 쌍까지)
  if (topic.kind === 'story') {
    for (const q of mine) if (!isBattleReady(q)) err('battle-form', `문제 ${q.id}`, `겨루기에 나가는 문제는 ${BATTLE_FORMS.join('·')} 꼴이고 순서는 ${BATTLE_LIMITS.order}장·짝은 ${BATTLE_LIMITS.pairs}쌍까지다(8.5)`);
  }

  // 같거나 아주 비슷한 물음(주제 안)
  similarAsks(mine, gap, err);
  return issues;
}

/** 같거나 아주 비슷한 물음: 같은 물음이면 잘못, 낱말 겹침이 SIMILAR_AT 넘고 답(고른 것의 글)도 같으면 잘못, 답이 다르면 사람이 본다 */
function similarAsks(list: readonly Question[], gap: (rule: string, where: string, message: string) => void, err: (rule: string, where: string, message: string) => void): void {
  const answerText = (q: Question): string => (typeof q.answer === 'number' && q.choices ? (q.choices[q.answer] ?? '') : JSON.stringify(q.answer));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (norm(a.ask) === norm(b.ask)) {
        if (JSON.stringify([a.choices, a.items, a.pairs]) === JSON.stringify([b.choices, b.items, b.pairs]) || answerText(a) === answerText(b)) {
          err('ask-same', `문제 ${b.id}`, `${a.id}와 물음이 같다`);
        } else gap('ask-similar', `문제 ${b.id}`, `${a.id}와 물음이 같다(고를 것은 다르다 — 사람이 본다)`);
        continue;
      }
      const s = similarity(a.ask, b.ask);
      if (s < SIMILAR_AT) continue;
      if (answerText(a) === answerText(b)) err('ask-same', `문제 ${b.id}`, `${a.id}와 아주 비슷한 물음에 답도 같다(낱말 겹침 ${s.toFixed(2)})`);
      else gap('ask-similar', `문제 ${b.id}`, `${a.id}와 아주 비슷한 물음이다(낱말 겹침 ${s.toFixed(2)} — 사람이 본다)`);
    }
  }
}

// ── 묶음 전체 ────────────────────────────────────────────────

/** 묶음 전체: 주제마다 checkTopic + 주제 id 겹침, 주제 없는 문제, 주제를 건너 겹치는 id·물음 */
export function checkBank(topics: readonly Topic[], questions: readonly Question[], ctx: BankContext): BankIssue[] {
  const issues: BankIssue[] = [];
  const err = (rule: string, where: string, message: string) => issues.push({ level: 'error', rule, where, message });
  const gap = (rule: string, where: string, message: string) => issues.push({ level: 'gap', rule, where, message });
  const ids = new Set<string>();
  for (const topic of topics) {
    if (ids.has(topic.id)) err('topic', `주제 ${topic.id}`, '주제 id가 겹친다');
    ids.add(topic.id);
    issues.push(...checkTopic(topic, questions, ctx));
  }
  const seen = new Set<string>();
  for (const q of questions) {
    if (!ids.has(q.topic)) {
      err('topic', `문제 ${q.id}`, `없는 주제 "${q.topic}"`);
      issues.push(...checkQuestion(q, ctx));
    }
    if (seen.has(q.id)) err('id', `문제 ${q.id}`, 'id가 겹친다');
    seen.add(q.id);
  }
  // 주제를 건너 같은 물음
  const byAsk = new Map<string, Question>();
  for (const q of questions) {
    const key = norm(q.ask);
    const had = byAsk.get(key);
    if (had && had.topic !== q.topic) gap('ask-similar', `문제 ${q.id}`, `다른 주제의 ${had.id}와 물음이 같다(사람이 본다)`);
    byAsk.set(key, q);
  }
  return issues;
}

/** 잘못이 없는 문제만 남긴다(받은 반 묶음을 거를 때 — 꼴이 틀린 것은 버린다) */
export function filterQuestions(list: readonly unknown[], ctx: BankContext): Question[] {
  return list.filter((q) => !checkQuestion(q, ctx).some((issue) => issue.level === 'error')) as Question[];
}

export function bankErrors(issues: readonly BankIssue[]): BankIssue[] {
  return issues.filter((issue) => issue.level === 'error');
}
