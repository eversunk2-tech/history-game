// 세로 안내: 태블릿을 세로로 들면 "가로로 돌려 주세요"만 보인다.
// 매니페스트가 가로로 못 박지만 아이패드에서 듣는지 확인되지 않았고, 브라우저 탭에서는 듣지 않는다.
// 보이고 안 보이는 것은 CSS가 정한다(태블릿이고 세로일 때만 — device.css).
// 떠 있는 동안에는 자판도 밑의 화면으로 통하지 않게 한다(자판 덮개를 단 태블릿에서 주인공이 걷거나 Tab이 밑의 단추로 가지 않게).
// 안내가 걷히면 초점을 지우기 전의 자리로 돌려준다(자판으로 바로 이어 하게).
// 대화 장면·종이·물음 같은 얹힌 창이 떠 있어도 마찬가지다: 창 전체의 자판을 맨 먼저 받는 문지기를 이 파일이 불릴 때
// (어떤 창이 뜨기도 전에) 걸어 두고, 세로가 되는 바로 그때 막는다(focus.ts의 holdKeys — 얹힌 창의 자판 처리도 스스로 물러난다).

import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { deviceKind } from '../state/device';
import { guardKeys, holdKeys } from './focus';

// 문지기는 앱이 뜰 때 한 번 건다(얹힌 창들이 자기 것을 걸기 전에). 막혀 있지 않을 때는 아무것도 하지 않는다.
if (typeof window !== 'undefined') guardKeys(window);

/** 세로 안내가 떠 있을 때인가: 태블릿이고 화면이 세로일 때(CSS의 조건과 같다) */
export function turnNeeded(kind: string, portrait: boolean): boolean {
  return kind !== 'other' && portrait;
}

export function TurnNotice(): JSX.Element {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (deviceKind === 'other' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(orientation: portrait)');
    const check = (): void => {
      const need = turnNeeded(deviceKind, query.matches);
      // 자판은 그 자리에서 바로 막는다(화면이 다시 그려지기를 기다리지 않는다)
      holdKeys(need);
      setOn(need);
    };
    check();
    query.addEventListener?.('change', check);
    window.addEventListener('resize', check);
    return () => {
      query.removeEventListener?.('change', check);
      window.removeEventListener('resize', check);
      holdKeys(false);
    };
  }, []);
  useEffect(() => {
    if (!on) return;
    // 누르고 있던 화살표가 남지 않게 맵에 알린다(맵은 창이 초점을 잃으면 누른 글쇠를 비운다)
    window.dispatchEvent(new Event('blur'));
    // 초점이 밑의 단추에 남아 있지 않게 한다. 안내가 걷히면 그 자리로 돌려준다(Review 1-라 28번 ㉢ —
    // 돌려주지 않으면 종이·놀이는 첫 Enter가 초점만 데려오고, 계절 닫기·돌아보기는 Tab을 한 번 눌러야 했다).
    const kept = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    kept?.blur();
    return () => {
      if (kept && document.contains(kept) && !(kept as HTMLButtonElement).disabled) kept.focus({ preventScroll: true });
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
