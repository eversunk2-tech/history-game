// 화면 차례: 제목 → 이야기책 → 누가 될까 → 나를 소개합니다 → 맵(그 위에 대화 장면·미션이 풀림·봇짐·지난 이야기가 얹힌다)
//            → 계절 닫기 → (다음 계절의 맵 | "다음에 만들어요").
// 한 해 돌아보기, 견주어 보기, 생각 나눔, 수첩, 선생님 자료는 뒤 바퀴에서 더한다.

import { Component, type ComponentChildren, type JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { preloadStory } from '../art/pictures';
import { Book } from '../screens/Book';
import { Intro } from '../screens/Intro';
import { MapScreen } from '../screens/MapScreen';
import { Next } from '../screens/Next';
import { RolePick } from '../screens/RolePick';
import { SeasonClose } from '../screens/SeasonClose';
import { Sheet } from '../screens/Sheet';
import { Title } from '../screens/Title';
import { Trouble } from '../screens/Trouble';
import { askingHome, cancelHome, game, goHome, noteTrouble, pack, screen, seed, situationId } from '../state/store';
import { Ask } from '../ui/Ask';

/** "처음으로"를 눌렀을 때 한 번 묻는다. 하던 해는 저장되어 있어 "이어 하기"로 돌아올 수 있다. */
function HomeConfirm(): JSX.Element {
  return (
    <Ask
      ask="처음 화면으로 돌아갈까요?"
      note="하던 이야기는 적어 두었어요. “이어 하기”로 돌아올 수 있어요."
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
  switch (screen.value) {
    case 'title':
      return <Title />;
    case 'book':
      return <Book />;
    case 'rolePick':
      // key: 다시 할 때마다 패를 새로 덮는다
      return p ? <RolePick key={seed.value} /> : <Title />;
    case 'intro':
      return p && g ? <Intro /> : <Title />;
    case 'map':
      // 판이 없는데 맵에 남아 있으면 그릴 것이 없다. 빈 화면 대신 알린다.
      return p && g && g.phase === 'season' ? <MapScreen /> : <Trouble onHome={goHome} />;
    case 'seasonClose':
      return p && g ? <SeasonClose /> : <Trouble onHome={goHome} />;
    case 'next':
      return p && g ? <Next /> : <Trouble onHome={goHome} />;
    case 'trouble':
      return <Trouble onHome={goHome} />;
    case 'sheet':
      return <Sheet />;
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
  // 이야기를 열면 그 이야기의 대화 장면 그림을 뒤에서 미리 받아 둔다(대화 장면이 뜰 때 기다리지 않게)
  const story = situationId.value;
  useEffect(() => {
    if (story) preloadStory(story);
  }, [story]);
  return (
    <div class="stage">
      <Guard>
        <Current />
        {askingHome.value && <HomeConfirm />}
      </Guard>
    </div>
  );
}
