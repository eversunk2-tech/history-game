// 거점의 위쪽 띠(spec 4.2, 11.1 가 4): 레벨과 경험치 막대 · 돈 주머니(쌀·베 — ①~④는 엽전이 없다) · 처음으로.
// 바로 가기(시간의 문·서당·알림판)는 ㉣의 거점 맵과 함께 둔다(㉢의 임시 마을 종이에는 시설 목록이 곧 바로 가기다).
// 뜻은 색만으로 전하지 않는다: 레벨은 숫자, 막대는 "지금/다음까지"의 숫자를 함께, 돈은 그림과 낱말과 숫자.

import type { JSX } from 'preact';
import { spirit } from '../content/hub';
import { LEVEL_CAP_41, xpToNext } from '../engine/growth';
import { askHome, save, saveFailed } from '../state/store';
import { ClothIcon, SackIcon } from './icons';

/** 경험치 막대(레벨 L에서 L+1까지 100 + 15 × L). 상한에 걸렸으면 막대는 가득이고 쌓아 둔 것을 적는다 */
export function XpBar({ level, xp, banked, gain = 0 }: { level: number; xp: number; banked: number; gain?: number }): JSX.Element {
  const capped = level >= LEVEL_CAP_41;
  const need = xpToNext(level);
  const ratio = capped ? 1 : Math.max(0, Math.min(1, xp / need));
  const before = capped ? 1 : Math.max(0, Math.min(ratio, (xp - gain) / need));
  return (
    <div class="xp" role="img" aria-label={capped ? `레벨 ${level}, 쌓아 둔 경험치 ${banked}` : `레벨 ${level}, 경험치 ${xp} / ${need}`}>
      <span class="xp-level">
        레벨 <b>{level}</b>
      </span>
      <span class="xp-bar" aria-hidden="true">
        <span class="xp-fill" style={{ '--from': String(before), '--to': String(ratio) }} />
      </span>
      <span class="xp-nums" aria-hidden="true">
        {capped ? `쌓아 둔 경험치 ${banked}` : `${xp} / ${need}`}
      </span>
    </div>
  );
}

export function HubBand({ title, onBack, backLabel = '마을로' }: { title: string; onBack?: () => void; backLabel?: string }): JSX.Element {
  const s = save.value;
  const capped = s.hero.level >= LEVEL_CAP_41;
  return (
    <header class="band hub-band">
      <div class="band-row">
        <div class="band-info">
          <span class="hub-title">{title}</span>
          <XpBar level={s.hero.level} xp={s.hero.xp} banked={s.hero.banked} />
          <div class="purse" role="img" aria-label={`돈 주머니: 쌀 ${s.purse.rice}되, 베 ${s.purse.cloth}자`}>
            <span class="purse-one">
              <SackIcon />
              쌀 <b>{s.purse.rice}</b>되
            </span>
            <span class="purse-one">
              <ClothIcon />
              베 <b>{s.purse.cloth}</b>자
            </span>
          </div>
        </div>
        <div class="band-btns">
          {onBack && (
            <button type="button" class="band-btn" onClick={onBack}>
              <span aria-hidden="true">← </span>
              {backLabel}
            </button>
          )}
          <button type="button" class="band-btn quiet" onClick={askHome}>
            처음으로
          </button>
        </div>
      </div>
      {capped && s.hero.banked > 0 && <p class="band-notice quiet-notice">{spirit.capped}</p>}
      {saveFailed.value && (
        <p class="band-notice" role="status">
          <span class="band-notice-mark" aria-hidden="true">
            !
          </span>
          기록을 남기지 못했어요.
        </p>
      )}
    </header>
  );
}
