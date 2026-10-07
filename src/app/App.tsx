// 화면 차례: 제목 → 시기와 상황 고르기 → 태어날 집 뽑기 → 나를 소개합니다
//            → 계절 × 4(열기 → 장면 → 결과 → 장면 → 결과 → 닫기) → 한 해 돌아보기.
// 견주어 보기, 생각 나눔, 수첩, 선생님 자료는 뒤 바퀴에서 더한다.

import { Component, type ComponentChildren, type JSX } from 'preact';
import { currentSeason } from '../engine/game';
import { Intro } from '../screens/Intro';
import { Pick } from '../screens/Pick';
import { Result } from '../screens/Result';
import { RoleDraw } from '../screens/RoleDraw';
import { SceneScreen } from '../screens/Scene';
import { SeasonClose } from '../screens/SeasonClose';
import { SeasonOpen } from '../screens/SeasonOpen';
import { Title } from '../screens/Title';
import { Trouble } from '../screens/Trouble';
import { YearReview } from '../screens/YearReview';
import { askingHome, cancelHome, game, goHome, pack, review, screen, seed } from '../state/store';
import { Hud } from '../ui/Hud';

function Play(): JSX.Element | null {
  const p = pack.value;
  const g = game.value;
  if (!p || !g) return null;
  return (
    <main class={`screen play season-${currentSeason(g)}`}>
      <Hud pack={p} game={g} />
      {g.phase === 'seasonOpen' && <SeasonOpen pack={p} game={g} />}
      {g.phase === 'scene' && <SceneScreen pack={p} game={g} />}
      {g.phase === 'result' && <Result pack={p} game={g} />}
      {g.phase === 'seasonClose' && <SeasonClose pack={p} game={g} />}
    </main>
  );
}

function HomeConfirm(): JSX.Element {
  return (
    <div class="veil" role="dialog" aria-modal="true" aria-label="처음으로 돌아가기">
      <div class="veil-box">
        <p class="veil-ask">처음 화면으로 돌아갈까요?</p>
        <p class="veil-note">지금 살던 한 해는 여기서 멈춰요.</p>
        <div class="veil-buttons">
          <button type="button" class="btn primary" onClick={cancelHome}>
            계속 살기
          </button>
          <button type="button" class="btn" onClick={goHome}>
            처음으로
          </button>
        </div>
      </div>
    </div>
  );
}

function Current(): JSX.Element | null {
  const p = pack.value;
  const g = game.value;
  switch (screen.value) {
    case 'title':
      return <Title />;
    case 'pick':
      return <Pick />;
    case 'roleDraw':
      // key: 다시 할 때마다 패를 새로 덮는다
      return p ? <RoleDraw key={seed.value} pack={p} /> : <Title />;
    case 'intro':
      return p && g ? <Intro pack={p} game={g} /> : <Title />;
    case 'play':
      // 한 해가 끝났는데 계절 화면에 남아 있으면 그릴 것이 없다. 빈 화면 대신 알린다.
      return p && g && g.phase !== 'done' ? <Play /> : <Trouble onHome={goHome} />;
    case 'review': {
      const r = review.value;
      return p && r ? <YearReview pack={p} review={r} /> : <Trouble onHome={goHome} />;
    }
    case 'trouble':
      return <Trouble onHome={goHome} />;
  }
}

/**
 * 화면을 그리다 잘못이 나면(엔진이 던지는 것 포함) 빈 화면이 되는 대신 '이어 갈 수 없어요'를 보여 준다.
 * "처음으로"를 누르면 판을 비우고 제목으로 돌아간다.
 */
class Guard extends Component<{ children: ComponentChildren }, { broken: boolean }> {
  state = { broken: false };

  static getDerivedStateFromError(): { broken: boolean } {
    return { broken: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('[조선에서 한 해 살기] 화면을 그리다 멈췄다:', error);
  }

  render(): ComponentChildren {
    if (!this.state.broken) return this.props.children;
    return (
      <Trouble
        onHome={() => {
          goHome();
          this.setState({ broken: false });
        }}
      />
    );
  }
}

export function App(): JSX.Element {
  return (
    <div class="stage">
      <Guard>
        <Current />
        {askingHome.value && <HomeConfirm />}
      </Guard>
    </div>
  );
}
