// ①-1 「새 도읍의 봄」의 이야기 문제 20(spec 8.5의 1번, 9.3, 11.1 라). 겨루기가 먼저 여기서 고르고, 지혜 겨루기는 'core'(핵심 물음 일곱)에서 낸다.
// 글은 대본 docs/script-1395.md 26.9에 먼저 쓰고 옮겼다(한 글자도 다르지 않게). 근거의 대조는 26.10.
//
// - 봄에서 겪고 들은 것만 묻는다: 돌려보낸 까닭, 스님들의 공사, 볍씨를 바로 뿌림과 김매기, 값은 쌀·베, 절과 스님, 고려에서 조선으로.
// - 꼴은 9.2의 "겨루기에도" 꼴만: 고르기(넷 가운데 하나) 13 · OX 4 · 순서(셋) 2 · 짝(두 쌍) 1. 지도에서 찍기는 쓰지 않는다.
// - 어려움: 쉬움 6 · 보통 10 · 어려움 4. 연도를 그대로 묻는 문제는 하나(009).
// - answer: 고르기는 0부터 센 차례(자리를 고루 섞었다), OX는 0 = O · 1 = X(choices를 적지 않는다), 순서·짝은 맞는 차례로 적고 [0, 1, …].
// - 옛이야기 존재(도깨비)는 문제에 섞지 않는다(7.8). "왼쪽·오른쪽"을 쓰지 않는다(8.5).
// - 지도서·교과서에 기대는 문제만 facts에 'E9'와 lesson(차시)을 단다. 지도서·교과서의 문장·그림·평가 문항을 옮기지 않고 쪽수도 적지 않는다.
// 이 폴더의 다른 파일과 이름이 겹치지 않게 storyTopics·storyQuestions로 내보낸다(content/index.ts는 missions·happenings만 읽는다).
// id는 한 번 정하면 바꾸지 않는다(기기의 "푼 문제"가 id로 적힌다). 고치면 ver를 올린다.

import type { Question, Topic } from '../../../engine/types4';

const TOPIC = 'ep-s1395-1';
const EP = 'ep:s1395-1';

export const storyTopics: Topic[] = [
  {
    id: TOPIC,
    grade: 5,
    subject: 'social',
    title: '새 도읍의 봄',
    unit: '5-2 2단원',
    lessons: '2~3차시',
    standards: ['[6사05-01]'],
    count: 20,
    bankVer: '2026-11-07',
    kind: 'story',
  },
];

/** 이야기 문제 한 줄의 공통 칸 */
const base = { grade: 5, subject: 'social', topic: TOPIC, standard: '[6사05-01]', by: 'claude', ver: 1 } as const;

export const storyQuestions: Question[] = [
  // ── 핵심 물음 일곱(core) — 8.3의 ①-1 줄의 셋(001·002·003) + 넷 ──
  {
    ...base,
    id: 'ep-s1395-1-001',
    form: 'pick',
    ask: '1394년에 조선이 새 도읍으로 정하고 옮겨 간 곳은 어디일까요?',
    choices: ['개경', '한양', '경주', '평양'],
    answer: 1,
    explain: '조선은 1394년에 한양을 새 도읍으로 정하고 그해 시월에 옮겼어요.',
    level: 1,
    facts: ['F34', 'E9'],
    lesson: '2단원 2~3차시',
    tags: [EP, 'core', 'theme:duty'],
  },
  {
    ...base,
    id: 'ep-s1395-1-002',
    form: 'pick',
    ask: '나라가 궁궐 터를 닦을 때 여러 절의 스님들을 모아 일하게 한 까닭은 무엇일까요?',
    choices: ['스님들이 궁궐에서 살려고', '절을 새로 지으려고', '백성을 힘들게 하지 않으려고', '농사지을 땅이 모자라서'],
    answer: 2,
    explain: '나라는 백성을 괴롭히지 않으려고 스님들을 모아 옷과 먹을 것을 주며 일하게 했어요.',
    level: 2,
    facts: ['F34'],
    tags: [EP, 'core', 'card:skill-provision', 'theme:duty'],
  },
  {
    ...base,
    id: 'ep-s1395-1-003',
    form: 'pick',
    ask: '이월에 나라가 궁궐을 짓던 농민들을 집으로 돌려보낸 까닭은 무엇일까요?',
    choices: ['농사 때를 놓치지 않게 하려고', '궁궐을 다 지어서', '큰비가 와서 일을 못 해서', '일꾼들끼리 다투어서'],
    answer: 0,
    explain: '농민으로 일꾼을 채우면 농사 때를 놓친다고 해서 봄 농사철에 돌려보냈어요.',
    level: 2,
    facts: ['F35'],
    tags: [EP, 'core', 'card:skill-help', 'theme:duty'],
  },
  {
    ...base,
    id: 'ep-s1395-1-004',
    form: 'pick',
    ask: '집으로 돌아간 농민들 대신 궁궐 짓는 일을 맡은 사람들은 누구일까요?',
    choices: ['향교의 학생들', '양반 집 아이들', '고을의 관리들', '여러 절의 스님들'],
    answer: 3,
    explain: '농민들이 봄 농사를 지으러 돌아간 뒤에는 스님들이 대신 궁궐을 지었어요.',
    level: 1,
    facts: ['F35'],
    tags: [EP, 'core', 'card:skill-provision', 'theme:duty'],
  },
  {
    ...base,
    id: 'ep-s1395-1-005',
    form: 'ox',
    ask: '이 무렵 농민들은 볍씨를 논에 바로 뿌려 벼를 길렀다.',
    answer: 0,
    explain: '이때는 볍씨를 논에 바로 뿌렸어요. 모를 옮겨 심는 모내기는 훨씬 뒤에 널리 퍼졌어요.',
    level: 1,
    facts: ['F04', 'E9'],
    lesson: '2단원 8차시',
    tags: [EP, 'core', 'card:skill-sow', 'theme:farming'],
  },
  {
    ...base,
    id: 'ep-s1395-1-006',
    form: 'pick',
    ask: '이 무렵 사람들이 물건값을 치를 때 돈처럼 쓴 것은 무엇일까요?',
    choices: ['조개껍데기', '쌀과 베', '종이돈', '금과 은'],
    answer: 1,
    explain: '이때는 쌀과 베로 값을 치렀어요. 베는 옷감이면서 값이기도 했어요.',
    level: 1,
    facts: ['F08', 'E9'],
    lesson: '2단원 8차시',
    tags: [EP, 'core', 'card:skill-reckon', 'theme:paying'],
  },
  {
    ...base,
    id: 'ep-s1395-1-007',
    form: 'order',
    ask: '고려에서 조선으로 바뀌던 일을 일어난 차례대로 놓아 보세요.',
    items: ['새 임금이 왕위에 올랐다', '나라 이름을 조선으로 정했다', '도읍을 한양으로 옮겼다'],
    answer: [0, 1, 2],
    explain: '1392년 새 임금이 서고, 1393년 나라 이름을 정하고, 1394년 도읍을 옮겼어요.',
    level: 3,
    facts: ['F56', 'F84', 'F34', 'E9'],
    lesson: '2단원 2~3차시',
    tags: [EP, 'core', 'theme:duty'],
  },

  // ── 고려에서 조선으로 ──
  {
    ...base,
    id: 'ep-s1395-1-008',
    form: 'pick',
    ask: '나라 이름을 ‘조선’으로 정하기 전에 이 나라는 무엇이라 불렸을까요?',
    choices: ['신라', '백제', '고려', '발해'],
    answer: 2,
    explain: '새 임금이 선 뒤에도 한동안 고려라 하다가 이듬해 조선으로 바꾸었어요.',
    level: 1,
    facts: ['F84', 'F56', 'E9'],
    lesson: '2단원 2~3차시',
    tags: [EP, 'theme:duty'],
  },
  {
    // 연도를 그대로 묻는 문제(이 주제의 하나)
    ...base,
    id: 'ep-s1395-1-009',
    form: 'pick',
    ask: '새 임금이 왕위에 올라 조선을 연 해는 언제일까요?',
    choices: ['1392년', '1394년', '1395년', '1446년'],
    answer: 0,
    explain: '1392년 칠월에 새 임금이 왕위에 올랐어요. 1395년 봄에서 보면 세 해 전이에요.',
    level: 2,
    facts: ['F56', 'E9'],
    lesson: '2단원 2~3차시',
    tags: [EP, 'theme:duty'],
  },

  // ── 스님들의 공사 ──
  {
    ...base,
    id: 'ep-s1395-1-010',
    form: 'ox',
    ask: '궁궐을 짓는 스님들은 먹을 것과 입을 것을 스스로 마련해야 했다.',
    answer: 1,
    explain: '나라의 관청이 스님들에게 옷과 먹을 것을 주며 일하게 했어요.',
    level: 2,
    facts: ['F34'],
    tags: [EP, 'card:skill-provision', 'theme:duty'],
  },
  {
    // 상소문(대사헌 박경 등)의 말 — "그 글은 … 했어요"로 글의 말임을 밝힌다
    ...base,
    id: 'ep-s1395-1-011',
    form: 'ox',
    ask: '궁궐 공사에 스님을 쓰자는 글은 스님들이 집 짓는 일에 서툴다고 했다.',
    answer: 1,
    explain: '그 글은 스님들이 집 짓는 솜씨가 능숙하다고 했어요.',
    level: 2,
    facts: ['F35'],
    tags: [EP, 'card:skill-carry', 'theme:duty'],
  },
  {
    // "열에 셋"은 상소문의 말이지 센 숫자가 아니다(대본 8절의 카드 「절과 스님」과 같다)
    ...base,
    id: 'ep-s1395-1-012',
    form: 'pick',
    ask: '나라에 올린 글에서 백성 가운데 스님이 얼마쯤 된다고 했을까요?',
    choices: ['열에 하나', '열에 둘', '열에 다섯', '열에 셋'],
    answer: 3,
    explain: '글에 백성 열에 셋이 스님이라는 말이 나올 만큼 스님이 많았어요.',
    level: 3,
    facts: ['F35'],
    tags: [EP, 'theme:inheritance'],
  },

  // ── 돌려보낸 까닭과 불려 간 사람 ──
  {
    ...base,
    id: 'ep-s1395-1-013',
    form: 'pick',
    ask: '새 도읍의 궁궐 공사에 불려 간 일꾼은 주로 누구였을까요?',
    choices: ['고을의 어린아이들', '여러 도의 어른 남자들', '양반 집 부인들', '향교의 선생님들'],
    answer: 1,
    explain: '궁궐을 지으려고 여러 도에서 장정, 곧 어른 남자들을 불렀어요.',
    level: 2,
    facts: ['F35', 'F02'],
    tags: [EP, 'card:skill-call', 'theme:duty'],
  },

  // ── 볍씨를 바로 뿌림과 김매기 ──
  {
    ...base,
    id: 'ep-s1395-1-014',
    form: 'pick',
    ask: '논에서 벼 사이에 난 풀을 뽑는 일을 무엇이라고 할까요?',
    choices: ['김매기', '모내기', '타작', '논갈이'],
    answer: 0,
    explain: '논의 풀을 뽑는 일을 김매기라고 해요.',
    level: 1,
    facts: ['F04'],
    tags: [EP, 'theme:farming'],
  },
  {
    ...base,
    id: 'ep-s1395-1-015',
    form: 'pick',
    ask: '볍씨를 논에 바로 뿌리면 김매기가 힘들었던 까닭은 무엇일까요?',
    choices: ['볍씨가 물에 떠내려가서', '논에 물을 댈 수 없어서', '벼와 풀이 함께 자라서', '소가 논에 못 들어가서'],
    answer: 2,
    explain: '볍씨를 바로 뿌리면 어린 벼와 풀이 함께 자라 풀을 가려 뽑기가 힘들었어요.',
    level: 2,
    facts: ['F04'],
    tags: [EP, 'card:skill-sow', 'theme:farming'],
  },
  {
    ...base,
    id: 'ep-s1395-1-016',
    form: 'pick',
    ask: '볍씨를 바로 뿌린 논은 김을 몇 번쯤 매야 했을까요?',
    choices: ['한 번', '두 번', '열 번 넘게', '네댓 번'],
    answer: 3,
    explain: '바로 뿌린 논은 김을 네댓 번 매야 했어요. 옮겨 심은 논은 두세 번이었어요.',
    level: 3,
    facts: ['F04'],
    tags: [EP, 'theme:farming'],
  },

  // ── 값은 쌀·베 ──
  {
    ...base,
    id: 'ep-s1395-1-017',
    form: 'pick',
    ask: '그때 사람들이 쌀과 베로 값을 치른 까닭으로 알맞은 것은 무엇일까요?',
    choices: ['쌀과 베가 가장 가벼워서', '돈이 널리 쓰이지 않아서', '나라가 돈을 쓰지 말라고 해서', '쌀과 베를 나라가 나눠 주어서'],
    answer: 1,
    explain: '이때는 돈이 널리 쓰이지 않아 쌀과 베가 돈처럼 쓰였어요.',
    level: 2,
    facts: ['F08'],
    tags: [EP, 'card:skill-reckon', 'card:skill-wood', 'theme:paying'],
  },

  // ── 절과 스님 ──
  {
    // 사대부 자료에 기댄다(F37 — 농민 집의 제사는 자료가 없다). "사람이 많았다"까지만 묻는다
    ...base,
    id: 'ep-s1395-1-018',
    form: 'ox',
    ask: '이 무렵에는 제사나 장례를 치를 때 절을 찾는 사람이 많았다.',
    answer: 0,
    explain: '고려 때부터 이어져 조선 초에도 제사나 장례 때 절을 찾는 일이 흔했어요.',
    level: 2,
    facts: ['F37'],
    tags: [EP, 'theme:inheritance'],
  },

  // ── 새 도읍 공사의 차례, 맡은 일 ──
  {
    // "지난해·올해"는 겨루기의 때(1395년 봄)에서 센 말이다
    ...base,
    id: 'ep-s1395-1-019',
    form: 'order',
    ask: '새 도읍 공사에 얽힌 일을 먼저 생긴 것부터 늘어놓아 보세요.',
    items: ['한양으로 도읍을 옮겨 왔다', '궁궐 터를 닦기 시작했다', '농민을 돌려보내고 스님이 대신했다'],
    answer: [0, 1, 2],
    explain: '지난해 시월 도읍을 옮기고 십이월에 터를 닦았어요. 올해 이월에 농민을 돌려보냈어요.',
    level: 3,
    facts: ['F34', 'F35'],
    tags: [EP, 'card:skill-carry', 'theme:duty'],
  },
  {
    ...base,
    id: 'ep-s1395-1-020',
    form: 'match',
    ask: '봄에 사람들이 맡은 일을 알맞게 이어 보세요.',
    pairs: [
      ['스님들', '궁궐 짓는 일'],
      ['돌아온 농민들', '봄 농사'],
    ],
    answer: [0, 1],
    explain: '나라는 농민은 농사짓게 돌려보내고, 궁궐 일은 스님들에게 맡겼어요.',
    level: 2,
    facts: ['F35'],
    tags: [EP, 'card:skill-help', 'theme:duty'],
  },
];
