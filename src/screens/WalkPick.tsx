// 누가 되어 걸어 볼까 — 맵에 들어가기 전에 고른다(바퀴 1-나).
// 누구냐에 따라 맵의 막힌 곳이 달라진다. 무엇이 막히는지 미리 한 줄로 알려 준다.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { neutigol } from '../content/maps/neutigol';
import { closedGates } from '../map/gates';
import { HEROES, PERSON_W, personSheet } from '../pixel/people';
import { toCanvas } from '../pixel/px';
import { backToTitle, startWalk, WALKERS, type Walker } from '../state/store';

// 24×32 칸에서 인물이 차지하는 가운데만 보여 준다
const CROP_X = 3;
const CROP_Y = 4;
const CROP_W = 18;
const CROP_H = 28;

function Portrait({ hero }: { hero: string }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  // 칸을 채울 만큼 크게, 점이 고르게 보이도록 정수배로만 키운다(1024 너비에서 일곱 배)
  const [scale, setScale] = useState(7);
  useEffect(() => {
    const fit = (): void => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setScale(Math.max(4, Math.round(rem * 0.44)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    const person = HEROES[hero];
    if (!canvas || !ctx || !person) return;
    const sheet = toCanvas(personSheet(person));
    let frame = 0;
    const draw = (): void => {
      ctx.clearRect(0, 0, CROP_W, CROP_H);
      // 앞을 보고 제자리걸음(그림 둘레의 빈 곳은 잘라 낸다)
      ctx.drawImage(sheet, (frame % 4) * PERSON_W + CROP_X, CROP_Y, CROP_W, CROP_H, 0, 0, CROP_W, CROP_H);
      frame++;
    };
    draw();
    const timer = window.setInterval(draw, 170);
    return () => window.clearInterval(timer);
  }, [hero]);
  return (
    <canvas
      class="pick-portrait"
      ref={ref}
      width={CROP_W}
      height={CROP_H}
      style={{ width: `${CROP_W * scale}px`, height: `${CROP_H * scale}px` }}
      aria-hidden="true"
    />
  );
}

function Card({ w }: { w: Walker }): JSX.Element {
  const closed = closedGates(neutigol(), { role: w.role, look: w.look }).map((c) => c.gate.label);
  return (
    <li>
      <button type="button" class="walk-card" onClick={() => startWalk(w.hero)}>
        <Portrait hero={w.hero} />
        <span class="walk-card-text">
          <span class="walk-card-name">{w.label}</span>
          <span class="walk-card-look">{w.lookLabel}</span>
          <span class="walk-card-closed">막힌 곳: {closed.join(', ')}</span>
        </span>
      </button>
    </li>
  );
}

export function WalkPick(): JSX.Element {
  return (
    <main class="screen walkpick season-spring">
      <header class="pick-head">
        <div>
          <p class="kicker">1395년 봄 · 느티골</p>
          <h1 class="screen-title">누가 되어 걸어 볼까요?</h1>
          <p class="pick-guide">누구냐에 따라 갈 수 있는 길이 달라요. 막힌 길에 다가가면 까닭이 떠요.</p>
        </div>
        <button type="button" class="btn small" onClick={backToTitle}>
          처음으로
        </button>
      </header>
      <ul class="walk-cards">
        {WALKERS.map((w) => (
          <Card key={w.hero} w={w} />
        ))}
      </ul>
    </main>
  );
}
