// ① 1395년 봄 — 농민 집 아이의 일(Happening) 아홉.
//   꼭 푸는 미션 ①「돌아온 사람들, 떠나는 스님들」: 마을 어귀에서 듣고 고른다 → 고른 일을 그 자리에 가서 마친다(일 넷)
//   꼭 푸는 미션 ②「볍씨 뿌리기」: 우리 논에서 정하고 손수 뿌린다(일 하나, 일 놀이)
//   덤으로 하는 일 넷: 우물가 · 뒷산 절 · 느티나무 그늘(덤 미션 「새 나라 이야기 모으기」의 봄 몫) · 뒷산
//     넷 모두 가 보고 싶게 만드는 한마디(lure)가 있고, 우물가와 뒷산에는 둘 가운데 하나를 고르는 작은 선택이 있다(변화는 -1~+1).
// 대본과 출처 대조는 docs/script-1395.md에 있다.
// 인물의 말·마을·낮은 논과 높은 논은 꾸민 것이고, 제도·달·생활 방식만 근거(facts)를 따른다.
// 봄에는 고른 모습(남자아이·여자아이)에 따라 달라지는 것이 없다.
// 해 ☀는 덤에만 진다. 그래서 미션의 일에는 때를 못 박는 말(해가 기울 때까지, 저녁에)을 쓰지 않는다.

import type { Happening, Line } from '../../../engine/types';

const S = 's1395';
const FARMER = ['farmer'];

/** 표시(flag)의 이름. 다른 계절과 `index.ts`의 나중 결과가 읽는다. */
export const FLAGS = {
  /** 미션 ①에서 고른 길 */
  help: 'return.help',
  ours: 'return.ours',
  give: 'return.give',
  /** 미션 ①을 마쳤다(고른 일을 그 자리에서 끝냈다) */
  returnDone: 'return.done',
  /** 미션 ②에서 고른 논. 여름을 닫을 때 날씨와 만난다. */
  sowLow: 'sow.low',
  sowSplit: 'sow.split',
  /** 일 놀이 「볍씨 뿌리기」가 끝난 모습 */
  sowEven: 'sow.even',
  sowPatchy: 'sow.patchy',
  sowLeft: 'sow.left',
  /** 덤 미션 「새 나라 이야기 모으기」의 봄 몫 */
  taleSpring: 'tale.spring',
} as const;

const SOW_CARD = ['s1395-direct-sowing'];
const WELL_CARD = ['s1395-palace-work'];

// 볍씨 뿌리기의 결과 대화에서 함께 쓰는 아버지의 말(놀이가 끝난 모습마다 하나)
const FATHER_EVEN: Line = { who: 'father', pose: 'glad', text: '고루 잘 뿌렸구나. 덕분에 볍씨가 한 줌 남았다.' };
const FATHER_PATCHY: Line = { who: 'father', text: '뭉친 데도 있고 빈 데도 있구나. 괜찮다, 빈 데는 내가 덧뿌리마.' };
const FATHER_LEFT: Line = { who: 'father', text: '그래, 오늘은 내가 뿌리마. 손놀림을 잘 봐 두어라.' };

export const happenings: Happening[] = [
  // ── 꼭 푸는 미션 ① 돌아온 사람들, 떠나는 스님들 ─────────────────
  {
    // 첫 일: 듣고 고른다. 수치는 바뀌지 않는다(고른 일을 마칠 때 바뀐다).
    id: 's1395-spring-return',
    situation: S,
    season: 'spring',
    roles: FARMER,
    theme: 'duty',
    spot: 'tree',
    cost: 0,
    stage: {
      place: 'entrance',
      cast: [
        { who: 'neighbor-elder', at: 'left' },
        { who: 'monk', at: 'right' },
      ],
    },
    lines: [
      { text: '이월, 마을 어귀 느티나무 아래에 사람들이 모여 있다.' },
      { who: 'neighbor-elder', text: '궁궐 짓는 데 갔다가 돌아왔다. 농사철이라고 나라에서 돌려보내더구나.' },
      { who: 'neighbor-elder', text: '이제는 절의 스님들이 대신 일한단다. 뒷산 절 스님들도 내일 떠나신다지.' },
      { who: 'monk', text: '길이 멀구나. 그래도 입을 것과 먹을 것은 나라에서 준다고 한다.' },
      { text: '돌아온 집은 논갈이가 한참 밀려 있다. 어떻게 할까?' },
    ],
    choices: [
      {
        id: 'help',
        label: '돌아온 집의 밀린 논갈이를 거든다',
        setFlags: [FLAGS.help],
        goTo: 'neighborPaddy',
        lines: [
          { who: 'neighbor-elder', pose: 'glad', text: '거들어 주겠다고? 고맙구나. 우리 논에서 기다리마.' },
          { text: '쟁기질은 못 해도 흙덩이 깨는 일은 할 수 있다. 이웃집 논으로 가자.' },
        ],
      },
      {
        id: 'ours',
        label: '우리 집 봄 일부터 한다',
        setFlags: [FLAGS.ours],
        goTo: 'home',
        lines: [
          { who: 'neighbor-elder', text: '그래, 너희 집도 일이 밀렸겠지. 어서 가 보아라.' },
          { text: '어른의 눈길이 등에 남는다. 그래도 우리 집 일이 먼저다. 집으로 가자.' },
        ],
      },
      {
        id: 'give',
        label: '스님들께 길에서 드실 곡식을 보탠다',
        lock: { unless: { min: { living: 3 } }, reason: '보탤 곡식이 남아 있지 않아요' },
        setFlags: [FLAGS.give],
        goTo: 'templeRoad',
        lines: [
          { who: 'monk', pose: 'glad', text: '고마운 마음이구나. 절 아래 길에서 짐을 꾸리고 있으마.' },
          { text: '집에 들러 곡식 자루를 챙겼다. 절 가는 길로 가자.' },
        ],
      },
    ],
    note: '나라는 농사 때를 놓칠까 봐 농민을 돌려보내고 스님들에게 일을 맡겼어요.',
    facts: ['F35', 'F34'],
  },
  {
    // 둘째 일(가): 돌아온 집의 논갈이를 거든다
    id: 's1395-spring-return-help',
    situation: S,
    season: 'spring',
    roles: FARMER,
    theme: 'duty',
    spot: 'neighborPaddy',
    shows: { flags: [FLAGS.help] },
    cost: 0,
    stage: {
      place: 'paddy',
      cast: [
        { who: 'neighbor-elder', at: 'left' },
        { who: 'well-neighbor', at: 'right' },
      ],
    },
    lines: [
      { text: '이웃집 논은 아직 갈지 못해 흙이 굳어 있다.' },
      { who: 'neighbor-elder', text: '소가 쟁기를 끌면 너는 뒤에서 흙덩이를 깨 다오.' },
      { who: 'well-neighbor', text: '애 아버지가 없는 동안 논을 못 갈아 애가 탔단다. 와 줘서 고맙다.' },
      { text: '한참 동안 흙덩이를 깨고 논둑의 풀을 걷어 냈다.' },
    ],
    after: {
      effects: { body: -1, trust: 1 },
      setFlags: [FLAGS.returnDone],
      lines: [
        { who: 'neighbor-elder', pose: 'glad', text: '덕분에 곧 볍씨를 뿌리겠다. 너희 집 일이 바쁠 때는 내가 가마.' },
        { text: '팔다리는 뻐근하지만 마음은 가볍다.' },
      ],
    },
    note: '나라가 일꾼들을 돌려보낸 것은 이월 십구일, 봄 농사가 시작될 때였어요.',
    facts: ['F35'],
  },
  {
    // 둘째 일(나): 우리 집 봄 일부터 한다 — 인심이 깎이는 길
    id: 's1395-spring-return-ours',
    situation: S,
    season: 'spring',
    roles: FARMER,
    theme: 'duty',
    spot: 'home',
    shows: { flags: [FLAGS.ours] },
    cost: 0,
    stage: { place: 'yard', cast: [{ who: 'mother', at: 'center' }] },
    lines: [
      { text: '마당에서 어머니가 씨앗 자루를 볕에 널고 계신다.' },
      { who: 'mother', text: '마침 잘 왔다. 텃밭을 갈아야 하는데 손이 모자랐단다.' },
      { who: 'mother', pose: 'worried', text: '돌아온 집 논도 밀렸다던데… 우리 일도 급하니 어쩌겠니.' },
      { text: '텃밭을 갈고, 헐거워진 울타리도 고쳐 묶었다.' },
    ],
    after: {
      effects: { living: 1, trust: -1 },
      setFlags: [FLAGS.returnDone],
      lines: [
        { who: 'mother', pose: 'glad', text: '수고했다. 올봄 일은 한걸음 앞서겠구나.' },
        { text: '일을 마치고 나서 이웃집 논을 보았다. 아직 갈지 못한 그대로다. 마음 한쪽이 무겁다.' },
      ],
    },
    note: '농민은 농사를 지으면서 나라의 공사에도 불려 가야 해서 힘든 날이 많았어요.',
    facts: ['F02', 'F35'],
  },
  {
    // 둘째 일(다): 스님들께 길에서 드실 곡식을 보탠다
    id: 's1395-spring-return-monks',
    situation: S,
    season: 'spring',
    roles: FARMER,
    theme: 'duty',
    spot: 'templeRoad',
    shows: { flags: [FLAGS.give] },
    cost: 0,
    stage: { place: 'temple', cast: [{ who: 'monk', at: 'center' }] },
    lines: [
      { text: '절 가는 길에서 스님들이 짐을 꾸린다. 나는 곡식 자루를 내밀었다.' },
      { who: 'monk', pose: 'glad', text: '이 귀한 것을. 길에서 든든히 먹으마.' },
      { who: 'monk', text: '집 짓는 일은 우리 손에 익었다. 농사짓는 사람들은 논을 지켜야지.' },
    ],
    after: {
      effects: { living: -1, trust: 1 },
      setFlags: [FLAGS.returnDone],
      cards: ['s1395-monk-builders'],
      lines: [
        { who: 'monk', text: '일이 끝나면 돌아오마. 그때까지 마을이 두루 평안하기를 빈다.' },
        // 스님들은 아직 떠나지 않았다(이 뒤에 뒷산 절에 가도 앞뒤가 맞게)
        { text: '우리 집 곡식은 조금 줄었지만, 짐을 다 꾸린 스님들의 인사에 마음이 놓인다.' },
      ],
    },
    note: '궁궐을 짓는 스님들에게는 나라에서 옷과 먹을 것을 주었어요.',
    facts: ['F34', 'F35'],
  },

  // ── 꼭 푸는 미션 ② 볍씨 뿌리기 ────────────────────────────────
  {
    // 고른 논은 표시로 남아 여름을 닫을 때 날씨와 만난다(index.ts의 later).
    // 놀이가 끝난 모습에 따른 차이는 품과 볍씨의 작은 차이(±1)뿐이다. 바탕 결과는 "듬성듬성"이다.
    id: 's1395-spring-sow',
    situation: S,
    season: 'spring',
    roles: FARMER,
    theme: 'farming',
    spot: 'ourPaddy',
    cost: 0,
    stage: {
      place: 'paddy',
      cast: [
        { who: 'father', at: 'left' },
        { who: 'mother', at: 'right' },
      ],
    },
    lines: [
      { text: '우리 논에 물이 찰랑인다. 볍씨 자루를 멘 아버지가 기다리신다.' },
      { who: 'father', text: '냇가 낮은 논은 물 대기가 쉬워 벼가 잘된다. 다 거기 뿌릴까 싶다.' },
      { who: 'mother', pose: 'worried', text: '큰비가 오면 낮은 논은 잠겨요. 비탈 위 높은 논에도 나눠 뿌려요.' },
      { who: 'father', text: '높은 논은 물 대기가 힘들어 덜 거두는데… 네 생각은 어떠냐?' },
    ],
    choices: [
      {
        id: 'low',
        label: '낮은 논에 몰아 뿌린다',
        effects: { body: -1 },
        setFlags: [FLAGS.sowLow],
        cards: SOW_CARD,
        lines: [FATHER_PATCHY, { text: '허리를 펴니 낮은 논 가득 볍씨가 잠겨 있다. 이제 여름 하늘에 달렸다.' }],
        variants: [
          {
            when: { flags: [FLAGS.sowEven] },
            effects: { body: -1, living: 1 },
            setFlags: [FLAGS.sowLow],
            cards: SOW_CARD,
            lines: [FATHER_EVEN, { text: '낮은 논이 볍씨로 촘촘하다. 이제 여름 하늘에 달렸다.' }],
          },
          {
            when: { flags: [FLAGS.sowLeft] },
            setFlags: [FLAGS.sowLow],
            cards: SOW_CARD,
            lines: [FATHER_LEFT, { text: '아버지가 팔을 휘두를 때마다 볍씨가 퍼진다. 낮은 논이 다 찼다.' }],
          },
        ],
      },
      {
        id: 'split',
        label: '높은 논에도 나눠 뿌린다',
        effects: { body: -1 },
        setFlags: [FLAGS.sowSplit],
        cards: SOW_CARD,
        lines: [FATHER_PATCHY, { text: '두 논을 오르내리며 나눠 뿌렸다. 큰비가 와도 한쪽은 남겠지.' }],
        variants: [
          {
            when: { flags: [FLAGS.sowEven] },
            effects: { body: -1, living: 1 },
            setFlags: [FLAGS.sowSplit],
            cards: SOW_CARD,
            lines: [FATHER_EVEN, { text: '낮은 논과 높은 논을 오르내렸다. 큰비가 와도 한쪽은 남겠지.' }],
          },
          {
            when: { flags: [FLAGS.sowLeft] },
            setFlags: [FLAGS.sowSplit],
            cards: SOW_CARD,
            lines: [FATHER_LEFT, { text: '아버지와 어머니가 두 논을 오가며 볍씨를 뿌리신다.' }],
          },
        ],
      },
    ],
    play: { game: 'sow', rules: '1395', flags: { even: FLAGS.sowEven, patchy: FLAGS.sowPatchy, left: FLAGS.sowLeft } },
    // "김매기"라는 낱말은 카드 「볍씨 바로 뿌리기」가 풀이한다
    note: '이때는 볍씨를 논에 바로 뿌렸어요. 벼와 풀이 함께 자라 논의 풀 뽑기가 힘들었어요.',
    facts: ['F04'],
  },

  // ── 덤으로 하는 일(해 ☀ 하나씩. 해는 셋이라 넷을 다 할 수는 없다) ────
  // lure: 할 일 쪽지의 덤 줄에 "우물가 — <한마디>"로 뜬다(자리 이름은 맵이 붙인다). 무슨 일이 벌어질지 답을 미리 말하지 않는 소문 같은 한 줄.
  // 우물가와 뒷산에는 둘 가운데 하나를 고르는 작은 선택이 있다. 품을 들이면 얻고 아끼면 그대로다 — 어느 쪽도 다른 쪽보다 늘 낫지 않다.
  // 카드와 배움 쪽지는 어느 쪽을 골라도 같다(쪽지는 일의 note를 함께 쓴다).
  {
    id: 's1395-spring-well',
    situation: S,
    season: 'spring',
    roles: FARMER,
    theme: 'duty',
    spot: 'well',
    cost: 1,
    lure: '아주머니가 한양 이야기를 한다더라',
    stage: { place: 'well', cast: [{ who: 'well-neighbor', at: 'center' }] },
    lines: [
      { text: '우물가에서 이웃 아주머니가 물동이를 채우고 계신다.' },
      { who: 'well-neighbor', text: '애 아버지가 지난겨울 한양에서 궁궐 터 닦는 일을 하고 왔단다.' },
      { who: 'well-neighbor', text: '작년 시월에 도읍을 옮기고 십이월부터 터를 닦았다더라. 손이 다 텄지 뭐니.' },
    ],
    choices: [
      {
        // 품을 들여 거든다: 기력을 내고 인심을 얻는다
        id: 'carry',
        label: '물동이를 들어 드리며 듣는다',
        effects: { body: -1, trust: 1 },
        cards: WELL_CARD,
        lines: [
          { text: '이야기를 들으며 물동이를 집 앞까지 들어 드렸다. 팔이 뻐근하다.' },
          { who: 'well-neighbor', pose: 'glad', text: '고맙다. 한양 이야기가 궁금하면 또 오너라.' },
        ],
      },
      {
        // 듣기만 한다: 수치는 그대로다(카드는 받는다). 누구도 나를 꾸짖지 않는다.
        id: 'listen',
        label: '곁에 앉아 이야기만 듣는다',
        cards: WELL_CARD,
        lines: [
          { text: '우물가 돌에 앉아 이야기를 끝까지 들었다. 한양이 어떤 곳일지 그려 본다.' },
          { who: 'well-neighbor', text: '궁금한 게 많구나. 다음에 또 들려주마.' },
        ],
      },
    ],
    note: '한양으로 도읍을 옮긴 것은 지난해 시월이에요. 십이월부터 궁궐 터를 닦았어요.',
    facts: ['F34', 'F35'],
  },
  {
    // 듣기만 하는 일. 그림(텅 빈 조용한 절 마당 — docs/pictures.md의 temple-spring)에 맞춰 "마당은 조용하고 안에서 떠날 준비를 한다"로 썼다.
    // 미션 ①("스님들이 내일 떠난다")을 풀기 전에 와도 뒤에 와도 어긋나지 않는다: 스님들은 아직 떠나지 않았다.
    id: 's1395-spring-temple',
    situation: S,
    season: 'spring',
    roles: FARMER,
    theme: 'inheritance',
    spot: 'temple',
    cost: 1,
    lure: '스님들이 곧 먼 길을 떠난다더라',
    stage: { place: 'temple', cast: [{ who: 'monk', at: 'center' }] },
    lines: [
      { text: '뒷산 절 마당은 조용하다. 안에서는 스님들이 떠날 준비를 하고 있다.' },
      { who: 'monk', text: '젊은 스님들은 궁궐 일을 하러 간다. 절은 나이 드신 스님이 지키실 게다.' },
      { who: 'monk', pose: 'worried', text: '제사며 장례며 절을 찾는 이가 많은데, 한동안 손이 모자라겠구나.' },
    ],
    lineVariants: [
      {
        // 미션 ①에서 스님들께 곡식을 보태고 왔으면(절 가는 길에서 "짐을 다 꾸린 스님들"을 보았다) 스님이 알아본다
        when: { flags: [FLAGS.give, FLAGS.returnDone] },
        lines: [
          { text: '뒷산 절 마당은 조용하다. 떠날 준비를 마친 스님이 나를 알아보신다.' },
          { who: 'monk', pose: 'glad', text: '곡식을 보태 준 아이로구나. 덕분에 떠날 길이 든든하다.' },
          { who: 'monk', text: '젊은 스님들은 궁궐 일을 하러 간다. 절은 나이 드신 스님이 지키실 게다.' },
        ],
      },
    ],
    after: {
      cards: ['s1395-temple-monks'],
      lines: [
        { text: '우리 마을은 제사를 이 절에서 지내 왔다. 할아버지 제삿날이 떠오른다.' },
        { text: '스님들이 떠나면 이 마당은 더 조용해지겠다.' },
      ],
    },
    note: '이때는 제사나 장례 때 절을 찾는 일이 흔했어요. 고려 때부터 이어진 모습이에요.',
    facts: ['F37', 'F35'],
  },
  {
    // 덤 미션 「새 나라 이야기 모으기」의 봄 몫. 듣기만 하는 일이다.
    // 주인공은 열다섯이고 새 임금이 선 것이 세 해 전이니, 열두 살 때까지는 고려에서 살았다.
    id: 's1395-spring-tale',
    situation: S,
    season: 'spring',
    roles: FARMER,
    theme: 'play',
    spot: 'treeShade',
    cost: 1,
    lure: '할머니가 옛이야기를 들려주신다더라',
    stage: { place: 'entrance', cast: [{ who: 'village-grandma', at: 'center' }] },
    lines: [
      { who: 'village-grandma', text: '이리 앉아라. 네가 열두 살 때만 해도 나라 이름이 고려였단다.' },
      { who: 'village-grandma', text: '세 해 전에 새 임금님이 왕위에 오르시고, 얼마 뒤 나라 이름이 조선이 되었지.' },
      { who: 'village-grandma', text: '작년에는 도읍도 한양으로 옮겼지. 그래도 봄에 볍씨 뿌리는 건 그대로구나.' },
    ],
    after: {
      effects: { body: 1 },
      setFlags: [FLAGS.taleSpring],
      lines: [
        { text: '그늘에 앉아 이야기를 듣다 보니 몸이 한결 가볍다.' },
        { text: '새 나라 이야기를 하나 들었다. 가을에도 들으러 와야지.' },
      ],
    },
    note: '세 해 전 새 임금이 왕위에 오르고, 곧 나라 이름이 고려에서 조선으로 바뀌었어요.',
    facts: ['F56', 'F34'],
  },
  {
    id: 's1395-spring-woods',
    situation: S,
    season: 'spring',
    roles: FARMER,
    theme: 'paying',
    spot: 'woods',
    cost: 1,
    lure: '동무가 나무하러 가자고 한다',
    stage: { place: 'hill', cast: [{ who: 'friend-boy', at: 'center' }] },
    lines: [
      { text: '뒷산 숲에서 이웃집 동무가 마른 가지를 줍고 있다.' },
      { who: 'friend-boy', text: '나무하러 왔어? 지난겨울엔 아버지가 궁궐 일에 가셔서 나무는 내가 다 했어.' },
      { who: 'friend-boy', pose: 'glad', text: '저 위에 마른 가지가 많아. 넉넉히 해서 한 짐은 쌀하고 바꾸자!' },
    ],
    choices: [
      {
        // 품을 들여 두 짐을 한다: 기력을 내고 살림을 얻는다
        id: 'plenty',
        label: '나무를 넉넉히 한다',
        effects: { body: -1, living: 1 },
        lines: [
          { text: '한 짐은 우리 집에 쌓고, 한 짐은 이웃집에 져다 주고 쌀을 받았다.' },
          { text: '어깨는 뻐근해도 살림에 보탬이 되었다.' },
        ],
      },
      {
        // 한 짐만 한다: 수치는 그대로다. 쌀과 바꾸는 이야기는 동무의 말로 듣는다(쪽지가 짚는 것).
        id: 'light',
        label: '한 짐만 하고 쉰다',
        lines: [
          { text: '한 짐만 해 놓고 바위에 앉아 쉬었다. 마을이 한눈에 내려다보인다.' },
          { who: 'friend-boy', pose: 'glad', text: '나는 한 짐 더 해서 쌀하고 바꿀 거야. 다음에 또 같이 오자!' },
        ],
      },
    ],
    note: '이때는 돈이 널리 쓰이지 않아 쌀과 베가 돈처럼 쓰였어요.',
    facts: ['F08'],
  },
];
