// 일 놀이 「볍씨 뿌리기」의 셈 — 화면을 모르는 순수 함수들이다(시험이 불러 쓴다).
// 논을 가로 12 × 세로 6의 칸으로 나누고(화면에는 보이지 않는다), 볍씨가 떨어진 칸을 센다.
// 끝난 모습을 가르는 것은 "어디에 뿌렸느냐"뿐이다. 맞았다·틀렸다도, 점수도 없다 — 어떻게 뿌려도 일은 끝난다.
//
//   left   거의 뿌리지 않고 끝냈다(어른께 맡긴 것으로 본다)
//   even   칸의 여덟 할 넘게 볍씨가 떨어졌다(고루 뿌림)
//   patchy 그 밖(한쪽에 몰렸거나 빈 데가 많다 — 듬성듬성)

/** 논을 나눈 칸 */
export const SOW_COLS = 12;
export const SOW_ROWS = 6;
/** 광주리의 볍씨 */
export const SOW_SEEDS = 480;
/** 이만큼도 뿌리지 않고 끝내면 어른께 맡긴 것으로 본다 */
export const SOW_FEW = 30;
/** 칸의 이만큼에 볍씨가 떨어졌으면 고루 뿌린 것 */
export const SOW_EVEN_SHARE = 0.8;

export type SowEnd = 'even' | 'patchy' | 'left';

/** 빈 논(칸마다 떨어진 볍씨의 수) */
export function emptySowCells(): Uint16Array {
  return new Uint16Array(SOW_COLS * SOW_ROWS);
}

/** 논 안의 자리(0~1, 0~1)가 드는 칸의 번호. 논 밖의 값은 가장자리 칸으로 친다. */
export function sowCellOf(nx: number, ny: number): number {
  const col = Math.min(SOW_COLS - 1, Math.max(0, Math.floor(nx * SOW_COLS)));
  const row = Math.min(SOW_ROWS - 1, Math.max(0, Math.floor(ny * SOW_ROWS)));
  return row * SOW_COLS + col;
}

/** 뿌린 볍씨의 수 */
export function sowUsed(cells: ArrayLike<number>): number {
  let used = 0;
  for (let i = 0; i < cells.length; i++) used += cells[i];
  return used;
}

/** 볍씨가 한 알이라도 떨어진 칸의 몫(0~1) */
export function sowCoverage(cells: ArrayLike<number>): number {
  if (cells.length === 0) return 0;
  let covered = 0;
  for (let i = 0; i < cells.length; i++) if (cells[i] > 0) covered++;
  return covered / cells.length;
}

/** 놀이가 끝난 모습 */
export function sowVerdict(cells: ArrayLike<number>): SowEnd {
  if (sowUsed(cells) < SOW_FEW) return 'left';
  return sowCoverage(cells) >= SOW_EVEN_SHARE ? 'even' : 'patchy';
}
