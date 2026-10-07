// 이야기를 이어 갈 수 없을 때 보이는 화면. 빈 화면에서 멈추지 않고 처음으로 돌아갈 수 있게 한다.
// (엔진이 던졌거나 화면을 그리다 잘못이 났을 때. 까닭은 콘솔에 남는다.)

import type { JSX } from 'preact';

export function Trouble({ onHome }: { onHome: () => void }): JSX.Element {
  return (
    <main class="screen trouble">
      <div class="trouble-box" role="alert">
        <h1 class="screen-title">이야기를 이어 갈 수 없어요</h1>
        <p class="story">아직 준비가 덜 된 곳을 만났어요. 처음 화면으로 돌아가서 다시 시작해 주세요.</p>
        <button type="button" class="btn primary" onClick={onHome}>
          처음으로
        </button>
      </div>
    </main>
  );
}
