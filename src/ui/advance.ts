// 넘기기의 셈 — 대화 장면과 한 해 돌아보기가 쓴다. 화면을 모르는 셈이다(tests/device.test.ts가 불러 본다).
//
// 대화는 화면 어디를 눌러도, 자판 Enter·Space·→로도 한 창씩 넘어간다(사용자 요청 2026-11-11).
//   - 누름: 대화 장면 안은 장면이 받고(Talk.tsx의 onClick), 장면 밖(위쪽 띠의 빈 곳과 글)은 freeTap이 가른다.
//     단추·선택지·쪽지·일 놀이·"나중에 할게요"와 다른 창(세로 안내 등)은 저마다 받는다.
//   - 자판 →: Enter·Space와 같이 넘긴다. 선택지를 고르는 동안에는 아무것도 고르지 않는다(↑↓로 오가고 Enter·Space로 고른다).
//     누르고 있어서 되풀이되는 누름은 넘기지 않는다(한 번 누르면 한 창).
//   - 알림 한 줄: 판마다(새로 시작하거나 이어 하기로 열 때마다) 처음 몇 창에만 "다음 ▼" 곁에 넘기는 법을 알린다. 저장하지 않는다.

/** 대화 장면의 단계(Talk.tsx의 Step과 같은 이름) */
export type TalkStepKind = 'blocked' | 'open' | 'choose' | 'play' | 'result' | 'change' | 'note';

type KeyLike = Pick<KeyboardEvent, 'key' | 'repeat' | 'altKey' | 'ctrlKey' | 'metaKey'>;

/** 넘기는 법 알림(docs/spec-3판.md 9.2 — 30자 안) */
export const NEXT_HINT = '화면 어디를 눌러도 넘어가요(→·Space 키도 돼요)';

/** 알림 글의 한 조각: 자판 꼴(kbd)로 보일 글쇠(→, Space)인가, 그냥 글인가 */
export interface HintPart {
  text: string;
  key: boolean;
}

/**
 * 알림 글을 그냥 글과 글쇠(→, Space)로 나눈다 — 대사 창은 글쇠만 작은 자판 꼴로 보인다(spec.md 2.3).
 * 글자는 하나도 바뀌지 않는다: 조각을 이어 붙이면 처음 글과 같다(tests/device.test.ts가 본다).
 */
export function hintParts(text: string = NEXT_HINT): HintPart[] {
  return text
    .split(/(→|Space)/)
    .filter((piece) => piece !== '')
    .map((piece) => ({ text: piece, key: piece === '→' || piece === 'Space' }));
}

/** 판마다 알림을 보이는 창의 수 */
export const HINT_WINDOWS = 3;

/**
 * 이 단계에서 넘기기(누름·Enter·Space·→)가 먹는가: 여는 대화·결과 대화·"달라진 것"·할 수 없는 일의 말,
 * 그리고 선택지가 모두 잠긴 때(대화창이 "돌아가기"가 된다). 선택지를 고르는 동안·일 놀이·쪽지에서는 먹지 않는다.
 */
export function stepAdvances(kind: TalkStepKind, stuck: boolean): boolean {
  return kind === 'open' || kind === 'result' || kind === 'change' || kind === 'blocked' || (kind === 'choose' && stuck);
}

/** 대화를 넘기는 →인가: 누르고 있어 되풀이되는 것, Ctrl·Alt·⌘을 함께 누른 것(브라우저의 뒤로 가기 등)은 아니다 */
export function isNextArrow(ev: KeyLike): boolean {
  return ev.key === 'ArrowRight' && !ev.repeat && !ev.altKey && !ev.ctrlKey && !ev.metaKey;
}

/** 저마다 누름을 받는 것: 단추·고리·입력 칸, 창이 스스로 받겠다고 한 것(data-own) */
export const OWN_TAP = 'button, a[href], input, select, textarea, label, [role="button"], [role="link"], [role="tab"], [data-own]';

/**
 * 대화 장면 밖에서 난 누름이 대화를 넘기는가: 장면 안의 누름(장면이 받는다), 저마다 받는 것(OWN_TAP),
 * 다른 창(세로 안내·물음 — aria-modal) 위의 누름이면 아니다. 위쪽 띠의 빈 곳과 글(살림·기력·인심·해·계절)은 넘긴다.
 */
export function freeTap(target: EventTarget | null, root: Pick<Node, 'contains'> | null): boolean {
  const el = target as Pick<Element, 'closest'> | null;
  if (!root || !el || typeof el.closest !== 'function') return false;
  if (root.contains(target as Node)) return false;
  if (el.closest(OWN_TAP)) return false;
  return !el.closest('[aria-modal="true"]');
}

/**
 * 넘기는 법 알림을 보일 창을 센다. 판(play — 새로 시작하거나 이어 하기로 열 때마다 바뀌는 번호)이 바뀌면 처음부터 센다.
 * 저장하지 않는다(그 판 동안만 — 창을 다시 열면 다시 센다).
 */
export class NextHint {
  private play = Number.NaN;
  private shown = 0;

  constructor(readonly limit = HINT_WINDOWS) {}

  /** "다음 ▼"이 붙은 창이 새로 뜰 때 한 번 부른다: 이 창에 알림을 보이는가 */
  take(play: number): boolean {
    if (play !== this.play) {
      this.play = play;
      this.shown = 0;
    }
    if (this.shown >= this.limit) return false;
    this.shown += 1;
    return true;
  }
}

/** 대화 장면들이 함께 쓰는 하나(대화 장면이 닫혔다 다시 열려도 그 판에서 이어 센다) */
export const nextHint = new NextHint();

/**
 * 한 해 돌아보기의 자판: →는 "다음", ←는 "앞 장"과 같다. 갈 장(번호)을 돌려준다.
 * 그 단추가 없으면(첫 장의 ←, 마지막 장 "남길 것"의 → — 그 장의 단추는 장을 넘기지 않고 한 해를 마친다) null.
 * 되풀이되는 누름과 Ctrl·Alt·⌘을 함께 누른 것도 null.
 */
export function pageByKey(ev: KeyLike, page: number, count: number): number | null {
  if (ev.repeat || ev.altKey || ev.ctrlKey || ev.metaKey) return null;
  if (ev.key === 'ArrowRight') return page < count - 1 ? page + 1 : null;
  if (ev.key === 'ArrowLeft') return page > 0 ? page - 1 : null;
  return null;
}
