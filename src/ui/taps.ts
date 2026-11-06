// 누름의 문: 잇달아 누른 것을 한 번으로 치고, 새 창이 뜬 바로 뒤의 누름을 받지 않는다(대화 장면이 쓴다 — 4판의 겨루기도 이 문을 쓴다).
// 화면을 모르는 셈이다(tests/device.test.ts가 불러 본다).
//
// 새 창이 뜬 바로 뒤에는 조금 더 기다린다: 맵에서 자리를 누른 손가락이 떼어지며 첫 창을 넘기거나,
// 일 놀이를 끝내는 단추를 잇달아 두 번 누르거나 자판 Enter로 끝낸 그 누름이, 놀이 뒤의 첫 결과 창을
// 읽기도 전에 넘기지 않게(Review 1-라 6번 — 그 창이 놀이가 어떻게 끝났는지 말해 주는 유일한 줄이다).
// 놀이 뒤의 첫 창은 배움 쪽지처럼 0.7초 막는다(1-라 11.8 ② — 세 번 누름, 0.38초를 넘긴 둘째 누름, 잇달아 누르기가 그 창을 넘겼다).
//
// 때는 모두 performance.now()의 시계로 잰다. 누름은 문이 그것을 처리한 때가 아니라 **누른 때**(사건의 timeStamp)로 잰다 —
// 느린 기기에서 맵을 다시 짓는 동안(4배 느리게 0.9초) 쌓인 누름이 그 일이 끝난 뒤에 처리되어도 누른 때는 창이 뜨기 전이다.

/** 잇달아 누른 것을 한 번으로 치는 틈 */
export const TAP_GAP_MS = 260;
/** 새 창이 뜬 바로 뒤에 누름을 받지 않는 틈(TAP_GAP_MS보다 길다) */
export const OPEN_GAP_MS = 380;
/** 읽을 틈: 일 놀이(4판의 겨루기)를 끝낸 바로 뒤의 첫 창과 배움 쪽지는 이만큼 받지 않는다 */
export const READ_GAP_MS = 700;

/** 지금(performance.now()의 시계) */
export function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * 누른 때: 사건의 timeStamp(performance.now()와 같은 시계). 사건이 없거나, 옛 브라우저처럼 다른 시계(1970년부터의 밀리초)로
 * 적혀 지금보다 뒤로 보이면 지금으로 친다.
 */
export function tapTime(ev?: { timeStamp?: number } | null): number {
  const now = nowMs();
  const t = ev?.timeStamp;
  return typeof t === 'number' && t > 0 && t <= now + 1 ? t : now;
}

export class TapGate {
  private last: number;

  /** 창이 뜬 때(now)부터 OPEN_GAP_MS 동안은 받지 않는다 */
  constructor(now: number) {
    this.last = now + (OPEN_GAP_MS - TAP_GAP_MS);
  }

  /** 새 창이 뜬 때: 지금부터 gap(기본 OPEN_GAP_MS) 동안 누름을 받지 않는다(이미 더 길게 막혀 있으면 그대로) */
  hold(now: number, gap: number = OPEN_GAP_MS): void {
    this.last = Math.max(this.last, now + (gap - TAP_GAP_MS));
  }

  /** 이 누름(누른 때 now)을 받는가. 받으면 그 때를 적어 둔다(다음 누름은 그로부터 TAP_GAP_MS 뒤부터). */
  pass(now: number): boolean {
    if (now - this.last < TAP_GAP_MS) return false;
    this.last = now;
    return true;
  }
}
