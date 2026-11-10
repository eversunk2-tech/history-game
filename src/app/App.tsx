// 화면 차례(4판의 출전 고리 — spec 11.1 가): 제목 → 모습 고르기 → 마을 소개 → 거점(㉢은 임시 마을 종이) → 알림판 · 시간의 문(연표)
//   → 출전 준비 → 의뢰 소개 → 현장(맵 — 그 위에 대화 장면·미션이 풀림·봇짐·지난 이야기, 대화 장면 안에 작은 고비)
//   → 큰 고비(겨루기) → 결과 종이 → 자람 → 거점.
// 3판의 한 해 화면(이야기책·계절 닫기·한 해 돌아보기·"다음에 만들어요")은 지웠다(spec 11.1 가의 "버린다").

import { signal } from '@preact/signals';
import { Component, type ComponentChildren, type JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { preloadEpisode } from '../art/pictures';
import { BattleScreen } from '../screens/Battle';
import { Board } from '../screens/Board';
import { EpisodeDone, Growth } from '../screens/EpisodeDone';
import { Gate } from '../screens/Gate';
import { Hub } from '../screens/Hub';
import { HubIntro } from '../screens/HubIntro';
import { Intro } from '../screens/Intro';
import { LookPick } from '../screens/LookPick';
import { MapScreen } from '../screens/MapScreen';
import { Prep } from '../screens/Prep';
import { Title } from '../screens/Title';
import { Trouble } from '../screens/Trouble';
import { askingHome, cancelHome, devField, episodeId, game, goHome, noteTrouble, pack, prepFor, run, screen, seed } from '../state/store';
import { Ask } from '../ui/Ask';
import { TurnNotice } from '../ui/TurnNotice';

/**
 * 개발용 "그림 견본" 화면: 개발 서버에서만 따로 불러온다(빌드본에는 그 코드가 들어가지 않는다 — review 37번 ㉡).
 * 빌드에서는 import.meta.env.DEV가 거짓이라 이 불러오기가 통째로 빠진다.
 */
const sheetView = signal<(() => JSX.Element) | null>(null);
if (import.meta.env.DEV) {
  void import('../screens/Sheet').then((m) => {
    sheetView.value = m.Sheet;
  });
}

/** "처음으로"를 눌렀을 때 한 번 묻는다. 하던 해는 저장되어 있어 "이어 하기"로 돌아올 수 있다. */
function HomeConfirm(): JSX.Element {
  return (
    <Ask
      ask="처음 화면으로 돌아갈까요?"
      note={screen.value === 'battle' ? '하던 것은 적어 두었어요. 겨루기는 “이어 하기”로 돌아오면 처음부터 다시 해요.' : '하던 것은 적어 두었어요. “이어 하기”로 돌아올 수 있어요.'}
      yes="처음으로"
      no="계속 하기"
      onYes={goHome}
      onNo={cancelHome}
    />
  );
}

function Current(): JSX.Element | null {
  const p = pack.value;
  const g = game.value;
  const r = run.value;
  switch (screen.value) {
    case 'title':
      return <Title />;
    case 'look':
      return <LookPick />;
    case 'hubIntro':
      return <HubIntro />;
    case 'hub':
      return <Hub />;
    case 'board':
      return <Board />;
    case 'gate':
      return <Gate />;
    case 'prep':
      // key: 다시 고를 때마다 패를 새로 덮는다
      return prepFor.value ? <Prep key={seed.value} /> : <Hub />;
    case 'intro':
      return p && g ? <Intro /> : <Trouble onHome={goHome} />;
    case 'map':
      // 판이 없는데 맵에 남아 있으면 그릴 것이 없다. 빈 화면 대신 알린다.
      return p && g && g.phase === 'season' && (r?.phase === 'field' || devField.value) ? <MapScreen /> : <Trouble onHome={goHome} />;
    case 'battle':
      return p && g && r?.phase === 'battle' ? <BattleScreen /> : <Trouble onHome={goHome} />;
    case 'result':
      return r?.phase === 'result' ? <EpisodeDone /> : <Trouble onHome={goHome} />;
    case 'growth':
      return <Growth />;
    case 'trouble':
      return <Trouble onHome={goHome} />;
    case 'sheet': {
      const SheetView = sheetView.value;
      return SheetView ? <SheetView /> : <Trouble onHome={goHome} />;
    }
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
    noteTrouble();
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
  // 에피소드를 열면 그 에피소드의 대화 장면·겨루기 그림을 뒤에서 미리 받아 둔다(대화 장면이 뜰 때 기다리지 않게 — 의뢰 소개가 떠 있는 동안)
  const ep = episodeId.value;
  useEffect(() => {
    if (ep) preloadEpisode(ep);
  }, [ep]);
  return (
    <div class="stage">
      <Guard>
        <Current />
        {askingHome.value && <HomeConfirm />}
      </Guard>
      <TurnNotice />
    </div>
  );
}
