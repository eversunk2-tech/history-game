// 얹힌 창(대화 장면, 종이, 물음)의 자판과 초점.
// 창이 뜨면 초점을 창 안으로 옮기고, Tab이 창 뒤의 단추로 새지 않게 하고, 닫히면 초점을 원래 자리로 돌려준다.
// 창이 떠 있는 동안에는 자판 누름이 창 뒤의 맵으로 가지 않는다(맵이 걷거나 말을 걸지 않게).
// 창 안에서 생긴 누름은 창 안의 것(일 놀이의 캔버스 등)이 먼저 받는다.

import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** 떠 있는 창들(맨 위의 것만 자판을 받는다) */
const stack: symbol[] = [];

// ── 자판 막기 ── 세로 안내가 화면을 덮고 있는 동안에는 어떤 창이 떠 있어도 자판이 밑으로 통하지 않는다.
// (얹힌 창은 뜰 때 창 전체의 자판을 먼저 잡는 자리에 걸어 두므로, 나중에 걸린 것이 삼켜서는 늦다 — 태블릿 바퀴 Review 9번.)
// 두 겹으로 막는다: ㉠ 앱이 뜰 때 맨 먼저 걸어 두는 문지기(guardKeys)가 삼키고 ㉡ 얹힌 창의 자판 처리도 스스로 물러난다.

let keysHeld = false;

/** 자판을 막거나 푼다(세로 안내가 뜨고 질 때 부른다) */
export function holdKeys(on: boolean): void {
  keysHeld = on;
}

export function keysAreHeld(): boolean {
  return keysHeld;
}

type KeyLike = Pick<Event, 'stopImmediatePropagation' | 'preventDefault'>;

/** 막혀 있는 동안의 누름이면 삼키고 true를 돌려준다(뒤에 걸린 것과 밑의 화면이 받지 못한다) */
export function swallowIfHeld(ev: KeyLike): boolean {
  if (!keysHeld) return false;
  ev.stopImmediatePropagation();
  ev.preventDefault();
  return true;
}

/**
 * 창 전체의 자판 누름을 맨 먼저 받는 문지기를 건다. 얹힌 창이 뜨기 전에(앱이 뜰 때) 한 번 걸어 둔다.
 * 막혀 있지 않을 때는 아무것도 하지 않는다. 돌려주는 함수로 거둔다.
 */
export function guardKeys(target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>): () => void {
  const swallow = (ev: Event): void => {
    swallowIfHeld(ev);
  };
  const kinds = ['keydown', 'keyup', 'keypress'];
  // 먼저 잡는 자리(capture)에 건다
  const first = { capture: true };
  for (const kind of kinds) target.addEventListener(kind, swallow, first);
  return () => {
    for (const kind of kinds) target.removeEventListener(kind, swallow, first);
  };
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/** 창 안에서 먼저 초점을 받을 것: data-autofocus가 붙은 것 → 첫 단추 → 창 자신 */
export function focusInto(root: HTMLElement): void {
  const target = root.querySelector<HTMLElement>('[data-autofocus]:not([disabled])') ?? focusables(root)[0] ?? root;
  if (target === root && !root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

const isPress = (ev: KeyboardEvent): boolean => ev.key === 'Enter' || ev.key === ' ';

/**
 * 얹힌 창의 자판을 맡는다. onKey는 Tab이 아닌 누름을 받는다(Enter, Space, Escape …).
 * 단추 위에서 누른 Enter·Space는 단추가 스스로 눌리므로 onKey로 오지 않는다.
 */
export function useModalKeys(ref: RefObject<HTMLElement | null>, onKey?: (ev: KeyboardEvent) => void): void {
  const handler = useRef(onKey);
  handler.current = onKey;
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const id = Symbol('modal');
    stack.push(id);
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusInto(root);
    const onTop = (): boolean => stack[stack.length - 1] === id;

    // 창 밖에서 생긴 누름과 Tab: 창 뒤로 가기 전에 먼저 잡는다
    const outside = (ev: KeyboardEvent): void => {
      if (swallowIfHeld(ev)) return; // 세로 안내가 덮고 있다
      if (!onTop()) return;
      const inside = ev.target instanceof Node && root.contains(ev.target);
      if (ev.key === 'Tab') {
        const items = focusables(root);
        const active = document.activeElement as HTMLElement | null;
        const at = active ? items.indexOf(active) : -1;
        if (items.length === 0) {
          ev.preventDefault();
          focusInto(root);
        } else if (at < 0 || !inside) {
          // 초점이 창 안의 단추에 있지 않다(창 자신이나 묶음에 있다): 창이 정한 첫 자리(data-first-tab)로, 없으면 첫 단추로
          ev.preventDefault();
          (root.querySelector<HTMLElement>('[data-first-tab]') ?? items[0]).focus();
        } else if (ev.shiftKey && at === 0) {
          ev.preventDefault();
          items[items.length - 1].focus();
        } else if (!ev.shiftKey && at === items.length - 1) {
          ev.preventDefault();
          items[0].focus();
        }
        return;
      }
      if (inside) return; // 창 안의 것은 아래 within이 받는다
      // 초점이 창 뒤에 가 있었다: 창 뒤의 단추가 눌리지 않게 하고 초점을 데려온다
      ev.stopPropagation();
      if (isPress(ev)) ev.preventDefault();
      focusInto(root);
      if (ev.repeat && isPress(ev)) return;
      handler.current?.(ev);
    };

    // 창 안에서 생긴 누름: 안의 것이 먼저 받고, 여기서 멈춘다(창 뒤의 맵으로 올라가지 않는다)
    const within = (ev: KeyboardEvent): void => {
      if (swallowIfHeld(ev)) return; // 세로 안내가 덮고 있다
      ev.stopPropagation();
      if (!onTop() || ev.key === 'Tab') return;
      // 자판을 누르고 있어서 되풀이되는 누름은 받지 않는다(대화가 줄줄이 넘어가거나 선택지가 저절로 골라지지 않게)
      if (ev.repeat && isPress(ev)) {
        ev.preventDefault();
        return;
      }
      if (isPress(ev) && ev.target instanceof HTMLButtonElement) return; // 단추가 스스로 눌린다
      handler.current?.(ev);
    };

    window.addEventListener('keydown', outside, true);
    root.addEventListener('keydown', within);
    return () => {
      window.removeEventListener('keydown', outside, true);
      root.removeEventListener('keydown', within);
      const at = stack.indexOf(id);
      if (at >= 0) stack.splice(at, 1);
      if (before && document.contains(before) && !(before as HTMLButtonElement).disabled) before.focus({ preventScroll: true });
    };
  }, []);
}
