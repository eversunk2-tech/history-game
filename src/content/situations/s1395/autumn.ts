// ① 1395년 가을 — 농민 집 아이의 일(Happening) 여덟.
//   꼭 푸는 미션 「한양으로 떠난 장정들」: 느티나무 아래에서 보내고(고른다) → 구월 보름, 집에서 아버지를 맞는다(일 둘)
//   꼭 푸는 미션 「가을걷이와 나라 몫」: 타작 마당의 가을걷이(일 놀이) → 고갯마루의 소금(고르고, 일 놀이) + 도움의 일(이웃이 소금을 나눠 준다)
//   덤으로 하는 일 셋: 한양 가는 길목(배웅) · 고을 가는 큰길(관아에서 온 소식) · 느티나무 그늘(덤 미션 「새 나라 이야기 모으기」의 가을 몫)
// 대본과 출처 대조는 docs/script-1395.md의 13절부터.
// 일의 차례가 해와 달을 따른다: 장정들이 떠난다(팔월 십이일) → 돌아온다(구월 보름) → 가을걷이 → 소금.
// 그래서 가을걷이는 아버지가 돌아온 뒤(leave.back)에, 소금은 가을걷이 뒤(harvest.done)에 나타난다.
// 모습에 따라 달라지는 것은 「한양으로 떠난 장정들」의 이야기 줄 하나뿐이다("내년이면 나도 열여섯이다" — 남자아이).
// 느티골에서 누가 갔는지는 꾸민 것이다(실록은 도별 사람 수만 적는다). 소금을 누가 어떻게 팔았는지는 확인하지 못해 "윗마을 사람"으로만 썼다.

import type { Happening, Line, Outcome } from '../../../engine/types';
import { FLAGS } from './spring';

const S = 's1395';
const FARMER = ['farmer'];

/** 가을의 표시(flag). autumn.tended는 index.ts의 나중 결과(가을을 닫을 때 기력 +1)가 읽는다. */
export const AUTUMN = {
  leaveTend: 'leave.tend',
  leaveOurs: 'leave.ours',
  tended: 'autumn.tended',
  leaveBack: 'leave.back',
  harvestDone: 'harvest.done',
  /** 일 놀이 「가을걷이와 나라 몫」이 끝난 모습 */
  harvestAll: 'harvest.all',
  harvestSome: 'harvest.some',
  harvestLeft: 'harvest.left',
  saltDone: 'salt.done',
  /** 일 놀이 「쌀과 베로 값 치르기」가 끝난 모습 */
  payExact: 'pay.exact',
  payGenerous: 'pay.generous',
  payLeft: 'pay.left',
  /** 덤 미션 「새 나라 이야기 모으기」의 가을 몫 */
  taleAutumn: 'tale.autumn',
} as const;

// ── 한양으로 떠난 장정들: 첫 일의 여는 대화 ───────────────────────
const LEAVE_FIRST: Line = { text: '팔월, 느티나무 아래에 장정들이 모였다. 아버지도 그 가운데 계신다.' };
const LEAVE_FATHER: Line = { who: 'father', text: '궁궐 일로 또 불려 간다. 벼 벨 때까지는 돌아와야 할 텐데.' };
const LEAVE_NEIGHBOR: Line = { who: 'neighbor-elder', text: '지난겨울에 이어 또 가는구나. 익어 가는 벼를 두고 가려니 발이 안 떨어진다.' };
const LEAVE_NEIGHBOR_RAIN: Line = { who: 'neighbor-elder', text: '지난겨울에 이어 또 가는구나. 큰비에 쓰러진 벼를 두고 가려니 발이 안 떨어진다.' };
/** 남자아이 모습에만 붙는 이야기 줄(군역 나이 F02에서 미룬 것이라 "~라고 한다") */
const LEAVE_SIXTEEN: Line = { text: '장정은 열여섯부터라고 한다. 내년이면 나도 열여섯이다.' };
const LEAVE_ASK: Line = { text: '남은 사람끼리 논을 어떻게 지킬까?' };

const TEND_SECOND: Line = { text: '우리 논과 이웃 논을 오가며 새를 쫓고 논물을 살폈다. 다리가 퉁퉁 붓는다.' };
const BACK_SECOND: Line = { text: '아버지 손이 더 거칠어졌다. 그래도 벼 벨 때에 맞춰 오셔서 다행이다.' };

// ── 가을걷이와 나라 몫: 첫 일(타작 마당) ─────────────────────────
const HARVEST_FATHER: Line = { who: 'father', text: '거둔 것에서 열에 하나쯤은 나라 몫이다. 그것부터 덜어 놓아야 한다.' };
const HARVEST_FATHER_RAIN: Line = { who: 'father', text: '큰물이 난 고을이라고 나라에서 올해 몫은 받지 않는단다. 그나마 다행이다.' };
const HARVEST_ASK: Line = { text: '올해 거둘 벼는 얼마나 될까? 손수 베어 보자.' };
const HARVEST_ASK_RAIN: Line = { text: '낟알 하나까지 손수 거두어 보자.' };

const HARVEST_CARD = ['s1395-state-share'];
/** 놀이가 끝난 모습마다의 아버지의 말(결과 대화의 첫 창). 큰비가 온 해의 "이삭을 남김"은 따로(어머니가 "이삭 하나도 흘리지 말아요"라고 했다). */
const HARVEST_PLAY: Record<'all' | 'some' | 'left', Line> = {
  all: { who: 'father', pose: 'glad', text: '이삭 하나 남기지 않고 다 거뒀구나.' },
  some: { who: 'father', text: '이삭이 좀 남았구나. 괜찮다, 새들도 먹고살아야지.' },
  left: { who: 'father', text: '그래, 낫은 내가 잡으마. 하려던 일은 미루고. 너는 볏단을 날라라.' },
};
const HARVEST_SOME_RAIN: Line = { who: 'father', text: '이삭이 좀 남았구나. 남은 것은 내가 마저 주우마.' };
const SHARE_USUAL: Line = { text: '열 자루에서 한 자루를 나라 몫으로 덜어 놓았다. 남은 자루를 세어 본다.' };
const SHARE_RAIN: Line = { text: '올해는 덜어 낼 나라 몫이 없다. 그래도 자루는 몇 개 되지 않는다.' };
const NOTE_RAIN = '큰물이 난 고을에는 나라가 그해에 낼 곡식을 받지 않기도 했어요.';

/**
 * 가을걷이의 결과 하나: 첫 창은 놀이가 끝난 모습(아버지), 둘째 창은 그해의 나라 몫.
 * 바탕은 "이삭을 남김"(하다 만 것)이다: 기력 -1, 살림 +2(큰비가 온 해에는 거둔 것이 적어 +1 — F55. 놀이의 자루는 여섯·넷).
 * 다 거두면 살림이 하나 더. 어른께 맡기면 "이삭을 남김"과 수치가 같다 — 맡기는 것이 하다 만 것보다 나은 일이 없고,
 * 끝난 모습 셋의 차이는 수치마다 1 안이다(spec 5.2의 5번 "±1", 바퀴 1-라 고치기 — review 10번).
 * 맡기면 아버지가 "하려던 일은 미루고" 낫을 잡는다 — 값은 이야기로만 치른다.
 */
function harvested(play: 'all' | 'some' | 'left', rain: boolean): Outcome {
  const base = rain ? 1 : 2;
  const living = play === 'all' ? base + 1 : base;
  const effects = { body: -1, living };
  return {
    effects,
    setFlags: [AUTUMN.harvestDone],
    cards: HARVEST_CARD,
    lines: [rain && play === 'some' ? HARVEST_SOME_RAIN : HARVEST_PLAY[play], rain ? SHARE_RAIN : SHARE_USUAL],
    ...(rain ? { note: NOTE_RAIN } : {}),
  };
}

// ── 가을걷이와 나라 몫: 둘째 일(고갯마루의 소금) ──────────────────
const SALT_GAINS = { cards: ['s1395-rice-cloth'], items: ['s1395-salt'], setFlags: [AUTUMN.saltDone] };
const PAY_PLAY: Record<'exact' | 'generous' | 'left', Line> = {
  exact: { who: 'pass-villager', pose: 'glad', text: '알맞게 가져왔구나. 자, 소금 받아라.' },
  generous: { who: 'pass-villager', pose: 'glad', text: '이리 넉넉히 얹어 주다니. 다음에도 너희 마을부터 들르마.' },
  left: { who: 'mother', text: '셈은 내가 하마. 쌀과 베를 받을 만큼 맞춰 건네면 된단다.' },
};
const SALT_OURS: Line = { text: '소금 자루를 메고 고개를 내려온다. 올겨울 먹을 소금은 마련했다.' };
const SALT_SHARE: Line = { text: '소금 자루가 묵직하다. 이웃집에도 나눠 줄 생각에 걸음이 가볍다.' };

/** 소금을 바꾼 결과 하나. 넉넉히 얹어 주면 살림이 하나 더 나가고 인심이 하나 는다(놀이의 차이는 ±1). */
function salted(play: 'exact' | 'generous' | 'left', share: boolean): Outcome {
  const extra = play === 'generous' ? 1 : 0;
  const living = (share ? -2 : -1) - extra;
  const trust = (share ? 1 : 0) + extra;
  return {
    effects: trust > 0 ? { living, trust } : { living },
    ...SALT_GAINS,
    lines: [PAY_PLAY[play], share ? SALT_SHARE : SALT_OURS],
  };
}

const SALT_HELP_OPEN: Line[] = [
  { text: '소금과 바꿀 쌀도 베도 모자란다. 우물가에서 이웃 아주머니가 나를 부르신다.' },
  { who: 'well-neighbor', text: '너희 집 형편을 들었다. 우리가 바꿔 온 소금을 조금 덜어 주마.' },
  { text: '빈손으로 받을 수는 없는데, 무엇으로 갚을까?' },
];
const SALT_HELP_REPAID: Line = { who: 'well-neighbor', pose: 'glad', text: '네가 우리 논을 돌봐 준 걸 잊지 않았단다. 갚을 생각은 말아라.' };
const SALT_HELP_GAINS = { cards: ['s1395-rice-cloth'], items: ['s1395-salt'], setFlags: [AUTUMN.saltDone] };

export const happenings: Happening[] = [
  // ── 꼭 푸는 미션 「한양으로 떠난 장정들」 ─────────────────────────
  {
    // 첫 일: 보내고, 남은 사람끼리 논을 어떻게 지킬지 고른다. 바탕은 여자아이 모습·평소 같은 해.
    id: 's1395-autumn-leave',
    situation: S,
    season: 'autumn',
    roles: FARMER,
    theme: 'duty',
    spot: 'tree',
    cost: 0,
    stage: {
      place: 'entrance',
      cast: [
        { who: 'father', at: 'left' },
        { who: 'neighbor-elder', at: 'right' },
      ],
    },
    lines: [LEAVE_FIRST, LEAVE_FATHER, LEAVE_NEIGHBOR, LEAVE_ASK],
    lineVariants: [
      { when: { look: 'boy', draw: 'drought' }, lines: [LEAVE_FIRST, LEAVE_FATHER, LEAVE_NEIGHBOR_RAIN, LEAVE_SIXTEEN, LEAVE_ASK] },
      { when: { draw: 'drought' }, lines: [LEAVE_FIRST, LEAVE_FATHER, LEAVE_NEIGHBOR_RAIN, LEAVE_ASK] },
      { when: { look: 'boy' }, lines: [LEAVE_FIRST, LEAVE_FATHER, LEAVE_NEIGHBOR, LEAVE_SIXTEEN, LEAVE_ASK] },
    ],
    choices: [
      {
        // 기력을 크게 내고 인심을 얻는다. 가을을 닫을 때 돌아온 이웃이 우리 집 가을걷이를 거든다(기력 +1 — index.ts의 later).
        id: 'tend',
        label: '떠난 집 논까지 함께 돌본다',
        lock: { unless: { min: { body: 3 } }, reason: '두 집 논을 오갈 기운이 남아 있지 않아요' },
        effects: { body: -2, trust: 1 },
        setFlags: [AUTUMN.leaveTend, AUTUMN.tended],
        lines: [{ who: 'neighbor-elder', pose: 'glad', text: '우리 논까지 봐 주겠다니, 마음 놓고 다녀오마.' }, TEND_SECOND],
        variants: [
          {
            // 봄에 이 집의 논갈이를 거들었으면
            when: { flags: [FLAGS.help] },
            effects: { body: -2, trust: 1 },
            setFlags: [AUTUMN.leaveTend, AUTUMN.tended],
            lines: [{ who: 'neighbor-elder', pose: 'glad', text: '봄에도 네 덕을 봤는데 또 도움을 받는구나. 마음 놓고 다녀오마.' }, TEND_SECOND],
          },
        ],
      },
      {
        // 우리 것만 본다: 살림을 얻고 인심을 잃는다. 누구도 나를 꾸짖지 않는다.
        id: 'ours',
        label: '우리 집 논부터 지킨다',
        effects: { living: 1, trust: -1 },
        setFlags: [AUTUMN.leaveOurs],
        lines: [
          { who: 'father', text: '그래, 우리 논부터 잘 지켜 다오. 다녀오마.' },
          { text: '우리 논의 새는 다 쫓았다. 이웃 논에는 참새 떼가 새까맣게 앉아 있다.' },
        ],
      },
    ],
    note: '나라는 가을걷이를 앞둔 팔월에도 농민들을 궁궐 공사에 불렀어요.',
    facts: ['F35', 'F02'],
  },
  {
    // 둘째 일: 구월 보름, 돌아온 아버지에게 궁궐과 종묘 이야기를 듣는다. 역사 낱말은 "종묘" 하나(카드가 풀이한다).
    id: 's1395-autumn-back',
    situation: S,
    season: 'autumn',
    roles: FARMER,
    theme: 'duty',
    spot: 'home',
    shows: { anyOf: [{ flags: [AUTUMN.leaveTend] }, { flags: [AUTUMN.leaveOurs] }] },
    cost: 0,
    stage: {
      place: 'yard',
      cast: [
        { who: 'father', at: 'left' },
        { who: 'grandma', at: 'right' },
      ],
    },
    lines: [
      { text: '구월 보름이 지나 아버지가 돌아오셨다! 가을걷이를 하라고 나라에서 돌려보냈다고 한다.' },
      { who: 'grandma', pose: 'glad', text: '아이고, 무사히 왔구나. 어서 들어와 쉬어라.' },
      { who: 'father', text: '어머니, 새 궁궐이 거의 다 되었습니다. 종묘도 함께 지었고, 남은 일은 스님들이 맡았지요.' },
    ],
    after: {
      // 바탕: 우리 집 논부터 지켰을 때
      setFlags: [AUTUMN.leaveBack],
      cards: ['s1395-jongmyo'],
      lines: [{ who: 'father', pose: 'glad', text: '우리 논은 네가 잘 지켰구나. 벼가 잘 여물었다.' }, BACK_SECOND],
      variants: [
        {
          when: { flags: [AUTUMN.leaveTend] },
          setFlags: [AUTUMN.leaveBack],
          cards: ['s1395-jongmyo'],
          lines: [{ who: 'father', pose: 'glad', text: '네가 이웃 논까지 돌봤다지. 같이 돌아온 사람들이 고마워하더라.' }, BACK_SECOND],
        },
        {
          // 큰비가 온 해: 봄에 낮은 논에 몰아 뿌렸으면 그 논은 여름에 쓸려 갔다(바로 다음 가을걷이의 첫 줄과 맞춘다)
          when: { draw: 'drought', flags: [FLAGS.sowLow] },
          setFlags: [AUTUMN.leaveBack],
          cards: ['s1395-jongmyo'],
          lines: [{ who: 'father', text: '낮은 논은 큰물에 쓸렸다지. 그래도 남은 벼를 네가 잘 지켰구나.' }, BACK_SECOND],
        },
        {
          when: { draw: 'drought' },
          setFlags: [AUTUMN.leaveBack],
          cards: ['s1395-jongmyo'],
          lines: [{ who: 'father', text: '큰비에도 높은 논의 벼는 남았구나. 네가 잘 지켰다.' }, BACK_SECOND],
        },
      ],
    },
    // spec 6.3의 기준 문장
    note: '구월 보름(15일), 나라는 가을걷이를 하라고 농민들을 집으로 돌려보냈어요.',
    facts: ['F35', 'F34', 'F36'],
  },

  // ── 꼭 푸는 미션 「가을걷이와 나라 몫」 ───────────────────────────
  {
    // 첫 일: 선택지가 없다. 여는 대화는 벼를 베기 앞에서 시작한다(놀이가 ① 벼 베기 ② 나라 몫 덜기 차례다).
    // 일 놀이의 끝난 모습과 그해의 날씨, 봄의 논에 따라 결과가 갈린다. 바탕 결과는 "이삭을 남김"·평소 같은 해.
    id: 's1395-autumn-harvest',
    situation: S,
    season: 'autumn',
    roles: FARMER,
    theme: 'paying',
    spot: 'threshing',
    shows: { flags: [AUTUMN.leaveBack] },
    cost: 0,
    stage: {
      place: 'threshing',
      cast: [
        { who: 'father', at: 'left' },
        { who: 'mother', at: 'right' },
      ],
    },
    // 평소 같은 해·비가 알맞게 온 해에는 어머니가 말하지 않는다(가을이 길어 한 창을 덜었다 — review 21번). 큰비가 온 해에는 어머니의 걱정이 앞선다.
    lines: [{ text: '논의 벼가 누렇게 익었다. 오늘 벼를 베어, 벼를 떠는 타작 마당으로 나른다.' }, HARVEST_FATHER, HARVEST_ASK],
    lineVariants: [
      {
        // 큰비가 온 해 + 봄에 낮은 논에 몰아 뿌림
        when: { draw: 'drought', flags: [FLAGS.sowLow] },
        lines: [
          { text: '벨 벼가 지난해의 반도 안 된다. 낮은 논의 벼가 큰비에 쓸려 갔다.' },
          HARVEST_FATHER_RAIN,
          { who: 'mother', pose: 'worried', text: '벨 것이 적어도 겨울은 나야지요. 이삭 하나도 흘리지 말아요.' },
          HARVEST_ASK_RAIN,
        ],
      },
      {
        // 큰비가 온 해 + 봄에 높은 논에도 나눠 뿌림
        when: { draw: 'drought' },
        lines: [
          { text: '큰비에도 높은 논의 벼는 남았다. 오늘 그 벼를 베어, 벼를 떠는 타작 마당으로 나른다.' },
          HARVEST_FATHER_RAIN,
          { who: 'mother', text: '나눠 뿌리길 잘했어요. 남은 벼로 겨울을 나야지요.' },
          HARVEST_ASK_RAIN,
        ],
      },
      {
        when: { draw: 'bumper' },
        lines: [{ text: '비가 알맞게 와서 낟알이 굵다. 오늘 벼를 베어, 벼를 떠는 타작 마당으로 나른다.' }, HARVEST_FATHER, HARVEST_ASK],
      },
    ],
    after: {
      ...harvested('some', false),
      variants: [
        { when: { draw: 'drought', flags: [AUTUMN.harvestAll] }, ...harvested('all', true) },
        { when: { draw: 'drought', flags: [AUTUMN.harvestLeft] }, ...harvested('left', true) },
        { when: { draw: 'drought' }, ...harvested('some', true) },
        { when: { flags: [AUTUMN.harvestAll] }, ...harvested('all', false) },
        { when: { flags: [AUTUMN.harvestLeft] }, ...harvested('left', false) },
      ],
    },
    play: { game: 'harvest', rules: '1395', flags: { all: AUTUMN.harvestAll, some: AUTUMN.harvestSome, left: AUTUMN.harvestLeft } },
    note: '농민은 거둔 곡식의 열에 하나쯤을 나라 몫으로 냈어요.',
    facts: ['F58', 'F55'],
  },
  {
    // 둘째 일: 고르고 → 일 놀이(값 치르기) → 결과. 두 선택지가 모두 잠기면(살림 1 이하) 도움의 일이 열린다.
    id: 's1395-autumn-salt',
    situation: S,
    season: 'autumn',
    roles: FARMER,
    theme: 'paying',
    spot: 'passTop',
    shows: { flags: [AUTUMN.harvestDone] },
    cost: 0,
    stage: {
      place: 'pass',
      cast: [
        { who: 'mother', at: 'left' },
        { who: 'pass-villager', at: 'right' },
      ],
    },
    lines: [
      { text: '어머니와 쌀 자루, 베를 지고 고갯마루에 올랐다. 윗마을 사람이 소금 짐을 지고 기다린다.' },
      { who: 'pass-villager', text: '소금 한 자루에 쌀로는 얼마, 베로는 얼마. 서로 받을 만큼 맞춰야 바꾸지.' },
      { who: 'mother', text: '돈이 없으니 물건과 물건을 맞바꾸는 거란다. 얼마나 바꿔 갈까?' },
    ],
    choices: [
      {
        id: 'ours',
        label: '우리 집 쓸 만큼만 바꾼다',
        lock: { unless: { min: { living: 2 } }, reason: '소금과 바꿀 쌀과 베가 모자라요' },
        ...salted('exact', false),
        variants: [
          { when: { flags: [AUTUMN.payGenerous] }, ...salted('generous', false) },
          { when: { flags: [AUTUMN.payLeft] }, ...salted('left', false) },
        ],
      },
      {
        id: 'share',
        label: '이웃 몫까지 넉넉히 바꾼다',
        lock: { unless: { min: { living: 4 } }, reason: '넉넉히 바꿀 만큼은 쌀과 베가 없어요' },
        ...salted('exact', true),
        variants: [
          { when: { flags: [AUTUMN.payGenerous] }, ...salted('generous', true) },
          { when: { flags: [AUTUMN.payLeft] }, ...salted('left', true) },
        ],
      },
    ],
    play: { game: 'pay', rules: '1395', flags: { exact: AUTUMN.payExact, generous: AUTUMN.payGenerous, left: AUTUMN.payLeft } },
    note: '돈이 널리 쓰이지 않아, 물건을 살 때 쌀과 베를 상대가 받을 만큼 맞춰 건넸어요.',
    facts: ['F08'],
  },
  {
    // 도움의 일: 고갯마루의 두 선택지가 모두 잠겼을 때만 나타난다. 이웃이 소금을 나눠 준다 — 대신 그 집 일을 거들어 갚는다(기력).
    // 봄에 논갈이를 거들었거나 가을에 떠난 집 논을 돌봤으면 갚을 것이 없다(앞서 낸 일손이 돌아온다).
    id: 's1395-autumn-salt-help',
    situation: S,
    season: 'autumn',
    roles: FARMER,
    theme: 'paying',
    spot: 'well',
    cost: 0,
    stage: { place: 'well', cast: [{ who: 'well-neighbor', at: 'center' }] },
    lines: SALT_HELP_OPEN,
    after: {
      effects: { body: -1 },
      ...SALT_HELP_GAINS,
      lines: [
        { text: '아주머니네 볏단을 날라 드렸다. 소금 한 줌이 이렇게 귀한 줄 몰랐다.' },
        { who: 'well-neighbor', pose: 'glad', text: '어려울 때는 서로 기대는 거란다. 내년에는 네가 나눠 주렴.' },
      ],
      variants: [
        {
          when: { flags: [FLAGS.help] },
          ...SALT_HELP_GAINS,
          lines: [SALT_HELP_REPAID, { text: '덜어 준 소금을 두 손으로 받았다. 봄에 낸 일손이 이렇게 돌아왔다.' }],
        },
        {
          when: { flags: [AUTUMN.leaveTend] },
          ...SALT_HELP_GAINS,
          lines: [SALT_HELP_REPAID, { text: '덜어 준 소금을 두 손으로 받았다. 가을에 낸 일손이 이렇게 돌아왔다.' }],
        },
      ],
    },
    note: '쌀도 베도 모자라면 물건을 바꿀 수 없었어요. 쌀과 베가 곧 값이었으니까요.',
    facts: ['F08'],
  },

  // ── 덤으로 하는 일(해 ☀ 하나씩) ──────────────────────────────────
  {
    // 장정들이 떠난 뒤부터 아버지가 돌아오기 전까지만 나타난다. 듣기만 하는 일(카드를 얻는다).
    id: 's1395-autumn-sendoff',
    situation: S,
    season: 'autumn',
    roles: FARMER,
    theme: 'duty',
    spot: 'northRoad',
    shows: { anyOf: [{ flags: [AUTUMN.leaveTend] }, { flags: [AUTUMN.leaveOurs] }], notFlags: [AUTUMN.leaveBack] },
    cost: 1,
    lure: '길목까지 배웅하는 사람이 많다더라',
    stage: { place: 'road', cast: [{ who: 'mother', at: 'center' }] },
    lines: [
      { text: '한양 가는 길목까지 따라 나왔다. 장정들의 줄이 북쪽으로 멀어진다.' },
      { who: 'mother', pose: 'worried', text: '만 오천 명이 간다는구나. 여기부터는 어른 남자들만 가는 길이란다.' },
    ],
    after: {
      cards: ['s1395-fifteen-thousand'],
      lines: [
        { text: '아버지의 뒷모습이 보이지 않을 때까지 손을 흔들었다.' },
        { text: '함께 배웅하던 이웃들과 눈이 마주쳤다. 남은 사람끼리 잘 지내야겠다.' },
      ],
    },
    note: '궁궐 공사에 불려 간 사람은 ‘장정’이라 부르던 어른 남자들이었어요.',
    facts: ['F35'],
  },
  {
    // 품을 들여 길을 안내하면 인심을 얻고, 말씀만 드리면 수치는 그대로다. 카드와 쪽지는 어느 쪽이든 같다.
    id: 's1395-autumn-office',
    situation: S,
    season: 'autumn',
    roles: FARMER,
    theme: 'duty',
    spot: 'westRoad',
    cost: 1,
    lure: '큰길에 관아 사람이 와 있다더라',
    stage: { place: 'road', cast: [{ who: 'official', at: 'center' }] },
    lines: [
      { text: '고을로 가는 큰길에서 관아 사람이 마을 어른들을 불러 세웠다.' },
      { who: 'official', text: '나라에서 효자와 착한 손자를 찾아 알리라 하셨다.' },
      { who: 'official', text: '일흔 살 넘은 어른께는 신분을 가리지 않고 쌀을 내리셨다. 느티골에는 누가 계시냐?' },
    ],
    choices: [
      {
        id: 'guide',
        label: '어르신 댁까지 길을 안내해 드린다',
        effects: { body: -1, trust: 1 },
        cards: ['s1395-elder-rice'],
        lines: [
          { text: '관아 사람을 모시고 마을 할머니 댁까지 걸었다. 쌀 자루가 마루에 놓였다.' },
          { who: 'official', pose: 'glad', text: '덕분에 헛걸음을 안 했구나. 고맙다.' },
        ],
      },
      {
        id: 'tell',
        label: '아는 대로 말씀만 드린다',
        cards: ['s1395-elder-rice'],
        lines: [
          { text: '마을 할머니 댁을 일러 드렸다. 할머니가 쌀을 받으시면 좋겠다.' },
          { who: 'official', text: '알았다. 내가 찾아가 보마.' },
        ],
      },
    ],
    note: '나라는 효자와 착한 손자를 찾아 알리게 했어요. 효도를 널리 권하려던 것이에요.',
    facts: ['F56'],
  },
  {
    // 덤 미션 「새 나라 이야기 모으기」의 가을 몫. 아버지가 돌아온 뒤에 나타난다. 역사 낱말은 "사직단" 하나(쪽지가 풀이한다).
    id: 's1395-autumn-tale',
    situation: S,
    season: 'autumn',
    roles: FARMER,
    theme: 'play',
    spot: 'treeShade',
    shows: { flags: [AUTUMN.leaveBack] },
    cost: 1,
    lure: '돌아온 이웃이 한양 이야기를 한다더라',
    stage: { place: 'entrance', cast: [{ who: 'neighbor-elder', at: 'center' }] },
    lines: [
      { who: 'neighbor-elder', text: '한양 이야기를 마저 해 주마. 궁궐 서쪽에 사직단이 있더구나.' },
      { who: 'neighbor-elder', text: '땅의 신과 곡식의 신께 농사가 잘되기를 비는 곳이지. 새 도읍이 하나씩 갖춰져 간다.' },
    ],
    after: {
      effects: { body: 1 },
      setFlags: [AUTUMN.taleAutumn],
      lines: [{ text: '느티나무 그늘에서 듣는 한양 이야기에 고단함이 풀린다.' }, { text: '새 나라 이야기를 또 하나 들었다. 겨울에도 들으러 와야지.' }],
    },
    note: '새 도읍에는 땅과 곡식의 신에게 제사 지내는 사직단도 세웠어요.',
    facts: ['F36', 'F34'],
  },
];
