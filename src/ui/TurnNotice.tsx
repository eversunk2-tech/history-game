// 세로 안내: 태블릿을 세로로 들면 "가로로 돌려 주세요"만 보인다.
// 매니페스트가 가로로 못 박지만 아이패드에서 듣는지 확인되지 않았고, 브라우저 탭에서는 듣지 않는다.
// 보이고 안 보이는 것은 CSS가 정한다(태블릿이고 세로일 때만 — device.css).
// 떠 있는 동안에는 자판도 밑의 화면으로 통하지 않게 한다(자판 덮개를 단 태블릿에서 주인공이 걷거나 Tab이 밑의 단추로 가지 않게).

import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { deviceKind } from '../state/device';

/** 세로 안내가 떠 있을 때인가: 태블릿이고 화면이 세로일 때(CSS의 조건과 같다) */
export function turnNeeded(kind: string, portrait: boolean): boolean {
  return kind !== 'other' && portrait;
}

export function TurnNotice(): JSX.Element {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (deviceKind === 'other' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(orientation: portrait)');
    const check = (): void => setOn(turnNeeded(deviceKind, query.matches));
    check();
    query.addEventListener?.('change', check);
    window.addEventListener('resize', check);
    return () => {
      query.removeEventListener?.('change', check);
      window.removeEventListener('resize', check);
    };
  }, []);
  useEffect(() => {
    if (!on) return;
    // 누르고 있던 화살표가 남지 않게 맵에 알린다(맵은 창이 초점을 잃으면 누른 글쇠를 비운다)
    window.dispatchEvent(new Event('blur'));
    // 떠 있는 동안의 자판 누름은 여기서 삼킨다(밑의 화면이 받기 전에)
    const swallow = (ev: KeyboardEvent): void => {
      ev.stopImmediatePropagation();
      ev.preventDefault();
    };
    window.addEventListener('keydown', swallow, true);
    window.addEventListener('keyup', swallow, true);
    // 초점이 밑의 단추에 남아 있지 않게 한다
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    return () => {
      window.removeEventListener('keydown', swallow, true);
      window.removeEventListener('keyup', swallow, true);
    };
  }, [on]);
  // 떠 있는 동안에는 얹힌 창으로 알린다(맵은 얹힌 창이 있으면 걷기를 멈춘다)
  return (
    <div class="turn" role={on ? 'alertdialog' : undefined} aria-modal={on ? 'true' : undefined} aria-label={on ? '태블릿을 가로로 돌려 주세요' : undefined} aria-hidden={on ? undefined : 'true'}>
      <div class="turn-box">
        <span class="turn-tablet" aria-hidden="true" />
        <p class="turn-ask">태블릿을 가로로 돌려 주세요.</p>
        <p class="turn-note">이 놀이는 가로 화면에서 해요.</p>
      </div>
    </div>
  );
}
