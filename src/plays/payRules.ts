// 일 놀이 「쌀과 베로 값 치르기」의 셈 — 화면을 모르는 순수 함수들이다(시험이 불러 쓴다).
// 값을 쌀과 베로 치르던 때다(F08). 쌀은 되로 한 되씩 되어 얹고, 베는 끊어서 얹거나 통째로 얹는다.
// 상대가 받을 만큼이 될 때까지 얹었다 덜었다 하며 맞추는 번거로움이 이 놀이의 내용이다.
// 셈 문제가 아니다: 값은 화면에 숫자로 나오지 않고, 상대의 낯빛과 말이 "더 얹어야겠다 / 됐다 / 넉넉하구나"를 알려 준다.
// 맞추는 길은 여러 가지이고, 넉넉히 얹어 주어도 된다. 맞았다·틀렸다도, 점수도 없다.
//
// 아래의 값(쌀 한 되가 2, 끊은 베 한 조각이 4 …)은 놀이를 굴리려고 꾸민 것이다. 그때의 실제 값이 아니다.
// "끊은 베는 통째인 베보다 덜 쳐 준다"도 놀이의 규칙으로 꾸민 것이다(근거 F08에는 없다).
//
//   exact    받을 만큼에 알맞게 건넸다
//   generous 받을 만큼보다 넉넉히 얹어 건넸다
//   left     어른께 맡겼다(화면의 "어른께 맡긴다")
// 모자라게 내밀면 끝나지 않는다 — 상대가 고개를 젓고("조금 더 얹어야겠다") 놀이가 이어진다.

export type PayEnd = 'exact' | 'generous' | 'left';
export type PayThing = 'rice' | 'cut' | 'whole';
/** 상대의 낯빛: 아무것도 없다 · 한참 모자라다 · 조금 모자라다 · 됐다 · 넉넉하다 */
export type PayMood = 'none' | 'far' | 'near' | 'enough' | 'plenty';

export interface PayRules {
  /** 무엇을 받으려는가(화면의 글에 쓴다) */
  goods: string;
  /** 받는 자루의 수(놀이판에 그리는 수) */
  sacks: number;
  /** 그것을 가진 사람: 화면에 적을 이름과 도트 인물의 이름(pixel/people.ts). 대본의 그 일에 서는 사람과 맞춘다. */
  keeper: { label: string; sprite: string };
  /** 가져온 쌀(되) */
  rice: number;
  /** 가져온 베의 토막 수(끊을 수 있는 자리가 이보다 하나 적다) */
  cloth: number;
  /** 쌀 한 되의 값 */
  riceWorth: number;
  /** 끊은 베 한 조각의 값 */
  cutWorth: number;
  /** 끊지 않은 베 통째의 값(조각으로 다 끊어 낸 것보다 크다) */
  wholeWorth: number;
  /** 상대가 받을 만큼 */
  price: number;
  /** 이만큼부터는 넉넉히 얹어 준 것 */
  plenty: number;
  /** 이만큼부터는 "조금만 더" */
  near: number;
}

/**
 * 규칙의 이름표마다의 흥정. 지금은 '1395'(고갯마루에서 윗마을 사람의 소금 한 자루를 쌀과 베로) 하나다.
 * 뒤 이야기의 "엽전을 세어 내는" 규칙은 그 이야기를 만들 때 더한다.
 */
export const PAY_RULES: Record<string, PayRules> = {
  '1395': {
    goods: '소금 한 자루',
    sacks: 1,
    keeper: { label: '윗마을 사람', sprite: 'passMan' },
    rice: 5,
    cloth: 4,
    riceWorth: 2,
    cutWorth: 4,
    wholeWorth: 20,
    price: 12,
    plenty: 16,
    near: 8,
  },
};

/**
 * 앞에서 고른 선택지에 따라 달라지는 흥정(이름표마다). 선택지의 id는 그 일의 내용 쪽 것이다.
 * '1395'의 share("이웃 몫까지 넉넉히 바꾼다"): 소금 두 자루를 받으니 받을 만큼이 크고, 쌀도 더 지고 왔다.
 * 그래서 베를 통째로 얹어도 넘치지 않고 쌀을 더 되어 얹어야 맞는다.
 */
export const PAY_CHOICES: Record<string, Record<string, Partial<PayRules>>> = {
  '1395': {
    share: { goods: '소금 두 자루', sacks: 2, rice: 8, price: 24, plenty: 30, near: 16 },
  },
};

/** 이름표와 앞에서 고른 선택지에 맞는 흥정. 모르는 이름표면 '1395', 모르는 선택지면 바탕 흥정이다. */
export function payRulesOf(label: string, choice?: string): PayRules {
  const key = PAY_RULES[label] ? label : '1395';
  const extra = choice ? PAY_CHOICES[key]?.[choice] : undefined;
  return extra ? { ...PAY_RULES[key], ...extra } : PAY_RULES[key];
}

export interface PayTable {
  /** 멍석에 얹은 것(얹은 차례대로) */
  put: readonly PayThing[];
  /** 자루에 남은 쌀(되) */
  rice: number;
  /** 아직 끊지 않아 이어져 있는 베의 토막 수 */
  joined: number;
  /** 끊어 놓았지만 멍석에 얹지 않은 조각(도로 가져온 것). 끊은 베는 다시 붙지 않는다. */
  spare: number;
}

export function newPayTable(rules: PayRules): PayTable {
  return { put: [], rice: rules.rice, joined: rules.cloth, spare: 0 };
}

/** 쌀 한 되를 되어 얹는다. 자루가 비었으면 그대로다. */
export function putRice(t: PayTable): PayTable {
  if (t.rice <= 0) return t;
  return { ...t, rice: t.rice - 1, put: [...t.put, 'rice'] };
}

export function canCut(t: PayTable): boolean {
  return t.spare > 0 || t.joined > 0;
}

/** 베 한 조각을 끊어 얹는다(도로 가져온 조각이 있으면 그것부터). 베가 없으면 그대로다. */
export function putCut(t: PayTable): PayTable {
  if (t.spare > 0) return { ...t, spare: t.spare - 1, put: [...t.put, 'cut'] };
  if (t.joined > 0) return { ...t, joined: t.joined - 1, put: [...t.put, 'cut'] };
  return t;
}

/** 베를 통째로 얹을 수 있는가(한 번도 끊지 않았을 때만) */
export function canWhole(t: PayTable, rules: PayRules): boolean {
  return t.joined === rules.cloth;
}

/**
 * 베를 통째로 얹으면 받을 만큼을 한참 넘치는가(그러면 화면이 한 번 되묻는다 — "그래도 줄래?". 틀림이 아니다).
 */
export function wholeOvershoots(t: PayTable, rules: PayRules): boolean {
  return canWhole(t, rules) && payValue(t, rules) + rules.wholeWorth >= rules.plenty;
}

/** 끊지 않은 베를 통째로 얹는다. 이미 끊었으면 그대로다. */
export function putWhole(t: PayTable, rules: PayRules): PayTable {
  if (!canWhole(t, rules)) return t;
  return { ...t, joined: 0, put: [...t.put, 'whole'] };
}

/** 방금 얹은 것 하나를 도로 가져온다. 끊은 베는 끊어진 채로 돌아온다. */
export function takeBack(t: PayTable, rules: PayRules): PayTable {
  if (t.put.length === 0) return t;
  const last = t.put[t.put.length - 1];
  const put = t.put.slice(0, -1);
  if (last === 'rice') return { ...t, put, rice: t.rice + 1 };
  if (last === 'cut') return { ...t, put, spare: t.spare + 1 };
  return { ...t, put, joined: rules.cloth };
}

/** 멍석에 얹은 것의 수: 쌀(되), 끊은 베(조각), 통째인 베 */
export function payCount(t: PayTable): { rice: number; cut: number; whole: number } {
  const out = { rice: 0, cut: 0, whole: 0 };
  for (const thing of t.put) out[thing]++;
  return out;
}

/** 멍석에 얹은 것의 값 */
export function payValue(t: PayTable, rules: PayRules): number {
  const n = payCount(t);
  return n.rice * rules.riceWorth + n.cut * rules.cutWorth + n.whole * rules.wholeWorth;
}

/** 상대의 낯빛 */
export function payMood(t: PayTable, rules: PayRules): PayMood {
  const v = payValue(t, rules);
  if (v <= 0) return 'none';
  if (v >= rules.plenty) return 'plenty';
  if (v >= rules.price) return 'enough';
  return v >= rules.near ? 'near' : 'far';
}

/** 이대로 내밀면: 모자라다(short — 끝나지 않는다) · 알맞다 · 넉넉하다 */
export function payVerdict(t: PayTable, rules: PayRules): 'short' | 'exact' | 'generous' {
  const mood = payMood(t, rules);
  if (mood === 'plenty') return 'generous';
  return mood === 'enough' ? 'exact' : 'short';
}
