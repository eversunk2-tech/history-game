// 서당의 문제 은행(spec 9.3·9.5·9.6, 11.1 다·라). 4-1의 첫 은행은 5학년 사회 2-1 「조선의 건국과 한양」·2-2 「유교 질서와 조선 사회」 160문제다.
// 이 파일은 뼈대다(4-1 ㉡). 문제는 은행 Build(㉮)가 넣는다 — 이 폴더에 주제 파일을 두기만 하면 코드를 고치지 않고 읽힌다.
// 은행이 비어도 게임·검사기·시험은 돈다(서당 주제에 문제가 없으면 겨루기는 다음 차례의 문제를 찾는다 — engine/quiz.ts).
//
// ── 은행 파일의 꼴 ────────────────────────────────────────────
// 주제 하나가 JSON 파일 하나다: src/content/bank/<주제 id>.json (예: soc5-2-1.json, soc5-2-2.json)
//   {
//     "topic": {                       // engine/types4.ts의 Topic
//       "id": "soc5-2-1", "grade": 5, "subject": "social", "title": "조선의 건국과 한양",
//       "unit": "5-2 2단원", "lessons": "2~3차시", "standards": ["[6사05-01]"],
//       "count": 80, "bankVer": "2026-11-10", "kind": "bank"
//     },
//     "questions": [                   // engine/types4.ts의 Question — count개
//       { "id": "soc5-2-1-0001", "grade": 5, "subject": "social", "topic": "soc5-2-1", "standard": "[6사05-01]",
//         "form": "pick", "ask": "…(80자 안)", "choices": ["…", "…", "…", "…"], "answer": 2,
//         "explain": "…요.(60자 안)", "level": 1, "facts": ["F34"], "tags": ["theme:duty"], "by": "claude", "ver": 1 }
//     ]
//   }
// - 파일 이름은 주제 id와 같다. id는 '<주제 id>-0001'부터 네 자리 번호(번호가 비트 묶음의 자리 — 한 번 정하면 바꾸지 않는다. 고치면 ver를 올린다).
// - answer: 고르기는 0부터 센 차례, OX는 0 = O · 1 = X(choices 없음), 순서·짝은 맞는 차례로 적고 [0, 1, …], 지도에서 찍기는 찍을 곳의 이름.
// - 지도서·교과서에 기대는 문제만 facts에 'E9'와 lesson('2단원 2~3차시')을 단다. 지도서·교과서의 글·그림·평가 문항을 옮기지 않고 쪽수를 적지 않는다.
// - 새 근거는 ./sources.ts(F86부터). 검사 규칙은 ../bankRules.ts(시험 tests/bank.test.ts가 모든 파일을 돌린다 — 잘못 0이어야 한다).
// - 쉬움 3 : 보통 5 : 어려움 2(±1), 연도를 그대로 묻는 문제는 열에 하나 안, "왼쪽·오른쪽"은 사람이 검증한 뒤(checked).
// - 문제 수는 9.5의 표의 그 주제의 수와 같다(bankRules의 TOPIC_SIZES — 2-1·2-2는 80. 표에 없는 주제는 40·60·80 가운데 하나).
//
// ── ㉮가 더할 자리 ────────────────────────────────────────────
// ① 이 폴더의 주제 파일(<주제 id>.json) ② ./sources.ts의 bankSources 줄 ③ docs/bank/(근거 목록·검증 기록·사람이 볼 표본).
// 이 파일(index.ts)과 bankRules.ts는 고치지 않는다(꼴을 바꿔야 하면 ㉡·㉢의 Build에게 알린다).

import type { Question, Topic } from '../../engine/types4';
import { checkBank, type BankContext, type BankIssue } from '../bankRules';

/** 주제 파일 하나 */
export interface BankFile {
  topic: Topic;
  questions: Question[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 주제 파일 하나를 읽는다: 꼴(topic·questions)과 파일 이름 = 주제 id를 본다. 문제 하나하나의 검사는 checkBankFiles가 한다 */
export function readBankFile(path: string, raw: unknown): { file: BankFile | null; issues: BankIssue[] } {
  const name = path.replace(/^.*\//, '').replace(/\.json$/, '');
  const where = `은행 파일 ${name}.json`;
  if (!isObject(raw) || !isObject(raw.topic) || !Array.isArray(raw.questions)) {
    return { file: null, issues: [{ level: 'error', rule: 'file', where, message: '꼴은 { "topic": Topic, "questions": Question[] }이다' }] };
  }
  const file = { topic: raw.topic as unknown as Topic, questions: raw.questions as Question[] };
  const issues: BankIssue[] = [];
  if (file.topic.id !== name) issues.push({ level: 'error', rule: 'file', where, message: `파일 이름은 주제 id와 같아야 한다(주제 id "${String(file.topic.id)}")` });
  if (file.topic.kind !== 'bank') issues.push({ level: 'error', rule: 'file', where, message: "은행 파일의 주제는 kind 'bank'다(이야기 문제는 에피소드의 콘텐츠 폴더에 — 9.3)" });
  for (const q of file.questions) {
    if (isObject(q) && q.topic !== file.topic.id) issues.push({ level: 'error', rule: 'file', where, message: `문제 ${String(q.id)}의 주제가 파일의 주제와 다르다` });
  }
  return { file, issues };
}

// 이 폴더의 *.json을 모두 읽는다(빌드 때 게임 묶음에 들어간다 — 인터넷이 끊겨도 서당과 겨루기가 된다, 9.6)
const RAW = import.meta.glob<unknown>('./*.json', { eager: true, import: 'default' });
const READ = Object.entries(RAW)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, raw]) => ({ path, ...readBankFile(path, raw) }));

/** 주제 파일을 읽으며 생긴 잘못(꼴·파일 이름) — 검사기가 문제 검사와 함께 알린다 */
export const bankReadIssues: BankIssue[] = READ.flatMap((one) => one.issues);
/** 읽은 주제 파일(꼴이 맞은 것). 지금은 비어 있다 */
export const bankFiles: BankFile[] = READ.flatMap((one) => (one.file ? [one.file] : []));
/** 은행의 주제(서당 목록에 뜨는 것) */
export const bankTopics: Topic[] = bankFiles.map((file) => file.topic);
/** 은행의 문제 모두 */
export const bankQuestions: Question[] = bankFiles.flatMap((file) => file.questions);

/** 은행 파일을 모두 검사한다: 파일의 꼴 + 문제 검사 규칙 전부(bankRules.checkBank) */
export function checkBankFiles(ctx: BankContext, files: readonly { path: string; file: BankFile | null; issues: BankIssue[] }[] = READ): BankIssue[] {
  const read = files.flatMap((one) => one.issues);
  const good = files.flatMap((one) => (one.file ? [one.file] : []));
  return [...read, ...checkBank(good.map((f) => f.topic), good.flatMap((f) => f.questions), ctx)];
}
