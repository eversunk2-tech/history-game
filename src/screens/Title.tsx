// 1. 제목(spec 11.1 가 1) — 이어 하기 · 처음부터 · 수첩·선생님 자료(준비 중 — ㉤). 부제 "느티나무 마을". 귀퉁이에 판 번호(미리 보기 판은 가지 이름도).
// 저장을 읽은 결과에 따라 쉬운 말의 알림이 뜬다: 옛 저장(꼴 2~4)이면 "게임이 새로워져서 처음부터 해요" 한 번(옛 글자는 joseon-year/backup에 한 벌).
// "처음부터"는 기록이 있으면 두 번 묻는다(모두 지우고 처음부터 — 3판의 "다시 하기와 '모두 지우고 처음부터'(두 번 묻는다)").

import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Scenery } from '../art/Scenery';
import { getPack } from '../content';
import { notices } from '../content/hub';
import type { Load5Status } from '../state/save5';
import { BUILD } from '../state/storage';
import { canContinue, continueGame, episodeOf, goSheet, loadStatus, save, startFresh } from '../state/store';
import { inTabOnTablet, standalone } from '../state/device';
import { Ask } from '../ui/Ask';
import { DeviceInfo } from '../ui/DeviceInfo';
import { InstallGuide } from '../ui/InstallGuide';
import { prewarmGame } from './prewarm';

/** 저장을 읽은 결과를 알리는 말(없으면 알리지 않는다) */
const NOTICES: Partial<Record<Load5Status, string>> = {
  noStorage: '이 창에서는 기록이 남지 않아요.',
  old: `${notices.oldSave}.`,
  unreadable: '기록을 읽을 수 없어서 처음부터 해요.',
  newer: '게임을 새로 받아야 해요. 이 화면을 닫고 다시 열어 주세요.',
  trimmed: '기록 가운데 읽을 수 없는 것이 있어서 빼 두었어요. 나머지는 그대로예요.',
};

/** 이어 하기 한 줄: 하던 에피소드가 있으면 "「새 도읍의 봄」 · 현장/큰 고비/결과", 없으면 "느티나무 마을 · 레벨 2" */
function savedLine(): string {
  const s = save.value;
  const cur = s.current;
  const ep = episodeOf(cur?.episode);
  if (cur && ep) {
    const where = cur.phase === 'field' ? '현장' : cur.phase === 'battle' ? '큰 고비 앞' : '결과 종이';
    return `「${ep.title}」 · ${where}`;
  }
  return `느티나무 마을 · 레벨 ${s.hero.level}`;
}

/** 지울 기록이 있는가(처음부터를 두 번 묻는다) */
function hasRecord(): boolean {
  const s = save.value;
  return s.hub.intro || Boolean(s.current) || Object.keys(s.stories).length > 0 || s.hero.level > 1;
}

// 이 창에서(다시 불러오기 전까지) 안내를 이미 닫았는가, 탭에서 시작한다는 것을 이미 알렸는가
let guideClosed = false;
let tabWarned = false;

export function Title(): JSX.Element {
  const [ask, setAsk] = useState<'wipe' | 'wipeAgain' | 'tab' | null>(null);
  // 홈 화면에 추가하는 법: 브라우저 탭으로 연 태블릿이면 저절로 뜬다(auto). 닫아도 아래 단추로 다시 볼 수 있다(manual).
  const [guide, setGuide] = useState<'auto' | 'manual' | null>(null);
  const [info, setInfo] = useState(false);
  useEffect(() => {
    if (inTabOnTablet() && !guideClosed) setGuide('auto');
  }, []);
  // "이어 하기"를 누르기 전에 그 판의 맵을 미리 짓는다(누르면 바로 뜨게 — spec 4.7.5의 ㅋ)
  useEffect(() => {
    const cur = save.value.current;
    return cur?.phase === 'field' ? prewarmGame(getPack(cur.game.situationId), cur.game) : () => undefined;
  }, [save.value.current]);
  const closeGuide = (): void => {
    guideClosed = true;
    setGuide(null);
  };
  const status = loadStatus.value;
  const notice = NOTICES[status];
  // 코드보다 새 꼴의 저장을 만났으면 저장을 건드리지 않게 시작을 막는다
  const blocked = status === 'newer';
  const resume = canContinue.value;

  const begin = (): void => {
    if (hasRecord()) setAsk('wipe');
    else startFresh();
  };
  const start = (): void => {
    if (blocked) return;
    // 탭으로 연 태블릿에서 새로 시작하려 하면 한 번 더 알린다(탭의 기록은 홈 화면의 게임으로 넘어가지 않을 수 있다)
    if (inTabOnTablet() && !tabWarned) setAsk('tab');
    else begin();
  };

  return (
    <main class="screen title season-spring">
      <div class="title-art">
        <Scenery story="s1395" place="entrance" season="spring" label="느티나무가 선 마을 어귀" />
      </div>
      <div class="title-box">
        <p class="kicker">느티나무 마을</p>
        <h1 class="title-name">
          조선에서
          <br />한 해 살기
        </h1>
        <p class="title-lead">오백 년을 산 느티나무의 정령과 함께 옛 시대로 가요. 그때 사람이 되어 고비를 넘겨 보아요.</p>

        {notice && (
          <p class="title-notice" role="status">
            <span class="title-notice-mark" aria-hidden="true">
              !
            </span>
            {notice}
          </p>
        )}

        <div class="title-buttons">
          {resume && (
            <button type="button" class="btn primary title-resume" disabled={blocked} onClick={continueGame}>
              <span>이어 하기</span>
              <span class="title-saved">{savedLine()}</span>
            </button>
          )}
          <button type="button" class={`btn${resume ? '' : ' primary'}`} disabled={blocked} onClick={start}>
            처음부터
          </button>
          <div class="title-pair">
            <button type="button" class="btn" disabled>
              수첩 <span class="soon">준비 중</span>
            </button>
            <button type="button" class="btn" disabled>
              선생님 자료 <span class="soon">준비 중</span>
            </button>
          </div>
          <div class="title-small">
            {!standalone.value && (
              <button type="button" class="btn small" onClick={() => setGuide('manual')}>
                홈 화면에 추가
              </button>
            )}
            {import.meta.env.DEV && (
              <button type="button" class="btn small title-devbtn" onClick={goSheet}>
                그림 견본(개발용)
              </button>
            )}
          </div>
        </div>
        <button type="button" class="title-build" onClick={() => setInfo(true)} aria-label={`판 ${BUILD}. 이 기기의 정보 보기`}>
          판 {BUILD} · 이 기기
        </button>
      </div>

      {guide && !ask && !info && <InstallGuide auto={guide === 'auto'} onClose={closeGuide} />}
      {info && (
        <DeviceInfo
          onClose={() => setInfo(false)}
          onGuide={() => {
            setInfo(false);
            setGuide('manual');
          }}
        />
      )}
      {ask === 'tab' && (
        <Ask
          ask="이 창에서 시작할까요?"
          note="이 창에서 한 기록은 홈 화면의 게임으로 넘어가지 않을 수 있어요. 먼저 홈 화면에 추가하면 기록이 안전해요."
          yes="이 창에서 시작하기"
          no="추가하는 법 보기"
          onNo={() => {
            setAsk(null);
            setGuide('manual');
          }}
          onYes={() => {
            tabWarned = true;
            setAsk(null);
            begin();
          }}
        />
      )}
      {ask === 'wipe' && (
        <Ask
          ask="처음부터 다시 할까요?"
          note="지금까지의 기록(레벨, 별, 카드, 하던 이야기)이 모두 사라져요."
          yes="지울래요"
          no="그만둘래요"
          onNo={() => setAsk(null)}
          onYes={() => setAsk('wipeAgain')}
        />
      )}
      {ask === 'wipeAgain' && (
        <Ask
          key="again"
          ask="정말 모두 지울까요?"
          note="지우면 되돌릴 수 없어요."
          yes="모두 지운다"
          no="그만둘래요"
          onNo={() => setAsk(null)}
          onYes={() => {
            setAsk(null);
            startFresh();
          }}
        />
      )}
    </main>
  );
}
