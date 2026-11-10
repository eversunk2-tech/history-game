// 거점 — 느티나무 마을(spec 4.2, 5.1, 6.1~6.3, 11.1 가). 시간 밖의 마을이다: 신분도 해 ☀도 살림도 없다.
// 글은 대본 docs/script-hub.md(거점)와 docs/script-1395.md 26.4·26.6·26.7(겨루기·결과 종이의 정령의 말)에 먼저 쓰고 옮겼다.
// 화면(㉢ 출전 고리, ㉣ 거점과 서당)이 이 파일을 그대로 가져다 쓴다. 숫자(첫 선물의 쌀·베, 값)는 engine/balance.ts와 gear·outfits에 있다.
//
// 내보내는 것
//   facilities   시설 열하나(FACILITY_IDS 모두 — 4-1에 열린 것은 gate·board·tools·wardrobe·seodang)
//   keepers      시설지기(꾸민 사람 — 남녀노소를 고루. 닫힌 시설의 시설지기는 4-3에서 말을 더한다)
//   board        알림판의 의뢰·작은 의뢰(①-1을 깨기 전과 뒤)
//   speakers     겨루기·말풍선의 이름표(who 열쇠 → 이름표 6자). 사람의 이름표는 이야기 묶음(situation.people)에 있다
//   spirit       정령 느티의 말(마을 소개·첫 선물·겨루기 안내·귀띔·기세·합동 기술·별의 줄·정령의 물음 앞의 말·자람·출전 준비)
//   notices      알림 한 줄(곧 열려요·시험 판·옛 저장·해가 남았어요·준비 중 …)
//   seodangTalk  서당 훈장님의 말과 서당의 알림
//   shopTalk     도구점·포목점의 말
// 정령은 다정한 반말, 한 창 60자 안(6.2). 그 시대 사람에게 보이지 않는다(대화 장면에 서지 않고 말풍선만).

import type { Line } from '../engine/types';
import type { BoardNote, CardKind, Facility, FacilityId, Keeper } from '../engine/types4';

/** 시설 열하나(6.3). does = 하는 일 한 줄(30자) — 닫힌 곳은 그 아래에 notices.soon("곧 열려요")을 붙여 보인다 */
export const facilities: Facility[] = [
  { id: 'gate', name: '시간의 문', open: true, does: '옛 시대로 가는 문이에요. 연표를 펼쳐요' },
  { id: 'board', name: '알림판', open: true, does: '의뢰와 작은 의뢰가 붙어 있어요' },
  { id: 'tools', name: '도구점', open: true, does: '연장을 사고 쓰인 시대를 알아봐요', keeper: 'tool-grandpa' },
  { id: 'workshop', name: '공방', open: false, does: '발명품 모형을 만들어요', keeper: 'workshop-youth' },
  { id: 'wardrobe', name: '포목점·댕기방', open: true, does: '옷과 댕기를 골라 입어요', keeper: 'cloth-auntie' },
  { id: 'market', name: '장터', open: false, does: '물건을 팔고 재료를 사요', keeper: 'market-kid' },
  { id: 'museum', name: '박물관', open: false, does: '유물을 모으고 시대를 견주어요', keeper: 'museum-grandma' },
  { id: 'home', name: '우리 집', open: false, does: '꾸미고 남길 것을 놓아요' },
  { id: 'seodang', name: '서당', open: true, does: '훈장님과 문제를 풀며 배워요', keeper: 'teacher' },
  // 주막은 국밥과 식혜를 파는 집으로 그리고 술은 그리지 않는다(6.3 — 4-3)
  { id: 'inn', name: '주막', open: false, does: '소문을 듣고 쉬어 가요', keeper: 'inn-uncle' },
  { id: 'studio', name: '사진관', open: false, does: '기념사진을 찍어요', keeper: 'studio-youth' },
];

/** 시설 id로 찾기 */
export function facilityOf(id: FacilityId): Facility | undefined {
  return facilities.find((one) => one.id === id);
}

/** 시설지기(꾸민 사람). 남 넷·여 넷, 노인 셋·어른 둘·젊은이 둘·아이 하나. greet = 처음 들어설 때의 말(닫힌 시설은 4-3에서 채운다) */
export const keepers: Keeper[] = [
  { id: 'teacher', label: '훈장님', sex: 'm', age: 'old', greet: [{ who: 'teacher', text: '어서 오너라. 오늘은 무엇을 익혀 보겠느냐?' }] },
  { id: 'tool-grandpa', label: '할아버지', sex: 'm', age: 'old', greet: [{ who: 'tool-grandpa', text: '어서 오너라. 연장마다 쓰인 때가 다르단다. 쪽지를 읽어 보렴.' }] },
  { id: 'cloth-auntie', label: '아주머니', sex: 'f', age: 'adult', greet: [{ who: 'cloth-auntie', text: '어서 오렴. 빛깔마다 쪽지가 붙어 있으니 읽어 보고 골라라.' }] },
  { id: 'workshop-youth', label: '젊은 장인', sex: 'm', age: 'young', greet: [] },
  { id: 'market-kid', label: '장터 아이', sex: 'f', age: 'child', greet: [] },
  { id: 'museum-grandma', label: '할머니', sex: 'f', age: 'old', greet: [] },
  { id: 'inn-uncle', label: '주막 아저씨', sex: 'm', age: 'adult', greet: [] },
  { id: 'studio-youth', label: '사진사', sex: 'f', age: 'young', greet: [] },
];

/** 알림판. 작은 의뢰(small)는 안내일 뿐 보상이 없다(5.6의 1번). 한 줄 40자 */
export const board: BoardNote[] = [
  // ①-1을 깨기 전
  { id: 'board-s1395-1', kind: 'request', title: '새 도읍의 봄', text: '돌아온 이웃을 맞고 봄 일을 시작하자', episode: 's1395-1', when: 'before' },
  { id: 'board-small-tools', kind: 'small', title: '도구점에서 연장 하나 사 보기', text: '출전할 때 손에 들 연장을 하나 골라 보자', when: 'before', after: 's1395-1' },
  // ①-1을 깬 뒤 — ①-2는 4-3에 열린다(에피소드 표에 아직 없어 episode를 적지 않는다)
  { id: 'board-s1395-2', kind: 'request', title: '단오와 김매기', text: '명절을 보내고, 벼 사이의 풀과 맞서자 — 곧 열려요', when: 'after', after: 's1395-1' },
  { id: 'board-small-seodang', kind: 'small', title: '서당에서 「조선의 건국과 한양」 한 판', text: '훈장님과 스무 문제를 풀어 보자', when: 'after', after: 's1395-1' },
];

/** 이름표(who 열쇠 → 이름표). 정령과 도깨비, 시설지기. 이야기 속 사람(father·neighbor-elder …)은 situation.people에 있다 */
export const speakers: Record<string, string> = {
  neuti: '느티',
  dokkaebi: '도깨비',
  ...Object.fromEntries(keepers.map((keeper) => [keeper.id, keeper.label])),
};

const N = 'neuti';

/** 합동 기술 하나(기세가 차면 고른다 — 문제를 내지 않는다. 8.1) */
export interface JointSkill {
  id: 'shade' | 'lift';
  /** 이름(12자) */
  name: string;
  /** 고를 때 보이는 쪽지(60자) */
  text: string;
  /** 쓸 때의 말 한 줄(정령이면 who: 'neuti', 이웃이면 "나"의 이야기 줄) */
  say: Line;
}

/** 정령 느티의 말. 꾸민 동료다(선생님 자료에 "꾸민 동료"). 대본: script-hub.md 2절, script-1395.md 26.4·26.6·26.7 */
export const spirit = {
  /** 이름(13.2의 1번) */
  name: '느티',
  /** 마을 소개 — 처음 거점에 들어올 때 한 번(1분 안, 화면이 "건너뛰기"를 둔다). 여섯 창 */
  intro: [
    { who: N, text: '안녕! 나는 느티야. 이 큰 느티나무에서 오백 년을 살았어.' },
    { who: N, text: '여기는 느티나무 마을이야. 시간 밖에 있어서 여러 시대의 것이 모여 있어.' },
    { who: N, text: '이 나무가 시간의 문이야. 누르면 옛날로 가는 연표가 펼쳐져.' },
    { who: N, text: '알림판에는 해 볼 일이 붙어. 도구점에서는 연장을, 포목점에서는 옷과 댕기를 골라.' },
    { who: N, text: '서당에서는 훈장님과 문제를 풀며 배울 수 있어.' },
    { who: N, text: '나는 옛날 사람들 눈에는 안 보여. 그래서 네가 필요해. 같이 가 줄래?' },
  ] as Line[],
  /** 첫 선물 — 마을 소개 뒤(건너뛰어도 받는다). 돈 주머니 쌀 3되·베 2자(BALANCE.giftRice·giftCloth)와 마을 창고의 도리깨(gear-flail — 시대 잠김의 첫 예) */
  gift: [
    { who: N, text: '자, 첫 선물이야. 쌀 세 되와 베 두 자를 돈 주머니에 넣어 줄게.' },
    { who: N, text: '1395년 사람들은 쌀과 베로 값을 치렀어. 그래서 이 마을 가게도 쌀과 베를 받아.' },
    { who: N, text: '창고에서 도리깨도 찾았어. 1395년 기록에서는 아직 못 찾은 연장이라, 그때로는 못 가져가.' },
  ] as Line[],
  /** 첫 선물로 가진 것에 넣는 물건 */
  giftItems: ['gear-flail'],
  /** 겨루기 안내 세 걸음 — 처음 하는 겨루기(①-1의 「굳은 논흙」)의 여는 말 다음에 한 번: 예고를 본다 → 카드를 낸다 → 문제를 푼다 */
  guide: [
    { who: N, text: '먼저 고비가 다음에 할 일을 봐. 그림과 한 줄로 미리 알려 줘.' },
    { who: N, text: '그다음 카드를 하나 골라 내. ★가 붙은 카드가 이번에 센 카드야.' },
    { who: N, text: '카드를 내면 문제가 나와. 맞히면 힘이 두 배! 틀려도 힘은 나가.' },
  ] as Line[],
  /** 귀띔(고르기 문제에서 아닌 것 하나를 지운다 — 큰 고비마다 1 + 지혜 5마다 1, 5.5) */
  hint: {
    /** 귀띔이 남았을 때 문제 창 귀퉁이 */
    offer: '귀띔이 필요하면 나를 눌러. 아닌 것 하나를 지워 줄게.',
    /** 귀띔을 썼을 때 */
    used: '이건 아니야. 남은 것 가운데서 골라 봐.',
    /** 남은 귀띔이 없을 때 */
    none: '이번 겨루기의 귀띔은 다 썼어.',
  },
  /** 기세가 찼을 때(합동 기술을 고를 수 있다). "함께 하기"는 겨루기 화면의 단추 이름(battle-hand.png) */
  momentum: '기세가 찼어! 함께 하기를 골라 봐.',
  /** 합동 기술 둘(8.1 — 숫자는 BALANCE.shadeHeal·shadeShield·liftPower) */
  joint: [
    {
      id: 'shade',
      name: '느티나무 그늘',
      text: '느티가 그늘을 드리워 기운을 채우고, 방패 한 칸을 걷어 내요.',
      say: { who: N, text: '내 그늘에서 숨 좀 돌려!' },
    },
    {
      id: 'lift',
      name: '함께 들기',
      text: '이웃들이 달려와 다 함께 힘을 모아요. 문제 없이 큰 힘이 나가요.',
      say: { text: '이웃들이 “영차!” 하고 힘을 보탰다.' },
    },
  ] as JointSkill[],
  /** 결과 종이의 별 셋(5.3) — got: 받은 까닭 한 줄, missed: 받지 못했을 때 받는 길, rescued: 구해 줌·16차례로 넘겼을 때 별 ① 아래 한 줄 */
  stars: {
    got: ['큰 고비를 넘겼어요', '구해 줌 없이 기운을 절반 넘게 남겼어요', '문제를 셋에 둘 이상 맞히고 센 카드를 썼어요'] as [string, string, string],
    missed: ['큰 고비를 넘기면 받아요', '구해 줌 없이 기운을 절반 넘게 남기면 받아요', '문제를 셋에 둘 이상 맞히고 센 카드를 쓰면 받아요'] as [string, string, string],
    rescued: '이웃이 함께해 준 것도 고비를 넘긴 거예요',
  },
  /** 결과 종이 — 정령의 물음(에피소드의 ask) 앞의 한 창. 물음은 정답이 하나가 아니다 */
  askLead: { who: N, text: '오늘의 물음이야. 답은 하나가 아니야.' } as Line,
  /** 결과 종이 — 정령의 물음을 넘기는 단추(글을 쓰지 않는다) */
  thought: '생각해 봤어요',
  /** 자람 — 레벨이 올라 능력치 점 하나를 둘 때(11.1 가 15) */
  levelUp: { who: N, text: '자랐어! 능력치 점 하나를 어디에 둘까?' } as Line,
  /** 자람 — 갈래마다 하는 일 한 줄(5.5) */
  statLines: {
    power: '힘 — 몸 쓰는 카드가 세지고 기운이 늘어요',
    wisdom: '지혜 — 글·셈 카드가 세지고 귀띔이 늘어요',
    craft: '솜씨 — 일 카드가 세져요',
    heart: '어울림 — 함께하는 카드가 세지고 기세가 빨리 차요',
  } as Record<CardKind, string>,
  /** 레벨 상한(4-1은 5)에 걸려 경험치를 쌓아 둘 때(5.6의 4번) */
  capped: '다음 이야기가 열리면 더 자랄 수 있어요',
  /** 출전 준비 — 첫 판의 카드는 정해 준 여섯(바꿀 수 없다)의 까닭 한 줄(11.1 가 6) */
  starterWhy: '첫 판은 겨루기를 익히려고 정해 준 여섯 장으로 해요',
};

/** 알림 한 줄(화면의 글). 대본: script-hub.md 1·9절 */
export const notices = {
  /** 닫힌 시설, 연표의 잠긴 구슬(①-2~①-6) */
  soon: '곧 열려요',
  /** 처음 시작할 때 한 번(13.2의 11·23번) */
  trial: '시험 판이라 기록이 지워질 수 있어요',
  /** 옛 저장(꼴 2~4)을 찾았을 때 한 번(5.8 — 옛 글자는 joseon-year/backup에 한 벌) */
  oldSave: '게임이 새로워져서 처음부터 해요',
  /** 현장에서 "큰 고비로"를 눌렀는데 해 ☀가 남았을 때 한 번(11.1 가 12) */
  sunsLeft: '해가 남았어요. 지금 갈까요?',
  /** 연표의 ②~⑦ */
  storySoon: '준비 중',
  /** 연표의 조선 밖 구간 */
  outside: '서당 문제가 곧 들어와요',
  /** 서당의 닫힌 주제(2-1·2-2 밖의 스물넷) */
  topicSoon: '곧 들어와요',
};

/** 서당(9.1, 5.6의 3번). 훈장님은 꾸민 사람이다. 대본: script-hub.md 8절 */
export const seodangTalk = {
  /** 20문제를 시작할 때 */
  start: { who: 'teacher', text: '스무 문제다. 서두르지 말고 하나씩 풀어 보아라.' } as Line,
  /** 끝 종이 */
  end: { who: 'teacher', text: '끝까지 잘 풀었구나. 다시 볼 문제도 챙겨 두어라.' } as Line,
  /** 한 주제를 한 바퀴 다 풀었을 때(서당 칭호) */
  lap: '한 바퀴 다 풀었어요',
  /** 같은 날 같은 주제의 셋째 판부터(경험치 0 — 풀 수는 있다) */
  enough: '오늘은 이 주제를 충분히 익혔어요. 다른 주제도 해 볼까요?',
  /** 끝 종이의 단추 */
  reviewOnly: '다시 볼 문제만 풀기',
};

/** 도구점·포목점(6.3, 6.5). 대본: script-hub.md 6절 */
export const shopTalk = {
  /** 돈 주머니가 모자랄 때(값 치르기 놀이 없이) */
  short: '쌀·베가 모자라요',
  /** 값 치르기 놀이의 "어른께 맡긴다" 자리(알맞게 치른다) */
  delegate: '할아버지께 셈을 맡긴다',
  /** 연장을 산 뒤 */
  bought: { who: 'tool-grandpa', text: '좋은 연장을 골랐구나. 손에 익을 때까지 잘 써 보거라.' } as Line,
  /** 꾸미기를 산 뒤 */
  dressed: { who: 'cloth-auntie', text: '잘 어울리는구나. 거울 앞에서 한번 돌아보렴.' } as Line,
};
