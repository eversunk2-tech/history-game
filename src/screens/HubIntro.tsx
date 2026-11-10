// 3. 마을 소개(㉢의 짧은 판 — spec 11.1 가 3): 정령 "느티"의 인사와 시간의 문·알림판을 알리는 줄(대본 script-hub.md 2절), "건너뛰기",
// 그리고 첫 선물(돈 주머니 쌀 3되·베 2자, 마을 창고의 도리깨 — 가진 것에 넣는다. 시대 잠김의 첫 예). 건너뛰어도 첫 선물은 받는다.
// 시설마다 걸어가 알리는 판은 ㉣(거점 맵)이다.

import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { PixelIcon } from '../art/PixelArt';
import { Scenery } from '../art/Scenery';
import { spirit } from '../content/hub';
import { introGift } from '../engine/economy';
import { finishHubIntro } from '../state/store';
import { useModalKeys } from '../ui/focus';
import { ClothIcon, SackIcon } from '../ui/icons';
import { SpiritSay } from '../ui/Spirit';
import { TapGate, nowMs } from '../ui/taps';

export function HubIntro(): JSX.Element {
  const rootRef = useRef<HTMLElement>(null);
  const gate = useRef<TapGate | null>(null);
  if (!gate.current) gate.current = new TapGate(nowMs());
  // 소개 여섯 창 → 첫 선물 세 창
  const lines = [...spirit.intro, ...spirit.gift];
  const giftAt = spirit.intro.length;
  const [i, setI] = useState(0);
  const gift = introGift();
  const line = lines[Math.min(i, lines.length - 1)];
  const last = i >= lines.length - 1;

  const next = (ev?: Event | null): void => {
    if (!gate.current?.passTap(ev)) return;
    if (last) finishHubIntro();
    else setI(i + 1);
  };
  const skip = (ev?: Event | null): void => {
    if (!gate.current?.passTap(ev)) return;
    // 건너뛰면 소개를 넘기고 첫 선물로 간다(선물은 건너뛰어도 받는다)
    setI(giftAt);
  };
  useModalKeys(rootRef, (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      next(ev);
    }
  });

  return (
    <main class="screen hubintro season-spring" ref={rootRef} aria-label="느티나무 마을 소개">
      <div class="hubintro-art">
        <Scenery story="s1395" place="entrance" season="spring" label="큰 느티나무가 선 마을" />
      </div>
      <header class="hubintro-top">
        <p class="kicker">느티나무 마을</p>
        {i < giftAt && (
          <button type="button" class="btn small" onClick={skip}>
            건너뛰기 ▶▶
          </button>
        )}
      </header>
      {i >= giftAt && (
        <section class="hubintro-gift" aria-label="첫 선물">
          <h2 class="paper-kicker">첫 선물</h2>
          <ul class="gift-list">
            <li>
              <SackIcon />
              <span>쌀 {gift.rice}되</span>
            </li>
            <li>
              <ClothIcon />
              <span>베 {gift.cloth}자</span>
            </li>
            <li class={i >= lines.length - 1 ? '' : 'later'}>
              <PixelIcon name="gear-flail" size={44} />
              <span>도리깨(마을 창고)</span>
            </li>
          </ul>
        </section>
      )}
      <div class="hubintro-say">
        <SpiritSay text={line.text} pose={line.pose ?? 'plain'} next={last ? '마을로 ▶' : '다음 ▼'} onNext={next} where="inline" />
        <p class="hubintro-count" aria-hidden="true">
          {i + 1} / {lines.length}
        </p>
      </div>
    </main>
  );
}
