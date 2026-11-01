// 일 놀이 하나만 따로 띄워 보는 개발용 견본(만드는 동안에만 쓴다. 빌드본에는 들어가지 않는다 — 어디에서도 불러 쓰지 않는다).
//   개발 서버에서: http://localhost:5173/src/plays/dev.html?play=weed&draw=drought&look=girl&rules=1395
//   play  sow · weed · pay · harvest · weave      draw  drought(큰비가 온 해) · normal · bumper
//   look  boy · girl                              role  farmer · nobi …
//   choice  그 놀이 앞에서 고른 선택지의 id(값 치르기의 share 등)      flags  표시를 쉼표로(sow.low 등)
// 대화 장면이 떠 있을 때와 같은 틀(위쪽의 한 줄 띠 + 그 아래를 가득 채운 놀이)로 보인다.
// 끝나면 끝난 모습(onDone의 값)을 화면에 적고 document.body.dataset.result에도 둔다(자동으로 눌러 볼 때 읽는다).
// onDone이 몇 번 불렸는지는 document.body.dataset.calls에 센다(한 번만 불려야 한다).

import { render } from 'preact';
import { useState } from 'preact/hooks';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/band.css';
import '../styles/talk.css';
import '../styles/device.css';
import '../styles/plays.css';
import type { Facts, Look, RoleId } from '../engine/types';
import { PLAYS } from './index';

const SEASON: Record<string, string> = { sow: 'spring', weed: 'summer', pay: 'autumn', harvest: 'autumn', weave: 'winter' };

function Dev(): preact.JSX.Element {
  const query = new URLSearchParams(location.search);
  const name = query.get('play') ?? 'weed';
  const def = PLAYS[name];
  const [result, setResult] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const facts: Facts = {
    role: (query.get('role') ?? 'farmer') as RoleId,
    look: (query.get('look') ?? 'boy') as Look,
    stats: { living: 5, body: 5, trust: 5 },
    flags: (query.get('flags') ?? '').split(',').filter(Boolean),
    draw: query.get('draw'),
    items: [],
  };
  return (
    <div class="stage" style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
      <div class="band compact" style={{ height: '3.54rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span>
          견본 · {name} · {facts.look} · {facts.draw ?? '날씨 없음'}
        </span>
        {result !== null && (
          <>
            <strong id="dev-result">끝난 모습: {result}</strong>
            <button
              type="button"
              class="btn small"
              style={{ minHeight: '2.6rem', color: '#2e2925' }}
              onClick={() => {
                delete document.body.dataset.result;
                delete document.body.dataset.calls;
                setResult(null);
                setRound(round + 1);
              }}
            >
              다시
            </button>
          </>
        )}
      </div>
      <div style={{ position: 'relative', minHeight: 0 }}>
        <div class={`talk step-play season-${SEASON[name] ?? 'spring'}`}>
          <div class="talk-play" data-own>
            {def && result === null ? (
              <def.View
                key={round}
                rules={query.get('rules') ?? '1395'}
                facts={facts}
                choice={query.get('choice') ?? undefined}
                onDone={(end) => {
                  document.body.dataset.calls = String(Number(document.body.dataset.calls ?? '0') + 1);
                  document.body.dataset.result = end;
                  setResult(end);
                }}
              />
            ) : (
              <p style={{ padding: '2rem', color: '#f6efe2' }}>{def ? `끝난 모습: ${result}` : `모르는 놀이: ${name}`}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById('app');
if (root) render(<Dev />, root);
