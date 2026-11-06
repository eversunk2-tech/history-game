// ① 1395년 겨울 — 농민 집 아이의 일(Happening) 여덟.
//   꼭 푸는 미션 「할아버지의 제삿날」: 집에서 어떻게 지낼지 정한다 → (절에 가기로 했으면) 뒷산 절에서 지낸다(일 하나 또는 둘)
//   꼭 푸는 미션 「겨울 글공부」: 남자아이 모습은 향교 가는 길에서 선생께 여쭙고, 여자아이 모습은 마을 어귀에서 향교에 다니는 동무에게 묻는다
//     (자리가 다르다 — 향교 가는 길은 여자아이 모습에게 막혀 있다. 수치와 잠김의 문턱은 같다)
//   덤으로 하는 일 넷: 우리 집(▶베 짜기 — 제삿날 일을 정한 뒤에 나타난다) · 느티나무 그늘(덤 미션의 겨울 몫) · 이웃집 앞 · [인심 8 이상] 타작 마당
// 대본과 출처 대조는 docs/script-1395.md의 13절부터.
// 농민 집이 제사를 어떻게 지냈는지는 자료가 없다(F37은 사대부 이야기다 — spec 12.3의 8번). "우리 마을은 … 지내 왔단다"로 흐리게 썼다.
// 새 예절을 따르지 않아도 인심이 깎이지 않는다(예법의 무게 0). 어느 믿음이 옳다 그르다 하지 않는다.
// 봄에 정한 것이 돌아온다: 스님들께 곡식을 보탰으면(return.give) 절에서 스님이 알아보고 절에 드는 쌀이 준다.

import type { Happening, Line } from '../../../engine/types';
import { AUTUMN } from './autumn';
import { FLAGS } from './spring';

const S = 's1395';
const FARMER = ['farmer'];

/** 겨울의 표시(flag) */
export const WINTER = {
  riteTemple: 'rite.temple',
  riteDone: 'rite.done',
  lettersDone: 'letters.done',
  /** 겨울 동안 글자를 익혔다(한 해 이름이 읽는다) */
  lettersLearned: 'letters.learned',
  /** 일 놀이 「베 짜기」가 끝난 모습 */
  weaveBolt: 'weave.bolt',
  weaveHalf: 'weave.half',
  weaveLeft: 'weave.left',
  /** 덤 미션 「새 나라 이야기 모으기」의 겨울 몫 */
  taleWinter: 'tale.winter',
} as const;

const RITE_CARD = ['s1395-temple-rite'];
const SCHOOL_CARD = ['s1395-hyanggyo'];
const CLOTH_CARD = ['s1395-cloth-bolt'];
/** 일손을 빼는 길의 잠긴 까닭(두 모습이 같다). 학생이 먹을 것을 어떻게 댔는지는 확인하지 못해 "양식"을 넣지 않았다. */
const LETTERS_LOCK = { unless: { min: { living: 2 } }, reason: '일손을 뺄 만큼 집 형편이 넉넉하지 않아요' };

const TEMPLE_FIRST: Line = { text: '뒷산 절 마당에 눈이 얇게 깔렸다. 궁궐 일을 마친 스님이 돌아와 계신다.' };
const TEMPLE_GRANDMA: Line = { who: 'grandma', text: '고려 때부터 우리 집은 늘 이렇게 해 왔단다. 새 나라가 서도 그대로구나.' };
const TEMPLE_PRAY: Line = { text: '스님의 목소리가 마당에 낮게 깔린다. 할머니가 두 손을 모으신다.' };

const WRITE_ON_SNOW: Line = { text: '돌아오는 길, 눈 위에 나뭇가지로 두 글자를 써 보았다. 내 손으로 쓴 첫 글자다.' };
const PALACE_NAME: Line = { text: '경복궁. 입속으로 가만히 불러 본다. 아버지가 지은 궁궐의 이름이다.' };

export const happenings: Happening[] = [
  // ── 꼭 푸는 미션 「할아버지의 제삿날」 ───────────────────────────
  {
    // 첫 일: 절에 갈지 집에서 지낼지 정한다. 살림이 1 이하이면 여는 대화가 갈리고 절에 가는 길이 잠긴다.
    id: 's1395-winter-rite',
    situation: S,
    season: 'winter',
    roles: FARMER,
    theme: 'inheritance',
    spot: 'home',
    cost: 0,
    stage: {
      place: 'room',
      cast: [
        { who: 'grandma', at: 'left' },
        { who: 'mother', at: 'right' },
      ],
      // 방 왼쪽의 쌀독이 할머니에 가리지 않게 둘이 오른쪽으로 비켜 선다(1-라 11.8 ⑤)
      clear: 'left',
    },
    lines: [
      { text: '겨울이 깊어 간다. 할아버지 제삿날이 다가오자 할머니가 쌀독을 들여다보신다.' },
      { who: 'grandma', text: '우리 마을은 제삿날이면 절에 가서 스님과 함께 지내 왔단다. 쌀을 조금 가져가야 하지.' },
      { who: 'mother', text: '올해는 집에서 작게 상을 차려도 돼요. 마음이 닿으면 되지요.' },
      { who: 'grandma', text: '어느 쪽이든 할아버지는 반기실 게다. 네 생각은 어떠냐?' },
    ],
    lineVariants: [
      {
        // 살림이 바닥일 때의 제삿날
        when: { max: { living: 1 } },
        lines: [
          { text: '겨울이 깊어 간다. 할아버지 제삿날이 다가오는데 쌀독은 바닥이 보인다.' },
          { who: 'grandma', pose: 'worried', text: '절에 가져갈 쌀이 없구나. 올해는 집에서 물 한 그릇이라도 정성껏 올리자.' },
          { who: 'mother', text: '마음이 닿으면 되지요. 나물은 제가 무쳐 볼게요.' },
          { who: 'grandma', text: '그래. 할아버지도 우리 형편을 아실 게다.' },
        ],
      },
    ],
    choices: [
      {
        // 수치는 절에서 마칠 때 붙는다. 잠긴 까닭은 spec 6.3의 기준 문장.
        id: 'temple',
        label: '절에 가서 지낸다',
        lock: { unless: { min: { living: 2 } }, reason: '절에 가져갈 쌀이 없어요' },
        setFlags: [WINTER.riteTemple],
        goTo: 'temple',
        lines: [
          { who: 'grandma', pose: 'glad', text: '그러자. 쌀을 조금 챙겨라. 뒷산 절로 가자.' },
          { text: '쌀 자루를 메고 할머니 손을 잡았다. 눈길을 밟아 뒷산 절로 오른다.' },
        ],
      },
      {
        id: 'home',
        label: '집에서 작게 상을 차린다',
        effects: { living: -1, body: 1 },
        setFlags: [WINTER.riteDone],
        lines: [
          { text: '작은 상 앞에 온 식구가 모여 앉았다. 할머니가 할아버지 이야기를 들려주신다.' },
          { who: 'grandma', pose: 'glad', text: '할아버지가 너를 참 아끼셨단다. 올해도 잘 지냈다고 말씀드려라.' },
        ],
        variants: [
          {
            // 살림이 바닥이면 낼 것이 없다: 변화 없음
            when: { max: { living: 1 } },
            setFlags: [WINTER.riteDone],
            lines: [
              { text: '물 한 그릇과 묵은 나물 한 접시. 상은 작아도 온 식구가 둘러앉았다.' },
              { who: 'grandma', text: '할아버지는 상보다 너희 얼굴을 보러 오시는 게다.' },
            ],
          },
        ],
      },
    ],
    note: '조선 초에는 제삿날에 절에서 제사를 지내는 집이 많았어요.',
    facts: ['F37'],
  },
  {
    // 둘째 일(절에 가기로 했을 때): 스님이 겨울에 돌아와 있다는 것은 꾸민 것이다(봄의 "일이 끝나면 돌아오마"를 이었다).
    id: 's1395-winter-rite-temple',
    situation: S,
    season: 'winter',
    roles: FARMER,
    theme: 'inheritance',
    spot: 'temple',
    shows: { flags: [WINTER.riteTemple] },
    cost: 0,
    stage: {
      place: 'temple',
      cast: [
        { who: 'monk', at: 'left' },
        { who: 'grandma', at: 'right' },
      ],
    },
    lines: [TEMPLE_FIRST, { who: 'monk', text: '어서 오너라. 할아버지 제사를 모시러 왔구나. 향을 피우고 함께 빌자.' }, TEMPLE_GRANDMA],
    lineVariants: [
      {
        // 봄에 스님들께 길에서 드실 곡식을 보탰으면 스님이 알아본다
        when: { flags: [FLAGS.give] },
        lines: [
          TEMPLE_FIRST,
          { who: 'monk', pose: 'glad', text: '봄에 곡식을 보태 준 아이로구나! 덕분에 먼 길을 잘 다녀왔다. 오늘은 내가 정성껏 모시마.' },
          TEMPLE_GRANDMA,
        ],
      },
    ],
    after: {
      effects: { living: -2, body: 2 },
      setFlags: [WINTER.riteDone],
      cards: RITE_CARD,
      lines: [TEMPLE_PRAY, { text: '쌀 자루는 가벼워졌지만, 내려오는 길에 할머니 얼굴이 환하다.' }],
      variants: [
        {
          // 봄에 곡식을 보탰으면 쌀은 덜 들지만, 내려오기 전에 스님을 도와 눈을 쓴다(집에서 지내는 길보다 늘 낫지 않게 — review 14번)
          when: { flags: [FLAGS.give] },
          effects: { living: -1 },
          setFlags: [WINTER.riteDone],
          cards: RITE_CARD,
          lines: [
            TEMPLE_PRAY,
            { who: 'monk', text: '쌀은 조금만 두고 가거라. 봄에 받은 것이 있지 않느냐.' },
            { text: '내려오기 전에 스님과 함께 절 마당의 눈을 쓸었다. 몸은 고되어도 마음이 따뜻하다.' },
          ],
        },
      ],
    },
    note: '나라가 새 예절을 정한 뒤에도 절에서 제사를 지내는 집이 오랫동안 많았어요.',
    facts: ['F37', 'F57'],
  },

  // ── 꼭 푸는 미션 「겨울 글공부」 ─────────────────────────────────
  {
    // 남자아이 모습: 향교 가는 길(서쪽 문 너머)로 가서 여쭌다. 가르치는 이의 이름을 확인하지 못해 "선생"으로 썼다.
    id: 's1395-winter-letters',
    situation: S,
    season: 'winter',
    roles: FARMER,
    theme: 'learning',
    spot: 'hyanggyoRoad',
    shows: { look: 'boy' },
    cost: 0,
    stage: {
      place: 'hyanggyo',
      cast: [
        { who: 'teacher', at: 'left' },
        { who: 'student', at: 'right' },
      ],
    },
    lines: [
      { text: '향교 가는 길, 담 너머로 글 읽는 소리가 들린다. 문 앞에서 선생님께 인사를 드렸다.' },
      { who: 'student', pose: 'glad', text: '너도 배우러 왔어? 나는 지난봄부터 다녀. 열여섯이 안 돼도 받아 주셔.' },
      { who: 'teacher', text: '농사짓는 집 아들도 배우고자 하면 받는다. 새 나라가 그리하라 했느니라.' },
      { who: 'teacher', text: '다만 글을 읽는 동안은 집의 일손이 하나 준다. 어른들과 먼저 의논하여라.' },
    ],
    choices: [
      {
        id: 'attend',
        label: '겨울 동안 향교에서 글을 배운다',
        lock: LETTERS_LOCK,
        effects: { living: -1, body: -1 },
        setFlags: [WINTER.lettersDone, WINTER.lettersLearned],
        cards: SCHOOL_CARD,
        lines: [
          { who: 'teacher', pose: 'glad', text: '좋다. 내일부터 오너라. 먼저 한자 ‘하늘 천’과 ‘땅 지’부터 써 보자.' },
          { text: '눈길을 오가며 글자를 익혔다. 손은 시려도 아는 글자가 하나씩 는다.' },
        ],
      },
      {
        id: 'ask',
        label: '글자 몇 자만 여쭙고 돌아온다',
        setFlags: [WINTER.lettersDone],
        cards: SCHOOL_CARD,
        lines: [{ who: 'teacher', text: '오늘은 한자 ‘하늘 천’과 ‘땅 지’, 이 두 글자를 가져가거라.' }, WRITE_ON_SNOW],
      },
    ],
    note: '새 나라는 농민의 아들도 원하면 고을의 향교에서 배울 수 있게 했어요.',
    facts: ['F59', 'F11'],
  },
  {
    // 여자아이 모습: 향교 가는 길이 막혀 있어, 마을 어귀에서 향교에 다니는 동무에게 묻는다.
    // 동무에게 글자를 얻어 배우는 것은 꾸민 것이다(spec 12.3의 14번).
    id: 's1395-winter-letters-girl',
    situation: S,
    season: 'winter',
    roles: FARMER,
    theme: 'learning',
    spot: 'tree',
    shows: { look: 'girl' },
    cost: 0,
    stage: { place: 'entrance', cast: [{ who: 'student', at: 'center' }] },
    lines: [
      { text: '향교 가는 길은 내게 막혀 있다. 마을 어귀에서 향교에 다니는 동무를 기다렸다.' },
      { who: 'student', text: '글 읽는 소리가 궁금했구나. 향교는 남자만 다녀. 나도 왜 그런지는 잘 몰라.' },
      { who: 'student', pose: 'glad', text: '대신 내가 배운 글자를 알려 줄게. 너라면 금방 익힐 거야.' },
      { text: '글자를 얻어 배우려면 틈을 내야 한다. 겨울 일도 밀려 있는데, 어떻게 할까?' },
    ],
    choices: [
      {
        id: 'learn',
        label: '겨울 동안 동무에게 글자를 배운다',
        lock: LETTERS_LOCK,
        effects: { living: -1, body: -1 },
        setFlags: [WINTER.lettersDone, WINTER.lettersLearned],
        cards: SCHOOL_CARD,
        lines: [
          { who: 'student', pose: 'glad', text: '좋아! 오늘은 한자 ‘하늘 천’과 ‘땅 지’부터야. 땅바닥에 따라 써 봐.' },
          { text: '일하는 틈틈이 마당 흙에 글자를 썼다. 손은 시려도 아는 글자가 하나씩 는다.' },
        ],
      },
      {
        id: 'ask',
        label: '글자 몇 자만 물어보고 돌아온다',
        setFlags: [WINTER.lettersDone],
        cards: SCHOOL_CARD,
        lines: [{ who: 'student', text: '‘하늘 천’은 이렇게, ‘땅 지’는 이렇게 써. 잊어버리면 또 물어봐.' }, WRITE_ON_SNOW],
      },
    ],
    note: '향교의 학생은 모두 남자였어요. 여자는 향교에 다닐 수 없었어요.',
    facts: ['F11', 'F59'],
  },

  // ── 덤으로 하는 일(해 ☀ 하나씩) ──────────────────────────────────
  {
    // 일 놀이만 하는 일. 제삿날 일을 정한 뒤에 나타난다(같은 자리 — 우리 집 — 에 꼭 할 일과 함께 뜨지 않게).
    // 바탕 결과는 "반 필"(하다 만 것). 어느 모습으로 끝나도 카드를 얻는다(해 ☀를 쓰고 남는 것이 없지 않게).
    id: 's1395-winter-weave',
    situation: S,
    season: 'winter',
    roles: FARMER,
    theme: 'paying',
    spot: 'home',
    shows: { anyOf: [{ flags: [WINTER.riteTemple] }, { flags: [WINTER.riteDone] }] },
    cost: 1,
    lure: '집에서 베틀 소리가 난다더라',
    stage: { place: 'room', cast: [{ who: 'mother', at: 'center' }] },
    lines: [
      { text: '방 안에서 베틀 소리가 난다. 어머니가 베를 짜고 계신다.' },
      { who: 'mother', text: '베 한 필을 짜려면 여러 날이 걸린단다. 옷도 짓고, 쌀처럼 값으로도 쓰지.' },
      { who: 'mother', text: '실을 한 올씩 넣어 짜야 겨우 한 뼘이 는단다. 한번 해 보련?' },
    ],
    after: {
      cards: CLOTH_CARD,
      lines: [
        { who: 'mother', text: '반은 네가 짰으니 나머지는 내가 하마. 고르게 잘 짰다.' },
        { text: '몇 뼘 짜는 데도 한참이 걸렸다. 어머니의 겨울이 길 만하다.' },
      ],
      variants: [
        {
          when: { flags: [WINTER.weaveBolt] },
          effects: { body: -1, living: 1 },
          cards: CLOTH_CARD,
          items: ['s1395-my-cloth'],
          lines: [
            { who: 'mother', pose: 'glad', text: '끝까지 해냈구나. 이 한 필은 네가 짠 것이다.' },
            { text: '어깨가 굳었다. 베 한 필에 이렇게 손이 많이 가는 줄 몰랐다.' },
          ],
        },
        {
          // 어른께 맡기면 "반 필"과 수치가 같다(맡김이 하다 만 것보다 나은 일이 없고, 끝난 모습 셋의 차이는 1 안 — review 10번).
          // 어머니의 일이 밀리는 것은 이야기로만 치른다.
          when: { flags: [WINTER.weaveLeft] },
          cards: CLOTH_CARD,
          lines: [
            { who: 'mother', text: '그럼 내가 짜마. 너는 곁에서 실이나 감아 다오.' },
            { text: '실을 감으며 베틀을 바라보았다. 어머니가 하려던 다른 일은 내일로 밀렸다.' },
          ],
        },
      ],
    },
    play: { game: 'weave', rules: '1395', flags: { bolt: WINTER.weaveBolt, half: WINTER.weaveHalf, left: WINTER.weaveLeft } },
    note: '베는 옷감이면서 쌀과 함께 값을 치르는 데에도 쓰였어요.',
    facts: ['F08'],
  },
  {
    // 덤 미션 「새 나라 이야기 모으기」의 겨울 몫. 봄과 가을의 이야기를 다 들었으면 카드 「새 나라 조선」을 더 얻는다.
    id: 's1395-winter-tale',
    situation: S,
    season: 'winter',
    roles: FARMER,
    theme: 'play',
    spot: 'treeShade',
    cost: 1,
    lure: '새 궁궐에 이름이 붙었다더라',
    stage: { place: 'entrance', cast: [{ who: 'village-grandma', at: 'center' }] },
    lines: [
      { who: 'village-grandma', text: '한양의 새 궁궐에 이름이 붙었다는 소식을 들었느냐? 경복궁이란다.' },
      { who: 'village-grandma', text: '큰 복을 누리라는 뜻이라지. 새 임금님의 나라가 오래가기를 비는 이름이야.' },
      { who: 'village-grandma', text: '고려가 조선이 되고, 도읍이 서고, 궁궐에 이름까지. 긴 세 해였구나.' },
    ],
    after: {
      setFlags: [WINTER.taleWinter],
      cards: ['s1395-gyeongbokgung'],
      lines: [PALACE_NAME, { text: '새 나라 이야기를 또 하나 들었다.' }],
      variants: [
        {
          when: { flags: [FLAGS.taleSpring, AUTUMN.taleAutumn] },
          setFlags: [WINTER.taleWinter],
          cards: ['s1395-gyeongbokgung', 's1395-new-joseon'],
          lines: [PALACE_NAME, { text: '봄, 가을, 겨울. 새 나라 이야기 셋이 다 모였다.' }],
        },
      ],
    },
    note: '시월, 새 궁궐의 이름을 경복궁이라고 지었어요. 큰 복을 누린다는 뜻이에요.',
    facts: ['F34'],
  },
  {
    // 살림을 내거나 기력을 내고 인심을 얻는다. 곡식이 없으면 땔나무의 길이 열려 있다.
    id: 's1395-winter-share',
    situation: S,
    season: 'winter',
    roles: FARMER,
    theme: 'duty',
    spot: 'neighborHouse',
    cost: 1,
    lure: '옆집 굴뚝에 연기가 안 난다더라',
    // 배경은 우리 집 마당이 아닌 옆집(neighbor — 그림 bg/s1395/neighbor-winter). 옆집 동무는 이 장면 내내 걱정하는 얼굴이다
    // (기본 표정 worried — 동무가 말하기 전의 첫 창, 결과 대화의 첫머리, "달라진 것" 창에서도 웃지 않는다).
    stage: { place: 'neighbor', cast: [{ who: 'friend-girl', at: 'center', pose: 'worried' }] },
    lines: [
      { text: '옆집 굴뚝에 연기가 오르지 않는다. 문 앞에 동무가 힘없이 서 있다.' },
      { who: 'friend-girl', pose: 'worried', text: '우리 집은 곡식이 벌써 떨어져 가. 봄까지는 아직 먼데…' },
      { text: '우리 집도 넉넉하지는 않다. 무엇을 해 줄 수 있을까?' },
    ],
    choices: [
      {
        id: 'grain',
        label: '우리 집 곡식을 조금 나눈다',
        lock: { unless: { min: { living: 2 } }, reason: '나눌 곡식이 우리 집에도 없어요' },
        effects: { living: -1, trust: 1 },
        lines: [
          { who: 'friend-girl', pose: 'worried', text: '정말 고마워. 봄에 나물 뜯으면 제일 먼저 가져갈게.' },
          { text: '돌아오니 어머니가 말없이 내 어깨를 두드리신다.' },
        ],
      },
      {
        id: 'wood',
        label: '뒷산에서 땔나무를 해다 준다',
        effects: { body: -1, trust: 1 },
        lines: [
          { text: '언 손을 불어 가며 나뭇짐을 져다 날랐다. 옆집 굴뚝에 연기가 오른다.' },
          { who: 'friend-girl', pose: 'worried', text: '방이 따뜻해졌어. 정말 고마워.' },
        ],
      },
    ],
    // 즉위 교서의 "굶주리고 곤궁한 사람을 진휼" — F56이 든 기사를 직접 읽어 확인했다(대본 21절 ②)
    note: '새 임금은 왕위에 오르며, 홀로 된 어른과 굶주린 사람을 돕겠다고 했어요.',
    facts: ['F56'],
  },
  {
    // 인심이 8 이상일 때만 나타난다(인심이 높아야 열리는 일). 듣기만 하는 일.
    // 농민 집이 논을 어떻게 물려주었는지는 확인하지 못했다(F10은 양반 집 문서다) — 쪽지와 카드는 일반의 일로만 쓴다.
    id: 's1395-winter-elder',
    situation: S,
    season: 'winter',
    roles: FARMER,
    theme: 'inheritance',
    spot: 'threshing',
    shows: { min: { trust: 8 } },
    cost: 1,
    lure: '어르신이 할아버지 이야기를 아신다더라',
    stage: { place: 'threshing', cast: [{ who: 'village-elder', at: 'center' }] },
    lines: [
      { text: '빈 타작 마당에서 마을 어르신이 짚으로 새끼줄을 꼬다가 나를 보고 손짓하신다.' },
      { who: 'village-elder', text: '올 한 해 애쓰는 걸 보았다. 할아버지 이야기를 해 주마.' },
      { who: 'village-elder', text: '그 어른은 논을 아들딸에게 고루 나눠 주셨지. 네 고모도 똑같이 받았단다.' },
    ],
    after: {
      effects: { body: 1 },
      cards: ['s1395-even-share'],
      lines: [
        { text: '아들도 딸도 똑같이. 할아버지의 논은 그렇게 우리 집에 온 것이다.' },
        { who: 'village-elder', pose: 'glad', text: '제삿날이면 그 어른 생각이 난다. 너는 그 어른을 닮았어.' },
      ],
    },
    note: '조선 초에는 고려 때처럼 아들과 딸이 부모의 재산을 고루 나눠 받았어요.',
    facts: ['F10'],
  },
];
