// 일 놀이 「베 짜기」의 셈 — 화면을 모르는 순수 함수들이다(시험이 불러 쓴다).
// 북을 옆으로 보내 씨실 한 줄을 넣고, 바디를 당겨 그 줄을 다진다. 그때마다 베가 한 줄 늘어난다.
// 베 한 필을 짜려면 이것을 수없이 되풀이해야 한다 — 베 한 필에 드는 품이 이 놀이의 내용이다.
// (놀이의 한 필은 마흔 줄이다. 실제 한 필은 견줄 수 없이 길다 — 1~2분에 끝나도록 줄인 것이다.)
// 틀림이 없다: 북을 엉뚱한 쪽으로 밀면 북이 움직이지 않을 뿐이고, 바디를 미리 당겨도 아무 일이 없다.
// "어른께 맡긴다"를 눌러도 같은 셈으로 가린다 — 짠 만큼은 버리지 않는다(weaveLeave).
//
//   left  열 칸 가운데 네 칸도 짜지 않고 끝냈다(어른께 맡긴 것으로 본다 — 대본에서 어머니가 "곁에서 실이나 감아 다오" 한다)
//   bolt  한 필을 다 짰다
//   half  그 밖(반쯤 짬 — 네 칸부터. 대본에서 어머니가 "반은 네가 짰으니 나머지는 내가 하마" 한다)

export type WeaveEnd = 'bolt' | 'half' | 'left';

/** 놀이의 베 한 필(줄) */
export const WEAVE_ROWS = 40;
/** 필을 열 토막으로 보인다: 한 토막의 줄 수 */
export const WEAVE_PART = 4;
/** 이만큼(열 칸 가운데 네 칸)은 짜야 "반쯤 짰다"고 한다. 그보다 적게 짜고 끝내면 어른께 맡긴 것으로 본다. */
export const WEAVE_HALF = 16;
/** 바디를 당기지 않고 넣어 둘 수 있는 씨실(이만큼 차면 북이 더 나가지 않는다) */
export const WEAVE_LOOSE_MAX = 3;

export interface Loom {
  /** 다져서 베가 된 줄 */
  rows: number;
  /** 넣기만 하고 아직 다지지 않은 씨실 */
  loose: number;
  /** 북이 있는 쪽(-1 왼쪽, 1 오른쪽) */
  side: -1 | 1;
}

export function newLoom(): Loom {
  return { rows: 0, loose: 0, side: -1 };
}

/** 북을 보낼 수 있는가(다지지 않은 씨실이 찼거나 한 필이 다 되었으면 못 보낸다) */
export function canThrow(loom: Loom): boolean {
  return loom.loose < WEAVE_LOOSE_MAX && loom.rows + loom.loose < WEAVE_ROWS;
}

/**
 * 북을 보낸다. toward는 미는 쪽(-1 왼쪽, 1 오른쪽)이고, 적지 않으면 건너편으로 보낸다.
 * 북이 이미 있는 쪽으로 밀었거나 보낼 수 없을 때는 그대로다.
 */
export function throwShuttle(loom: Loom, toward?: -1 | 1): Loom {
  if (!canThrow(loom)) return loom;
  if (toward !== undefined && toward === loom.side) return loom;
  return { rows: loom.rows, loose: loom.loose + 1, side: loom.side === -1 ? 1 : -1 };
}

/** 바디를 당긴다: 넣어 둔 씨실이 모두 다져져 베가 된다. 넣어 둔 것이 없으면 그대로다. */
export function beat(loom: Loom): Loom {
  if (loom.loose <= 0) return loom;
  return { rows: Math.min(WEAVE_ROWS, loom.rows + loom.loose), loose: 0, side: loom.side };
}

/** 다음에 할 일: 북 보내기(throw) · 바디 당기기(beat) · 다 짰다(done) */
export function nextStep(loom: Loom): 'throw' | 'beat' | 'done' {
  if (loom.loose > 0) return 'beat';
  return loom.rows >= WEAVE_ROWS ? 'done' : 'throw';
}

/** 짠 토막의 수(열 가운데) */
export function weaveParts(rows: number): number {
  return Math.min(WEAVE_ROWS / WEAVE_PART, Math.floor(rows / WEAVE_PART));
}

/** 놀이가 끝난 모습 */
export function weaveVerdict(rows: number): WeaveEnd {
  if (rows < WEAVE_HALF) return 'left';
  return rows >= WEAVE_ROWS ? 'bolt' : 'half';
}

/** 여기서 그만 짜도 되는가(반쯤 짰다 — 화면이 "여기서 그만 짜도 돼요"라고 알린다) */
export function weaveCanStop(rows: number): boolean {
  return rows >= WEAVE_HALF;
}

/**
 * "어른께 맡긴다"를 눌렀을 때의 끝난 모습. 나머지는 어머니가 짜지만, 내가 짠 만큼은 버리지 않는다
 * (끝내기 단추와 같은 셈 — 네 칸부터 half, 한 필을 다 짜 놓고 눌렀으면 bolt).
 */
export function weaveLeave(rows: number): WeaveEnd {
  return weaveVerdict(rows);
}
