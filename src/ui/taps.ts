// 잇달아 누른 것을 한 번으로 치는 문(대화 장면이 쓴다). 화면을 모르는 셈이다(tests/device.test.ts가 불러 본다).
//
// 새 창이 뜬 바로 뒤에는 조금 더 기다린다: 맵에서 자리를 누른 손가락이 떼어지며 첫 창을 넘기거나,
// 일 놀이를 끝내는 단추를 잇달아 두 번 누르거나 자판 Enter로 끝낸 그 누름이, 놀이 뒤의 첫 결과 창을
// 읽기도 전에 넘기지 않게(Review 1-라 6번 — 그 창이 놀이가 어떻게 끝났는지 말해 주는 유일한 줄이다).

/** 잇달아 누른 것을 한 번으로 치는 틈 */
export const TAP_GAP_MS = 260;
/** 새 창이 뜬 바로 뒤에 누름을 받지 않는 틈(TAP_GAP_MS보다 길다) */
export const OPEN_GAP_MS = 380;

export class TapGate {
  private last: number;

  /** 창이 뜬 때(now)부터 OPEN_GAP_MS 동안은 받지 않는다 */
  constructor(now: number) {
    this.last = now + (OPEN_GAP_MS - TAP_GAP_MS);
  }

  /** 새 창이 뜬 때: 지금부터 OPEN_GAP_MS 동안 누름을 받지 않는다(이미 더 길게 막혀 있으면 그대로) */
  hold(now: number): void {
    this.last = Math.max(this.last, now + (OPEN_GAP_MS - TAP_GAP_MS));
  }

  /** 이 누름을 받는가. 받으면 그 때를 적어 둔다(다음 누름은 그로부터 TAP_GAP_MS 뒤부터). */
  pass(now: number): boolean {
    if (now - this.last < TAP_GAP_MS) return false;
    this.last = now;
    return true;
  }
}
