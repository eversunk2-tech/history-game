// 위쪽 띠 — 맵 화면과 대화 장면이 함께 쓴다.
// 계절 · 해와 곳과 역할 · 수치 셋(이름·숫자·칸) · 해 ☀(남은 것/계절의 해) · 지난 이야기 · 봇짐 · "봄을 보낸다" · 처음으로.
// 넓은 화면에서는 한 줄, 좁으면(1024 너비) 두 줄이 된다. 높이는 내용이 정한다.
// 뜻은 색만으로 전하지 않는다: 수치는 이름과 숫자와 칸, 해는 숫자와 모양(찬 해 · 빈 동그라미), 잠긴 단추는 자물쇠와 점선.
//
// 세 가지 모습이 있다.
//   1. 맵(꼭 할 일이 남았다)      — 위에 적은 그대로. 한 줄 안내는 자리가 넉넉할 때만 보인다.
//   2. 맵(꼭 할 일을 다 했다)     — "꼭 할 일을 다 했어요. 덤을 더 하거나 봄을 보낼 수 있어요"가 어느 너비에서도 보인다
//                                   (자리가 모자라면 띠가 한 줄 늘어난다). "봄을 보낸다"는 찬 바탕과 "▶"로 바뀌고 잠깐 두근거린다.
//   3. 대화 장면·일 놀이가 떠 있다 — 한 줄로 줄인다. 계절·곳·수치·해만 남기고, 그때 쓸 수 없는 단추와 안내는 감춘다(무대가 넓어진다).
// 알림 줄(기록을 남기지 못했어요, 인터넷이 끊겼어요)은 어느 모습에서도 보인다.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { pictureNotice } from '../art/pictures';
import { seasonLabels, statLabels } from '../content/labels';
import { canCloseSeason, currentSeason, deedsOfSeason, openHappenings, roleOf } from '../engine/game';
import { SEASONS, STATS, STAT_MAX, type Stat } from '../engine/types';
import { askHome, closeSeasonNow, game, mapBusy, openPanel, pack, panel, saveFailed, talk } from '../state/store';
import { Ask } from './Ask';
import { LockIcon, StatIcon, SunIcon } from './icons';
import { yearAndPlace } from './where';
import { josa } from './words';

function BandStat({ stat, value }: { stat: Stat; value: number }): JSX.Element {
  const info = statLabels[stat];
  return (
    <div class={`band-stat band-stat-${stat}`} role="img" aria-label={`${info.label} ${value}, 가장 많으면 ${STAT_MAX}`}>
      <StatIcon stat={stat} />
      <div class="band-stat-body">
        <div class="band-stat-top">
          <span class="band-stat-name">{info.label}</span>
          <span class="band-stat-num">{value}</span>
        </div>
        <div class="band-cells">
          {Array.from({ length: STAT_MAX }, (_, index) => (
            <span key={index} class={index < value ? 'cell on' : 'cell'} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** 인터넷이 끊겼는가(브라우저가 알려 주는 것) */
function useOffline(): boolean {
  const [off, setOff] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const down = (): void => setOff(true);
    const up = (): void => setOff(false);
    window.addEventListener('offline', down);
    window.addEventListener('online', up);
    return () => {
      window.removeEventListener('offline', down);
      window.removeEventListener('online', up);
    };
  }, []);
  return off;
}

/**
 * 인터넷 알림 한 줄: "끊겼어요" → 다시 이어지면 "그림을 다시 받는 중" → 놓친 그림을 다 받으면 사라진다(Review 1-라 11.8 ⑥).
 * 한 줄의 글만 바뀌므로 화면 읽기 프로그램이 새 글을 읽는다(role="status"). 뜻은 글이 전한다(표시 !·…는 덧붙임).
 */
function NetNotice({ offline }: { offline: boolean }): JSX.Element | null {
  const state = offline ? 'lost' : pictureNotice.value;
  if (!state) return null;
  return (
    <p class="band-notice" role="status">
      <span class="band-notice-mark" aria-hidden="true">
        {state === 'again' ? '…' : '!'}
      </span>
      {state === 'again' ? '인터넷이 다시 이어졌어요. 그림을 다시 받는 중이에요.' : '인터넷이 끊겼어요. 하던 이야기는 계속할 수 있어요. 이 화면을 닫지 마세요.'}
    </p>
  );
}

export function TopBand(): JSX.Element | null {
  const p = pack.value;
  const g = game.value;
  const busy = mapBusy.value;
  // 대화 장면과 일 놀이가 떠 있는 동안에는 한 줄로 줄인다("미션이 풀림"·봇짐·지난 이야기가 떠 있을 때는 줄이지 않는다)
  const compact = talk.value !== null;
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState(false);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const offline = useOffline();

  // 까닭 풍선은 잠깐 떴다가 사라진다
  useEffect(() => {
    if (!why) return;
    const timer = window.setTimeout(() => setWhy(false), 6000);
    return () => window.clearTimeout(timer);
  }, [why]);

  if (!p || !g) return null;
  const season = currentSeason(g);
  const seasonName = seasonLabels[season].label;
  const role = roleOf(p, g.role);
  const used = deedsOfSeason(g, season).reduce((sum, deed) => sum + deed.sun, 0);
  const sunsAll = g.sunsLeft + used;
  const canClose = canCloseSeason(p, g);
  const sending = josa(seasonName, '을', '를');
  const sendLabel = `${sending} 보낸다`;
  const reason = `꼭 할 일을 마치면 ${sending} 보낼 수 있어요`;
  // 꼭 할 일을 다 한 뒤: 해가 남았고 덤으로 할 일도 남았으면 "더 하거나 보낼 수 있다", 아니면 "이제 보낸다"
  const moreToDo = canClose && openHappenings(p, g).some((view) => !view.must && !view.noSun);
  const doneLine = moreToDo ? `꼭 할 일을 다 했어요. 덤을 더 하거나 ${sending} 보낼 수 있어요.` : `꼭 할 일을 다 했어요. 이제 ${sending} 보내요.`;

  const onSend = (): void => {
    if (busy) return;
    if (canClose) {
      setAsking(true);
      return;
    }
    // 띠의 한 줄 안내가 보이고 있으면 그것으로 넉넉하다. 가려져 있을 때만 풍선으로 띄운다.
    const hintEl = hintRef.current;
    const text = hintEl?.querySelector<HTMLElement>('.band-hint-text');
    const shown = Boolean(hintEl && text && hintEl.clientWidth > 0 && text.offsetTop < hintEl.clientHeight / 2);
    setWhy(shown ? false : !why);
    if (shown && hintEl) {
      hintEl.classList.remove('nudge');
      void hintEl.offsetWidth;
      hintEl.classList.add('nudge');
    }
  };

  return (
    <header class={`band season-${season}${compact ? ' compact' : canClose ? ' open' : ''}`}>
      <div class="band-row">
        <div class="band-info">
          <span class={`season-chip season-${season} now`}>
            <span class="season-mark" aria-hidden="true">
              ●
            </span>
            {seasonName}
          </span>
          <div class="band-where">
            <span class="band-year">{yearAndPlace(p, g.role)}</span>
            <span class="band-role">{role.label}</span>
          </div>
          <div class="band-stats">
            {STATS.map((stat) => (
              <BandStat key={stat} stat={stat} value={g.stats[stat]} />
            ))}
          </div>
          <div class="band-suns" role="img" aria-label={`남은 해 ${g.sunsLeft}, 이 계절의 해 ${sunsAll}`}>
            <div class="band-stat-top">
              <span class="band-stat-name">해</span>
              <span class="band-stat-num">
                {g.sunsLeft}
                <span class="band-sun-all">/{sunsAll}</span>
              </span>
            </div>
            <div class="band-sun-row">
              {Array.from({ length: sunsAll }, (_, index) => (
                <SunIcon key={index} spent={index >= g.sunsLeft} />
              ))}
            </div>
          </div>
        </div>

        {!compact && (
          <div class={`band-tools${canClose ? ' done' : ''}`}>
            {canClose ? (
              // 꼭 할 일을 다 한 뒤의 안내: 어느 너비에서도 보인다(단추들과 한 줄에 들어가지 않으면 그 밑에 한 줄로 놓인다)
              <p class="band-done" role="status">
                <span class="band-done-text">
                  <span class="band-done-mark" aria-hidden="true">
                    ●
                  </span>
                  {doneLine}
                </span>
              </p>
            ) : (
              // 자리가 넉넉할 때만 보이는 한 줄 안내(자리가 없으면 통째로 가려진다. 그때는 단추를 누르면 풍선으로 뜬다)
              <p class="band-hint" ref={hintRef}>
                <span class="band-hint-line">
                  <span class="band-hint-strut" aria-hidden="true" />
                  <span class="band-hint-text">
                    <LockIcon />
                    {reason}
                  </span>
                </span>
              </p>
            )}
            <div class="band-btns">
              <button type="button" class="band-btn" aria-pressed={panel.value === 'past'} disabled={busy && panel.value !== 'past'} onClick={() => openPanel('past')}>
                지난 이야기
              </button>
              <button type="button" class="band-btn" aria-pressed={panel.value === 'bag'} disabled={busy && panel.value !== 'bag'} onClick={() => openPanel('bag')}>
                봇짐
              </button>
              <button
                type="button"
                class={`band-btn send${canClose ? ' open' : ' locked'}`}
                aria-disabled={!canClose}
                aria-describedby={canClose ? undefined : 'band-why-text'}
                disabled={busy}
                onClick={onSend}
              >
                {!canClose && <LockIcon />}
                {sendLabel}
                {canClose && (
                  <span class="band-send-go" aria-hidden="true">
                    ▶
                  </span>
                )}
              </button>
              <button type="button" class="band-btn quiet" disabled={busy} onClick={askHome}>
                처음으로
              </button>
            </div>
          </div>
        )}
      </div>

      {saveFailed.value && (
        <p class="band-notice" role="status">
          <span class="band-notice-mark" aria-hidden="true">
            !
          </span>
          기록을 남기지 못했어요.
        </p>
      )}
      <NetNotice offline={offline} />

      <span id="band-why-text" class="visually-hidden">
        {reason}
      </span>
      {why && !canClose && !compact && (
        <p class="band-why" role="status">
          <LockIcon />
          {reason}
        </p>
      )}

      {asking && (
        <Ask
          ask={g.sunsLeft > 0 ? `아직 해가 남았어요. ${sending} 보낼까요?` : `${sending} 보낼까요?`}
          // 겨울은 한 해의 마지막 계절이다: 보내면 한 해 돌아보기로 간다
          note={g.seasonIndex >= SEASONS.length - 1 ? `${sending} 보내면 한 해가 끝나요. 이어서 한 해를 돌아봐요.` : `${sending} 보내면 이 계절로는 돌아올 수 없어요.`}
          yes={sendLabel}
          no="더 있을래요"
          onNo={() => setAsking(false)}
          onYes={() => {
            setAsking(false);
            closeSeasonNow();
          }}
        />
      )}
    </header>
  );
}
