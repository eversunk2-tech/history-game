// 홈 화면에 추가하는 법(spec 5.4의 안내). 그림 없이 세 걸음, 그 기기의 순서만 보인다.
// 브라우저 탭으로 연 태블릿의 제목 화면에 저절로 뜨고, 닫아도 제목 화면의 단추로 다시 볼 수 있다.
// 뼈대: 먼저 홈 화면에 추가하고, 늘 아이콘(느티나무)으로 연다. 아이콘으로 열 때도 와이파이가 있어야 한다.
// 메뉴와 단추의 이름·자리는 크롬 판마다 다를 수 있다(실제 기기의 점검표에서 보고 맞춘다).
//
// 브라우저가 설치 물음을 띄울 수 있다고 알려 왔으면(크롬 엔진) 기기를 어떻게 가렸든 "홈 화면에 추가" 단추 하나를 보인다.
// 안내의 모양은 뜰 때 정하고 읽는 도중에 갈아 끼우지 않는다: 세 걸음을 읽는 중에 물음이 오면 단추를 그 위에 더할 뿐이다.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { canPromptInstall, deviceKind, justInstalled, promptInstall, type DeviceKind } from '../state/device';
import { useModalKeys } from './focus';

export const GUIDE_TITLE = '홈 화면에 추가하면 기록이 안전해요';
export const GUIDE_LEAD = '먼저 홈 화면에 추가하고, 늘 느티나무 그림을 눌러서 열어요.';
/** 기기별 세 걸음(spec 5.4의 글) */
export const GUIDE_STEPS: Record<'android' | 'ipad', { name: string; steps: string[] }> = {
  android: {
    name: '갤럭시탭의 크롬',
    steps: ['주소 줄 오른쪽의 점 세 개(⋮)를 눌러요.', '“설치 및 바로가기 만들기”를 눌러요.', '“설치”를 누르면 홈 화면에 느티나무가 생겨요.'],
  },
  ipad: {
    name: '아이패드의 크롬',
    steps: ['주소 줄 오른쪽의 공유 단추(네모에서 화살표가 올라가는 모양)를 눌러요.', '“홈 화면에 추가”를 눌러요.', '“추가”를 눌러요.'],
  },
};
/** 세 걸음을 다 한 뒤의 말. "이 창"이라고 하면 안내 종이로 읽히므로 무엇을 닫는지 적는다. */
export const GUIDE_AFTER = '이제 크롬을 닫고, 홈 화면의 느티나무를 눌러서 열어요.';
/** 단추 하나짜리 안내에서는 아직 추가하기 전이다 */
export const GUIDE_AFTER_BUTTON = '추가한 다음에는 크롬을 닫고, 홈 화면의 느티나무를 눌러서 열어요.';
export const GUIDE_WIFI = '느티나무를 눌러 열 때도 와이파이가 있어야 해요.';
export const GUIDE_ADD = '홈 화면에 추가';
export const GUIDE_SHOW_STEPS = '차례대로 하는 법 보기';
export const GUIDE_ADDING = '홈 화면에 추가하는 중이에요. 잠깐만 기다려요.';
export const GUIDE_ADDED = '홈 화면에 느티나무가 생겼어요.';
/** 추가가 끝났다는 알림이 오래 오지 않을 때 */
export const GUIDE_ADDING_LONG = '홈 화면에 느티나무가 생겼는지 봐요. 없으면 아래 차례대로 해요.';

/** 추가가 끝났다는 알림(appinstalled)을 이만큼 기다린다. 넘으면 차례대로 하는 법을 함께 보인다. */
const ADDING_WAIT_MS = 20000;

/**
 * 안내가 어떤 모양으로 뜰 것인가(뜰 때 한 번 정한다).
 *  - button: 설치 물음을 띄울 수 있다 → 단추 하나(기기를 어떻게 가렸든)
 *  - steps:  그 기기의 세 걸음
 *  - both:   기기를 가리지 못했다(컴퓨터 등) → 두 기기의 순서를 나란히
 */
export type GuideShape = 'button' | 'steps' | 'both';
export function guideShape(kind: DeviceKind, canPrompt: boolean): GuideShape {
  if (canPrompt) return 'button';
  return kind === 'other' ? 'both' : 'steps';
}

/** 세 걸음을 보일 기기들. 설치 물음은 크롬 엔진(갤럭시탭)에만 오므로, 물음이 왔는데 기기를 못 가렸으면 갤럭시탭의 순서를 보인다. */
export function guideKinds(kind: DeviceKind, canPrompt: boolean): ('android' | 'ipad')[] {
  if (kind !== 'other') return [kind];
  return canPrompt ? ['android'] : ['android', 'ipad'];
}

const MARKS = ['①', '②', '③'];

function Steps({ kind }: { kind: 'android' | 'ipad' }): JSX.Element {
  const { steps } = GUIDE_STEPS[kind];
  return (
    <ol class="guide-steps">
      {steps.map((step, index) => (
        <li key={step}>
          <span class="guide-num" aria-hidden="true">
            {MARKS[index]}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

type Phase = 'idle' | 'asking' | 'adding' | 'slow';

export function InstallGuide({ kind = deviceKind, auto, onClose }: { kind?: DeviceKind; /** 저절로 뜬 것인가(닫는 단추의 글이 다르다) */ auto: boolean; onClose: () => void }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const shownAt = useRef(Date.now());
  // 모양은 뜰 때 정한다(읽는 도중에 세 걸음이 단추로 바뀌지 않게)
  const [shape] = useState<GuideShape>(() => guideShape(kind, canPromptInstall.peek()));
  const [kinds] = useState(() => guideKinds(kind, canPromptInstall.peek()));
  const [stepsOpen, setStepsOpen] = useState(shape !== 'button');
  const [phase, setPhase] = useState<Phase>('idle');
  useModalKeys(ref, (ev) => {
    if (ev.key === 'Escape') onClose();
  });
  const installed = justInstalled.value;
  const canAdd = canPromptInstall.value;
  // 추가가 끝났다는 알림이 오래 오지 않으면 차례대로 하는 법을 함께 보인다
  useEffect(() => {
    if (phase !== 'adding') return;
    const timer = window.setTimeout(() => {
      setPhase('slow');
      setStepsOpen(true);
    }, ADDING_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const add = async (): Promise<void> => {
    if (phase !== 'idle') return;
    setPhase('asking');
    const answer = await promptInstall();
    if (answer === 'accepted') setPhase('adding');
    else {
      // 그만두었거나 물음을 띄울 수 없었다: 손으로 하는 차례를 보인다
      setPhase('idle');
      setStepsOpen(true);
    }
  };

  const waiting = phase === 'adding' || phase === 'slow';
  const twoLists = stepsOpen && kinds.length > 1;
  return (
    <div class="veil veil-fixed guide-veil" role="dialog" aria-modal="true" aria-label={GUIDE_TITLE} ref={ref}>
      <div class="veil-box guide-box">
        <div class="guide-head">
          <img class="guide-icon" src="./icons/icon-192.png" alt="느티나무 그림" width="64" height="64" />
          <div>
            <h2 class="guide-title">{GUIDE_TITLE}</h2>
            <p class="guide-lead">{GUIDE_LEAD}</p>
          </div>
        </div>
        {installed ? (
          <p class="guide-done" role="status">
            {GUIDE_ADDED}
          </p>
        ) : (
          <>
            {waiting && (
              <p class="guide-done" role="status">
                {phase === 'slow' ? GUIDE_ADDING_LONG : GUIDE_ADDING}
              </p>
            )}
            {!waiting && canAdd && (
              <div class="guide-one">
                <button type="button" class="btn primary" data-autofocus disabled={phase === 'asking'} onClick={() => void add()}>
                  {GUIDE_ADD}
                </button>
                {!stepsOpen && (
                  <button type="button" class="btn" onClick={() => setStepsOpen(true)}>
                    {GUIDE_SHOW_STEPS}
                  </button>
                )}
              </div>
            )}
            {stepsOpen && phase !== 'adding' && (
              <div class={`guide-lists${twoLists ? ' two' : ''}`}>
                {kinds.map((one) => (
                  <section key={one} class="guide-list">
                    {kinds.length > 1 && <h3 class="guide-kind">{GUIDE_STEPS[one].name}</h3>}
                    <Steps kind={one} />
                  </section>
                ))}
              </div>
            )}
          </>
        )}
        {/* 추가하기 전(단추만 보일 때)과 추가하는 중에는 "추가한 다음에는…", 세 걸음을 보일 때와 추가가 끝난 뒤에는 "이제…" */}
        <p class="guide-after">{installed || (stepsOpen && !waiting) ? GUIDE_AFTER : GUIDE_AFTER_BUTTON}</p>
        <p class="guide-wifi">
          <span class="guide-wifi-mark" aria-hidden="true">
            !
          </span>
          {GUIDE_WIFI}
        </p>
        <div class="veil-buttons guide-buttons">
          <button type="button" class="btn" data-autofocus={!waiting && canAdd && !installed ? undefined : true} onClick={() => Date.now() - shownAt.current > 400 && onClose()}>
            {auto && !installed && !waiting ? '나중에 할게요' : '닫기'}
          </button>
        </div>
      </div>
    </div>
  );
}
