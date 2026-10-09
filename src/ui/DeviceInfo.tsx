// "이 기기" — 실제 태블릿을 점검할 때 보는 작은 창(선생님 자료가 생기기 전까지 제목 화면에서 연다).
// 화면 크기, 화소 비율, 홈 화면에서 열렸는지, 기록이 남는지, 저장을 지켜 주는지, 인터넷, 판 번호.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { KIND_LABELS, deviceKind, persistedNow, standalone } from '../state/device';
import { BUILD } from '../state/storage';
import { loadStatus } from '../state/store';
import { useModalKeys } from './focus';

interface Screen {
  w: number;
  h: number;
  dpr: number;
  sw: number;
  sh: number;
  online: boolean;
}

function measure(): Screen {
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    sw: window.screen?.width ?? 0,
    sh: window.screen?.height ?? 0,
    online: navigator.onLine !== false,
  };
}

export function DeviceInfo({ onClose, onGuide }: { onClose: () => void; onGuide: () => void }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [scr, setScr] = useState<Screen>(measure);
  const [kept, setKept] = useState<boolean | null | undefined>(undefined);
  useModalKeys(ref, (ev) => {
    if (ev.key === 'Escape') onClose();
  });
  useEffect(() => {
    const again = (): void => setScr(measure());
    window.addEventListener('resize', again);
    window.addEventListener('online', again);
    window.addEventListener('offline', again);
    void persistedNow().then(setKept);
    return () => {
      window.removeEventListener('resize', again);
      window.removeEventListener('online', again);
      window.removeEventListener('offline', again);
    };
  }, []);
  const home = standalone.value;
  const rows: [string, string][] = [
    ['판', BUILD],
    ['기기', KIND_LABELS[deviceKind]],
    ['화면', `${scr.w}×${scr.h} · ${scr.w >= scr.h ? '가로' : '세로'} (기기 ${scr.sw}×${scr.sh})`],
    ['화소 비율', String(scr.dpr)],
    ['여는 방법', home ? '홈 화면의 그림으로 열었어요' : '브라우저 창으로 열었어요'],
    ['기록', loadStatus.value === 'noStorage' ? '이 창에서는 남지 않아요' : '이 기기에 남아요'],
    ['기록 지키기', kept === undefined ? '알아보는 중…' : kept === null ? '알 수 없어요' : kept ? '브라우저가 지켜 줘요' : '아직 약속받지 못했어요'],
    ['인터넷', scr.online ? '이어져 있어요' : '끊겼어요'],
  ];
  return (
    <div class="veil veil-fixed" role="dialog" aria-modal="true" aria-label="이 기기" ref={ref}>
      <div class="veil-box device-box">
        <h2 class="guide-title">이 기기</h2>
        <dl class="device-rows">
          {rows.map(([name, value]) => (
            <div key={name} class="device-row">
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div class="veil-buttons">
          {!home && (
            <button type="button" class="btn" onClick={onGuide}>
              홈 화면에 추가하는 법
            </button>
          )}
          <button type="button" class="btn primary" data-autofocus onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
