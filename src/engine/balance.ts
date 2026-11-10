// 4판 숫자의 첫 어림(spec 11.1 다 "숫자의 첫 어림", 5.5·5.6·8.1). 모두 초안이다 — 첫 조각에서 아이들이 해 본 뒤 ㉤이 이 한 곳에서 맞춘다.
// 겨루기·성장·서당·돈의 엔진(battle·growth·quiz·economy·episode)이 이 표만 읽는다. 엔진 안에 숫자를 박지 않는다.
// spec에 숫자가 없어 여기서 정한 것은 "(정함)"이라고 적었다(합동 기술·덧효과의 크기 등 — 보고에 적는다).

export const BALANCE = {
  // ── 레벨과 경험치(5.5) ──
  /** 레벨 L에서 L+1로 가는 데 드는 경험치 = levelBase + levelStep × L(1→2는 115, 29→30은 535) */
  levelBase: 100,
  levelStep: 15,
  levelMax: 30,
  /** 4-1(첫 조각)의 레벨 상한(5.6의 4번). 4-3부터는 열린 이야기 가운데 가장 뒤 이야기의 권장 레벨 끝 + capOver */
  levelCap41: 5,
  capOver: 2,
  /** 이야기마다 권장 레벨(처음 할 때의 어림 — 5.5): [처음, 끝] */
  storyLevels: { s1395: [1, 7], s1446: [8, 12], s1592: [13, 16], s1636: [17, 20], s1795: [20, 23], s1863: [24, 25], s1899: [26, 29] } as Record<string, [number, number]>,
  /** 이야기가 뒤로 갈수록 곱한다(5.5) */
  storyXpMul: { s1395: 1, s1446: 1.2, s1592: 1.3, s1636: 1.4, s1795: 1.45, s1863: 1.5, s1899: 1.55 } as Record<string, number>,

  // ── 능력치(5.5) ──
  statStart: 3,
  statMax: 15,
  /** 레벨이 오를 때마다 능력치 점 하나 */
  pointsPerLevel: 1,

  // ── 기운(5.5): 20 + 힘 × 3 + 레벨 × 2 − (5 − 기력)⁺ × 3 ──
  hpBase: 20,
  hpPerPower: 3,
  hpPerLevel: 2,
  /** 그 이야기의 기력이 이보다 낮으면 그 차이 × hpTiredPer만큼 덜 찬 채로 시작 */
  hpTiredBelow: 5,
  hpTiredPer: 3,
  /** (정함) 아무리 지쳐도 이만큼은 찬다 */
  hpFloor: 10,

  // ── 겨루기(8.1) ──
  hand: 4,
  /** 큰 고비: 16차례가 되면 함께 마무리 */
  turnLimit: 16,
  /** (정함) 작은 고비(짧은 겨루기 2~3차례): 3차례가 되면 함께 마무리 */
  turnLimitMinor: 3,
  /** 카드의 힘 = (기본 + 단계의 덧힘 + 그 갈래 능력치 + 장비) × 상성 × 맞힘 */
  stepBonus: [0, 2, 4] as readonly number[],
  strongMul: 1.5,
  normalMul: 1,
  weakMul: 0.5,
  rightMul: 2,
  /** 방패가 남아 있는 동안 카드의 힘은 반만 들어간다 */
  shieldMul: 0.5,
  /** 다음 단계가 열릴 때 세우는 방패(Foe.shield가 앞선다) */
  phaseShield: 3,
  /** 방패가 남아 있으면 이 차례마다 한 칸이 저절로 깎인다(고칠 것 2) */
  shieldFadeEvery: 3,
  /** 지혜 겨루기 문제 수 */
  wisdomCount: 3,
  /** 틀린 문제는 이 차례 뒤에 다시 나온다 */
  retryAfter: 2,
  /** 기세: 세 칸(어울림 heartMomentumAt 이상이면 두 칸)이 차면 합동 기술 */
  momentumFull: 3,
  momentumFullHeart: 2,
  heartMomentumAt: 8,
  /** 귀띔: 큰 고비마다 1 + 지혜 hintPerWisdom마다 1(고칠 것 6) */
  hintBoss: 1,
  hintPerWisdom: 5,
  /** (정함) 덧효과 'heal'이 채우는 기운 */
  bonusHeal: 4,
  /** (정함) 덧효과 'weaken': 고비의 다음 일의 깎는 기운에 곱한다 */
  weakenMul: 0.5,
  /** (정함) 고비의 'weaken-next': 내 다음 카드의 힘에 곱한다 */
  dullMul: 0.5,
  /** (정함) 고비의 'heal': 제 기운을 이만큼 채운다(그 단계의 끝을 넘지 않는다) */
  foeHeal: 4,
  /** (정함) 합동 기술 「느티나무 그늘」: 기운 회복과 방패 한 칸(깎기) */
  shadeHeal: 8,
  shadeShield: 1,
  /** (정함) 합동 기술 「함께 들기」: 문제 없이 큰 힘(방패가 있으면 반) */
  liftPower: 24,
  /** 구해 줌·해거름이면 그 이야기의 기력이 이만큼 준다(8.1) */
  rescueBody: 1,
  /** (정함) 카드의 힘은 반올림하고 적어도 이만큼은 나간다(틀려도 기본 힘은 늘 나간다 — 8.1) */
  powerMin: 1,
  /** (정함) 카드의 단계 끝(5.5 — 1~3) */
  stepMax: 3,
  /** (정함) 'weighted' 고비: 같은 할 일이 이만큼 잇달아 나오면 다음 차례에는 다른 일을 고른다(셋 잇달아 없음) */
  weightedRun: 2,
  /** (정함) 고비의 'steal-momentum': 내 기세를 이만큼 가져간다 */
  stealMomentum: 1,
  /** (정함) 고비의 'raise-shield': 방패를 이만큼 세운다(2단계부터, Foe.shield를 넘지 않는다) */
  foeRaiseShield: 1,
  /** (정함) 겨루기의 문제: 그 겨루기에서 맞힌 수가 [앞]에 닿으면 보통, [뒤]에 닿으면 어려움을 먼저(그 전에는 쉬움 — 8.5) */
  askLevelAt: [2, 4] as readonly number[],
  /** (정함) 귀띔으로 지운 뒤에도 고를 것이 이만큼은 남는다(둘 가운데 하나를 지우면 답이 드러난다) */
  hintKeep: 2,

  // ── 큰 고비의 기운(8.1의 어림 — 뒤 에피소드) ──
  bossHpBase: 80,
  bossHpPerLevel: 15,
  bossHitBase: 4,
  bossHitPerLevel: 0.8,
  peakMul: 1.4,

  // ── 별과 점수(5.3) ──
  /** 별 ②: 기운을 이 몫보다 많이 남기고 */
  starKeep: 0.5,
  /** 별 ③: 낸 문제의 이 몫 이상을 맞히고 상성이 맞는 카드를 한 번 이상 */
  starRight: 2 / 3,
  scorePerRight: 10,
  scorePerHp: 2,
  scorePerStar: 50,

  // ── 에피소드의 경험치(5.5 — ①의 처음 깸·별 셋 = 160) ──
  xpBoss: 80,
  xpMinor: 15,
  xpBook: 2,
  xpBookMax: 20,
  xpStar: 10,
  /** 다시 하기: 새로 받은 별의 몫(별 하나 = xpStar) + 그 밖에는 처음 깸의 이 몫, 같은 에피소드는 하루 replayPerDay판까지(5.6의 2번) */
  replayShare: 0.1,
  replayPerDay: 3,

  // ── 서당(5.5·5.6의 3번) ──
  quizCount: 20,
  /** 한 판의 쉬움·보통·어려움 */
  quizMix: [6, 10, 4] as readonly number[],
  xpRight: 4,
  xpRightHard: 6,
  /** 틀렸지만 풀이를 읽은 문제 */
  xpRead: 1,
  /** 끝까지 풀면 */
  xpFinish: 10,
  /** 다시 볼 문제(전에 틀린 것)를 처음 맞히면 */
  xpReview: 3,
  /** 같은 날 같은 주제: 둘째 판은 반, 셋째 판부터 0 */
  sameTopicShare: [1, 0.5, 0] as readonly number[],
  /** 하루 서당 경험치 */
  quizDayCap: 300,

  // ── 돈(5.5·6.5 — 꾸민 값) ──
  /** 쌀 한 되 = 5닢 꼴, 베 한 자 = 3닢 꼴 */
  riceCoin: 5,
  clothCoin: 3,
  /** ①의 에피소드 처음 깸: 쌀 6되 · 베 3자(39닢 꼴) */
  episodeRice: 6,
  episodeCloth: 3,
  /** 서당 한 판: 10닢 꼴(①이면 쌀 2되) */
  quizCoin: 10,
  /** 마을 소개의 첫 선물: 쌀 3되 · 베 2자 */
  giftRice: 3,
  giftCloth: 2,
  /** (정함) 일곱 이야기의 차례(7.1 — 연표의 차례). ①~④는 쌀·베, coinFrom(⑤)부터 엽전으로 받는다(6.5) */
  stories: ['s1395', 's1446', 's1592', 's1636', 's1795', 's1863', 's1899'] as readonly string[],
  coinFrom: 's1795',
} as const;

export type Balance = typeof BALANCE;
