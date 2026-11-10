// 2. 모습 고르기 — 거점의 주인공(남자아이·여자아이 — spec 7.6, 11.1 가 2). 거점·포목점·서당에서 이 모습이다.
// 현장에서는 그 에피소드의 역할과 모습이다(출전 준비에서 이 모습을 따르되 바꿀 수 있다 — 11.1 가 6).
// 처음 시작할 때 한 번 "시험 판이라 기록이 지워질 수 있어요"를 알린다(13.2의 11·23번).

import type { JSX } from 'preact';
import { notices } from '../content/hub';
import { backToTitle, pickLook, save } from '../state/store';
import { LookCards } from './RolePick';

export function LookPick(): JSX.Element {
  const s = save.value;
  const trial = !s.hub.seen.includes('trial');
  return (
    <main class="screen rolepick lookpick season-spring">
      <header class="role-head">
        <div>
          <p class="kicker">느티나무 마을</p>
          <h1 class="screen-title">어떤 모습으로 살아 볼까요?</h1>
          <p class="role-guide">마을과 옛 시대를 오갈 나의 모습이에요. 옛 시대에 가면 그 집 아이의 차림이 돼요.</p>
        </div>
        <button type="button" class="btn small" onClick={backToTitle}>
          <span aria-hidden="true">← </span>처음으로
        </button>
      </header>
      {trial && (
        <p class="title-notice look-trial" role="status">
          <span class="title-notice-mark" aria-hidden="true">
            !
          </span>
          {notices.trial}.
        </p>
      )}
      <LookCards story="s1395" role="farmer" looks={['boy', 'girl']} onPick={pickLook} />
    </main>
  );
}
