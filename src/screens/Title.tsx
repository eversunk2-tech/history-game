// 1. 제목 — 이어 하기, 처음부터, 수첩·선생님 자료(준비 중), 모두 지우고 처음부터.
// 귀퉁이에 게임의 판 번호. 저장을 읽은 결과에 따라 쉬운 말의 알림이 뜬다.

import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Scenery } from '../art/Scenery';
import { getPack } from '../content';
import { seasonLabels } from '../content/labels';
import { seasonReady } from '../engine/game';
import { SEASONS } from '../engine/types';
import { BUILD, type LoadStatus } from '../state/storage';
import { canContinue, continueGame, dropCurrent, goBook, goSheet, loadStatus, save, wipeAll } from '../state/store';
import { inTabOnTablet, standalone } from '../state/device';
import { Ask } from '../ui/Ask';
import { DeviceInfo } from '../ui/DeviceInfo';
import { InstallGuide } from '../ui/InstallGuide';

/** 저장을 읽은 결과를 알리는 말(없으면 알리지 않는다) */
const NOTICES: Partial<Record<LoadStatus, string>> = {
  noStorage: '이 창에서는 기록이 남지 않아요.',
  yearLost: '게임이 새로워져서 이 해는 봄부터 다시 해요. 깬 이야기와 수첩은 그대로예요.',
  unreadable: '기록을 읽을 수 없어서 처음부터 해요.',
  newer: '게임을 새로 받아야 해요. 이 화면을 닫고 다시 열어 주세요.',
};

/**
 * 하던 이야기 한 줄: "1395년 봄 · 농민 집 아이".
 * 만들어진 계절을 다 보내고 다음 계절이 아직 없는 저장이면 "1395년 봄까지 했어요 · 농민 집 아이"로 사실대로 적는다
 * (눌러 보면 "여름은 다음에 만들어요"가 뜨는데 "1395년 여름"이라고 적지 않는다).
 */
function savedLine(): string {
  const cur = save.value.current;
  const p = cur ? getPack(cur.situationId) : undefined;
  if (!cur || !p) return '';
  const index = Math.max(0, Math.min(cur.seasonIndex, SEASONS.length - 1));
  const role = p.situation.roles.find((r) => r.id === cur.role)?.label ?? '';
  const tail = role ? ` · ${role}` : '';
  if (cur.phase === 'season' && index > 0 && !seasonReady(p, cur.role, SEASONS[index])) {
    return `${p.situation.year}년 ${seasonLabels[SEASONS[index - 1]].label}까지 했어요${tail}`;
  }
  return `${p.situation.year}년 ${seasonLabels[SEASONS[index]].label}${tail}`;
}

// 이 창에서(다시 불러오기 전까지) 안내를 이미 닫았는가, 탭에서 시작한다는 것을 이미 알렸는가
let guideClosed = false;
let tabWarned = false;

export function Title(): JSX.Element {
  const [ask, setAsk] = useState<'restart' | 'wipe' | 'wipeAgain' | 'tab' | null>(null);
  // 홈 화면에 추가하는 법: 브라우저 탭으로 연 태블릿이면 저절로 뜬다(auto). 닫아도 아래 단추로 다시 볼 수 있다(manual).
  const [guide, setGuide] = useState<'auto' | 'manual' | null>(null);
  const [info, setInfo] = useState(false);
  useEffect(() => {
    if (inTabOnTablet() && !guideClosed) setGuide('auto');
  }, []);
  const closeGuide = (): void => {
    guideClosed = true;
    setGuide(null);
  };
  const status = loadStatus.value;
  const notice = NOTICES[status];
  // 코드보다 새 꼴의 저장을 만났으면 저장을 건드리지 않게 시작을 막는다
  const blocked = status === 'newer';
  const resume = canContinue.value;
  const inYear = Boolean(save.value.current);

  const begin = (): void => {
    if (inYear) setAsk('restart');
    else goBook();
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
        <p class="kicker">조선 시대 마을 느티골 이야기</p>
        <h1 class="title-name">
          조선에서
          <br />한 해 살기
        </h1>
        <p class="title-lead">그때 사람이 되어 봄, 여름, 가을, 겨울을 살아 보아요. 내가 고르는 대로 한 해가 흘러가요.</p>

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
            <button type="button" class="btn small" disabled={blocked} onClick={() => setAsk('wipe')}>
              모두 지우고 처음부터
            </button>
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
      {ask === 'restart' && (
        <Ask
          ask="처음부터 다시 할까요?"
          note="하던 이야기는 지워져요. 깬 이야기와 수첩은 그대로예요."
          yes="처음부터 한다"
          no="그만둘래요"
          onNo={() => setAsk(null)}
          onYes={() => {
            setAsk(null);
            dropCurrent();
            goBook();
          }}
        />
      )}
      {ask === 'wipe' && (
        <Ask
          ask="기록을 모두 지울까요?"
          note="하던 이야기, 깬 이야기, 수첩이 모두 사라져요."
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
            wipeAll();
          }}
        />
      )}
    </main>
  );
}
