// 고비(겨루기의 상대 — spec 8절, 11.1 다). 4-1은 ①-1의 둘: 작은 고비 「굳은 논흙」(삶의 고비)과 큰 고비 「도깨비의 내기」(옛이야기).
// 글은 대본 docs/script-1395.md 26.3·26.5에 먼저 쓰고 옮겼다(한 글자도 다르지 않게 — 대본과 자료가 같은 글이다).
//
// 지킬 것(spec 7.8·8.4)
//   - 고비는 사람이 아니다. 실제 나라·사람을 적으로 삼지 않는다. "쓰러뜨린다"가 아니라 "넘긴다"·"내기에서 이긴다".
//   - 삶의 고비(굳은 논흙)는 사람처럼 말하지 않는다. 예고는 일의 모습("흙이 더 굳는다")으로 쓴다.
//   - 옛이야기 고비(도깨비)는 「옛이야기」 표시(tale)를 달고, 여는 말의 첫 창은 정령의 "옛이야기야"다.
//     정해진 모습이 없고 어수룩하고 친근하다. 뿔·호랑이 가죽 옷·쇠못 박힌 방망이를 글로도 그리지 않는다.
//     씨름은 "아침에 보니 빗자루였다"까지. 「혹부리 영감」은 쓰지 않는다. 이긴 뒤에는 다치지 않고 웃으며 물러난다.
// 숫자(기운·한 번에 깎는 기운·무게)는 엔진 갈래와 맞춘 첫 어림이다(㉤에서 맞춘다). 엔진의 다른 숫자는 engine/balance.ts.
// who: 정령 'neuti', 도깨비 'dokkaebi', 사람은 이야기 묶음의 열쇠(father·mother·neighbor-elder). who가 없는 줄은 "나"의 이야기 줄이다.

import type { Foe } from '../engine/types4';
import { OFF_TURN } from '../engine/types4';

/** 작은 고비 「굳은 논흙」 — 우리 논, 볍씨 뿌리기의 놀이 앞(세 길 모두 한 번씩 — 11.1 고칠 것 1). 방패 없음, 2~3차례 */
const hardsoil: Foe = {
  id: 's1395-hardsoil',
  name: '굳은 논흙',
  kind: 'life',
  hp: 24,
  phases: 1,
  shield: 0,
  strong: ['craft', 'power'],
  weak: [],
  order: 'weighted',
  moves: [
    { id: 'crust', line: '볕에 흙이 더 단단히 굳어 가요', did: '볕에 흙이 더 단단히 굳었다', icon: 'crust', hit: [2, 3], weight: 2 },
    { id: 'clod', line: '흙덩이가 엉겨 손이 무거워져요', did: '흙덩이가 엉겨 손이 무거워졌다', icon: 'clod', hit: [2, 3], effect: 'weaken-next', weight: 1 },
  ],
  opening: [
    { text: '볍씨를 뿌리려는데, 논 한쪽 흙이 돌처럼 굳어 있다.' },
    { who: 'neuti', text: '흙이 이렇게 굳으면 볍씨가 자리를 못 잡아. 같이 풀어 보자!' },
  ],
  win: [
    { text: '흙덩이가 부서지고 논바닥이 고르게 풀렸다.' },
    { who: 'neuti', pose: 'glad', text: '해냈어! 이제 볍씨를 뿌려 보자.' },
  ],
  // 기운이 0이 되면 — 그 자리에 계신 아버지가 함께 넘긴다
  rescue: [
    { who: 'father', text: '힘들지? 이리 다오. 흙은 둘이 깨면 금방이다.' },
    { text: '아버지와 함께 남은 흙덩이를 마저 깼다.' },
  ],
  // 작은 고비의 차례가 다 되면(engine/balance.ts의 turnLimitMinor) — 어머니가 함께 마무리한다. 미션의 일 안이라 때를 못 박는 말을 쓰지 않는다
  dusk: [
    { who: 'mother', text: '흙이 많이 풀렸구나. 남은 건 같이 깨자.' },
    { text: '어머니와 함께 남은 흙덩이를 마저 깨뜨렸다.' },
  ],
  phaseOpen: [],
  wisdom: [],
  fade: '',
  // 삶의 고비는 사람 꼴로 그리지 않는다(4.5): 논 배경 위 흙덩이 상징
  picture: 'bg/s1395/paddy',
  sprite: 'hardsoil',
  // 볍씨를 논에 바로 뿌리던 때(F04). 굳은 논흙이라는 고비와 숫자는 꾸민 것(대본 26.12)
  facts: ['F04'],
};

/** 큰 고비 「도깨비의 내기」 — 옛이야기. 차례마다 다음 판(수수께끼·씨름·일 겨루기)을 알리고 그 판에 맞는 갈래가 세다(8.3). 두 단계 */
const dokkaebiBet: Foe = {
  id: 's1395-dokkaebi-bet',
  name: '도깨비의 내기',
  kind: 'tale',
  hp: 90,
  phases: 2,
  shield: 3,
  strong: [],
  // 그 판과 갈래가 다른 카드는 약하다
  weak: [OFF_TURN],
  order: 'cycle',
  moves: [
    // 수수께끼 판: 지혜가 세다. 웃음보로 기세 한 칸을 가져간다
    { id: 'riddle', line: '다음은 수수께끼다! 웃다가 기세를 뺏길라', did: '도깨비가 수수께끼를 냈다', icon: 'riddle', strong: 'wisdom', hit: [4, 6], effect: 'steal-momentum', weight: 1 },
    // 씨름 판: 힘이 세다
    { id: 'ssireum', line: '다음은 씨름이다! 샅바를 단단히 잡아라', did: '도깨비가 씨름을 걸었다', icon: 'ssireum', strong: 'power', hit: [5, 7], weight: 1 },
    // 일 겨루기 판: 솜씨가 세다
    { id: 'work', line: '다음은 일 겨루기다! 누가 더 빠른가 보자', did: '도깨비가 일 겨루기를 걸었다', icon: 'work', strong: 'craft', hit: [4, 6], weight: 1 },
  ],
  // 여는 말 세 창 — 정령이 "옛이야기야"를 먼저
  opening: [
    { who: 'neuti', text: '여기서부터는 옛이야기야. 느티골에 전해 오는 도깨비 이야기 속으로 가 보자.' },
    { text: '해거름, 느티나무 아래에 키가 큰 누군가가 껄껄 웃으며 나타났다.' },
    { who: 'dokkaebi', pose: 'glad', text: '봄 일 하느라 애썼다며? 나랑 내기 한판 하자! 수수께끼, 씨름, 일 겨루기다!' },
  ],
  // 내기에서 이김 — 웃으며 물러나고, 아침에 보니 빗자루(F71)
  win: [
    { who: 'dokkaebi', pose: 'glad', text: '허허, 내가 졌다! 이렇게 신나게 논 건 오랜만이다.' },
    { text: '도깨비는 껄껄 웃으며 어둠 속으로 물러갔다.' },
    { text: '이튿날 아침, 씨름하던 자리에는 낡은 빗자루 하나가 놓여 있었다.' },
    { who: 'neuti', text: '옛이야기 속 도깨비는 이렇게 사람과 겨루며 놀기를 좋아했대.' },
  ],
  // 내 기운이 0 — 이웃 어른과 동무가 와서 함께 넘긴다(별 ①은 받는다)
  rescue: [
    { text: '기운이 다 빠졌을 때, 이웃 어른과 동무가 달려와 곁에 섰다.' },
    { who: 'dokkaebi', pose: 'glad', text: '여럿이 함께 오니 못 당하겠다! 오늘은 여기까지 하자.' },
    { text: '도깨비는 웃으며 물러갔다. 이튿날 아침, 그 자리에는 낡은 빗자루뿐이었다.' },
  ],
  // 16차례 — 이웃이 와서 함께 마무리(구해 줌과 같게 셈한다)
  dusk: [
    { who: 'neighbor-elder', text: '해가 저문다. 함께 마무리하자.' },
    { who: 'dokkaebi', pose: 'glad', text: '벌써 깜깜하구나. 오늘 내기는 이만하자!' },
    { text: '이튿날 아침, 느티나무 아래에는 낡은 빗자루 하나가 놓여 있었다.' },
  ],
  // 기운이 반이 되면 2단계 — 방패 셋(도깨비불 셋으로 보인다)
  phaseOpen: [
    { who: 'dokkaebi', text: '제법이구나! 이제부터는 나도 꾀를 좀 부려야겠다.' },
    { text: '도깨비가 손뼉을 치자 둘레에 도깨비불 셋이 떠올랐다.' },
    { who: 'neuti', text: '도깨비불이 있는 동안은 힘이 반만 들어가. 하나씩 꺼 보자!' },
  ],
  // 지혜 겨루기 세 문제(핵심 물음)의 들머리 — 맞힌 수만큼 방패가 깎인다
  wisdom: [
    { who: 'dokkaebi', text: '불을 끄고 싶으면 내 물음 셋에 답해 봐라! 새 도읍 이야기다.' },
    { who: 'neuti', text: '봄에 듣고 본 것을 떠올려 봐. 맞힐 때마다 불이 하나씩 꺼져.' },
  ],
  // 방패가 남아 있으면 세 차례마다 한 칸 저절로 깎일 때(고칠 것 2 — "도깨비가 지친다")
  fade: '도깨비가 하품을 하자 도깨비불 하나가 스르르 꺼졌다.',
  // 대화 장면 배경 bg/s1395/entrance-spring에 해거름 빛(화면이 덧씌운다). 캔바 그림이 없으면 도트 대역
  picture: 'char/s1395/dokkaebi',
  sprite: 'dokkaebi',
  // 옛이야기 고비의 근거(F70~F74 가운데): 도깨비(백과 E0015531·E0015527 등 — 대본 26.10 ⑭~⑯)
  facts: ['F71'],
  tale: true,
};

export const foes: Foe[] = [hardsoil, dokkaebiBet];
