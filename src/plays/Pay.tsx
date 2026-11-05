// 일 놀이 「쌀과 베로 값 치르기」 — 쌀과 베를 상대가 받을 만큼 맞춰 건넨다.
// 값을 쌀과 베로 치르던 때다(F08). 쌀은 되로 한 되씩 되어 멍석에 얹고, 베는 끊어서 얹거나 통째로 얹는다.
// 상대가 고개를 끄덕일 때까지 얹었다 덜었다 하는 번거로움이 이 놀이의 내용이다.
//
// 셈 문제가 아니다: 값은 숫자로 나오지 않는다. 상대의 말("조금 더 얹어야겠다 / 그만하면 됐다 / 넉넉하구나")과 몸짓이 알려 준다.
// 틀림이 없다: 모자라게 내밀면 상대가 고개를 젓고 놀이가 이어질 뿐이다. 넉넉히 내밀면 그대로 받는다. 맞추는 길은 여러 가지다.
// 베를 통째로 얹어 한참 넘치게 되면 상대가 한 번 되묻는다("한참 넘치는구나. 그래도 줄래?") — 한 번 더 누르면 얹힌다.
// 앞에서 "이웃 몫까지 넉넉히 바꾼다"(choice 'share')를 골랐으면 소금 두 자루라 받을 만큼이 크다(payRules의 PAY_CHOICES).
// 시간에 쫓기지 않는다. "어른께 맡긴다"로 언제든 건너뛸 수 있다.
// 끝난 모습(payRules.ts): exact(알맞게 건넴) · generous(넉넉히 얹어 줌) · left(어른께 맡김).
// 한 것은 멍석 위에 그대로 보인다: 되어 놓은 쌀 무더기, 끊어 놓은 베 조각. 끊은 베는 다시 붙지 않는다.
//
// 그리지 않는 것: 엽전, 저울과 저울추, 글씨. 소금을 가진 사람은 대본대로 "윗마을 사람"이다(소금 장수라고 하지 않는다 — 확인하지 못했다).
// "끊은 베는 통째인 베보다 덜 쳐 준다"는 놀이의 규칙으로 꾸민 것이라 사람의 말로만 둔다(배움 쪽지에 쓸 사실이 아니다).
// 자루·되·쌀 무더기·베·멍석은 그림 점(놀이 점의 반)으로 곱게 그린다(spec 4.7.5). 놓는 자리와 누르는 자리는 놀이 점 그대로다.

import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CLOTH, HAIR, SKIN, paletteOf } from '../pixel/palette';
import { COL, DIRS, HEROES, footShadow, personOf, personSheet, type Person } from '../pixel/people';
import { ART, toCanvas, withAlpha } from '../pixel/px';
import { WARM_DARK } from '../pixel/wash';
import { heroName } from '../state/store';
import { clothPiece, drawArt, drawBase, drawFoot, drawPerson, matArt, measureArt, paintYard, riceHeapArt, sackArt, shadowArt, silhouette } from './art';
import { Say, useEndOnce } from './bits';
import { PlayFrame } from './Frame';
import type { PlayProps } from './index';
import {
  canCut,
  canWhole,
  newPayTable,
  payCount,
  payMood,
  payRulesOf,
  payVerdict,
  putCut,
  putRice,
  putWhole,
  takeBack,
  wholeOvershoots,
  type PayMood,
  type PayTable,
  type PayThing,
} from './payRules';
import { mountStage, prefersCalm } from './stage';

/** 규칙의 이름표마다의 놀이 방법 한 줄. 지금은 '1395'(쌀과 베로 치른다) 하나다. 엽전을 세어 내는 규칙은 뒤 이야기에서 더한다. */
const HOW_TO: Record<string, string> = {
  '1395': '값은 쌀과 베로 치러요. 상대가 고개를 끄덕일 만큼 멍석에 얹어서 건네요.',
};

/** 상대의 말(낯빛마다). 꾸민 말이다. */
const MOOD_SAYS: Record<PayMood, string> = {
  none: '쌀이랑 베를 얼마나 주겠니?',
  far: '아직 한참 모자라는구나.',
  near: '조금 더 얹어야겠다.',
  enough: '그만하면 됐다. 바꾸자꾸나.',
  plenty: '이렇게나 넉넉히? 고맙구나.',
};

/** 규칙에 적힌 도트 인물이 없을 때 세우는 사람(수수한 차림의 어른) */
const KEEPER: Person = {
  build: 'adult',
  sex: 'f',
  bottom: 'skirt',
  hair: 'scarf',
  hairColor: HAIR.black,
  skin: SKIN.tan,
  top: CLOTH.cotton,
  lower: CLOTH.earth,
  shoes: CLOTH.straw,
};

/** 물건이 날아가 놓이는 시간(밀리초) */
const FLY_MS = 300;
/** 고개를 젓거나 끄덕이는 시간 */
const NOD_MS = 620;
/** 받아들인 뒤 물건이 오가는 시간 */
const TRADE_MS = 1100;
/** 베 한 토막의 너비(점) */
const SEG = 12;

interface Flight {
  /** 멍석에 얹은 것 가운데 몇 번째인가 */
  index: number;
  thing: PayThing;
  born: number;
}

export function Pay({ rules, facts, choice, onDone }: PlayProps): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const rule = useMemo(() => payRulesOf(rules, choice), [rules, choice]);
  const { end } = useEndOnce(onDone);
  /** 베를 통째로 얹으려다 상대가 되물은 참이다(한 번 더 누르면 얹힌다. 다른 것을 하면 거둔다) */
  const [asking, setAsking] = useState(false);
  /** 놀이판 위 "되" 딱지의 자리(놀이판 너비·높이에 대한 몫) */
  const [measureTag, setMeasureTag] = useState({ x: 0.22, y: 0.7 });
  const [table, setTable] = useState<PayTable>(() => newPayTable(rule));
  /** 상대가 방금 한 말(고개를 저었을 때, 끊은 베를 처음 봤을 때). 없으면 낯빛에 맞는 말을 한다. */
  const [said, setSaid] = useState<string | null>(null);
  const [traded, setTraded] = useState<null | 'exact' | 'generous'>(null);
  /** 놀이판과 함께 보는 것 */
  const sim = useRef({
    table,
    flights: [] as Flight[],
    shakeAt: -1e9,
    nodAt: -1e9,
    tradeAt: -1e9,
    scoopAt: -1e9,
    cutSeen: false,
    closing: false,
    /** 끝맺음을 미뤄 둔 것(물건이 오가는 동안). 놀이가 치워지면 지운다. */
    timer: 0,
    tapRice: (): void => {},
    tapCloth: (): void => {},
  });

  /** 멍석의 것을 바꾼다(얹기·덜기). 바뀌지 않았으면 false. */
  const change = (next: PayTable, thing: PayThing | null): boolean => {
    const s = sim.current;
    if (s.closing || next === s.table) return false;
    const now = performance.now();
    if (thing) {
      s.flights.push({ index: next.put.length - 1, thing, born: now });
      if (thing === 'rice') s.scoopAt = now;
    } else {
      s.flights = s.flights.filter((f) => f.index < next.put.length);
    }
    s.table = next;
    setTable(next);
    setAsking(false);
    // 끊은 베를 처음 얹었을 때 한마디 듣는다(그다음부터는 낯빛에 맞는 말)
    if (thing === 'cut' && !s.cutSeen) {
      s.cutSeen = true;
      setSaid(`끊은 베는 통째인 베보다 덜 쳐 준단다. ${MOOD_SAYS[payMood(next, rule)]}`);
    } else {
      setSaid(null);
    }
    return true;
  };
  const addRice = (): boolean => change(putRice(sim.current.table), 'rice');
  const addCut = (): boolean => change(putCut(sim.current.table), 'cut');
  /** 베를 통째로: 한참 넘치게 되면 먼저 한 번 되묻는다(틀림이 아니다 — 한 번 더 누르면 얹힌다) */
  const addWhole = (): boolean => {
    const t = sim.current.table;
    if (sim.current.closing || !canWhole(t, rule)) return false;
    if (!asking && wholeOvershoots(t, rule)) {
      setAsking(true);
      setSaid('통째로? 한참 넘치는구나. 그래도 줄래?');
      return true;
    }
    return change(putWhole(t, rule), 'whole');
  };
  const undo = (): boolean => change(takeBack(sim.current.table, rule), null);
  sim.current.tapRice = () => void addRice();
  sim.current.tapCloth = () => void addCut();

  /** 이만큼 내민다: 모자라면 상대가 고개를 젓고 놀이가 이어진다. 받을 만하면 물건이 오가고 끝난다. */
  const offer = (): void => {
    const s = sim.current;
    if (s.closing) return;
    const verdict = payVerdict(s.table, rule);
    const now = performance.now();
    setAsking(false);
    if (verdict === 'short') {
      s.shakeAt = now;
      const n = payCount(s.table);
      const mood = payMood(s.table, rule);
      setSaid(
        mood === 'none'
          ? '빈손으로는 바꿀 수 없단다. 쌀이나 베를 얹어 보렴.'
          : s.table.rice === 0 && n.cut + n.whole === 0
            ? '쌀만으로는 모자라는구나. 베도 얹어 보렴.'
            : '조금 더 얹어야겠다.',
      );
      return;
    }
    s.closing = true;
    s.nodAt = now;
    s.tradeAt = now + (prefersCalm() ? 0 : NOD_MS * 0.6);
    setTraded(verdict);
    setSaid(verdict === 'generous' ? '넉넉히 주니 고맙구나. 소금 가져가거라.' : '알맞게 가져왔구나. 소금 가져가거라.');
    s.timer = window.setTimeout(() => end(verdict), prefersCalm() ? 500 : NOD_MS * 0.6 + TRADE_MS + 500);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const s = sim.current;
    const pal = paletteOf('autumn');
    const calm = prefersCalm();
    const hero = HEROES[heroName(facts.role, facts.look)] ?? HEROES['farmer-boy'];
    const heroSheet = toCanvas(personSheet(hero));
    const keeperSheet = toCanvas(personSheet(personOf(rule.keeper.sprite) ?? KEEPER));
    const shadow = toCanvas(footShadow());
    const sackShade = toCanvas(shadowArt(13, 4, 90));
    const riceSacks = Array.from({ length: rule.rice + 1 }, (_, left) => toCanvas(sackArt(pal, 'rice', rule.rice > 0 ? left / rule.rice : 0).px));
    const saltSack = toCanvas(sackArt(pal, 'salt').px);
    const measure = [toCanvas(measureArt(pal, false).px), toCanvas(measureArt(pal, true).px)];
    const heap = toCanvas(riceHeapArt(pal).px);
    const cutPiece = toCanvas(clothPiece(pal, SEG, 9, -1));
    const sparePiece = toCanvas(clothPiece(pal, SEG, 9, 2));
    const wholeCloth = toCanvas(clothPiece(pal, SEG * rule.cloth, 9, 0, SEG));
    /** 내 쪽에 남은 베(이어진 토막 수마다. 한 번이라도 끊었으면 오른쪽 끝의 올이 풀려 있다) */
    const joinedCloth = Array.from({ length: rule.cloth + 1 }, (_, n) => (n === 0 ? null : toCanvas(clothPiece(pal, SEG * n, 9, n < rule.cloth ? 1 : 0, SEG))));

    let w = 0;
    let h = 0;
    let ground: HTMLCanvasElement | null = null;
    let mat: HTMLCanvasElement | null = null;
    /** 멍석의 그림자(멍석의 꼴 그대로 — 따뜻한 밤빛) */
    let matShade: HTMLCanvasElement | null = null;
    /** 자리(점): 크기가 바뀔 때마다 다시 잡는다 */
    const at = { matX: 0, matY: 0, matW: 0, matH: 0, heroX: 0, heroY: 0, sackX: 0, sackY: 0, clothX: 0, clothY: 0, keeperX: 0, keeperY: 0, saltX: 0, saltY: 0 };

    const stage = mountStage(box, canvas, {
      rows: 112,
      cols: 244,
      resized(nw, nh) {
        w = nw;
        h = nh;
        const grassH = Math.round(h * 0.2);
        ground = toCanvas(paintYard(w, h, 'autumn', grassH));
        at.matW = Math.min(96, Math.round(w * 0.36));
        at.matH = Math.min(46, Math.round(h * 0.42));
        at.matX = Math.round(w / 2 - at.matW / 2);
        at.matY = Math.round(h * 0.94 - at.matH);
        const matPx = matArt(pal, at.matW, at.matH);
        mat = toCanvas(matPx);
        matShade = toCanvas(silhouette(matPx, withAlpha(WARM_DARK, 71)));
        const side = Math.max(34, Math.round((w / 2 - at.matW / 2) / 2));
        at.heroX = Math.max(14, side - 20);
        at.heroY = Math.round(h * 0.66);
        at.sackX = at.heroX + 28;
        at.sackY = Math.round(h * 0.7);
        at.clothX = Math.max(3, at.heroX - 10);
        at.clothY = Math.round(h * 0.93);
        at.keeperX = w - side - 6;
        at.keeperY = Math.round(h * 0.66);
        at.saltX = Math.min(w - 15 - (rule.sacks - 1) * 9, at.keeperX + 28);
        at.saltY = Math.round(h * 0.74);
        // "되" 딱지: 되(쌀 자루 곁의 네모난 그릇) 바로 밑
        setMeasureTag({ x: (at.sackX + 15) / w, y: (at.sackY + 3) / h });
      },
      paint(ctx, now) {
        if (!ground || !mat || !matShade) return;
        const t = s.table;
        drawBase(ctx, ground);
        // 멍석(가운데)과 오른쪽 아래로 비낀 그림자
        drawArt(ctx, matShade, at.matX + 2, at.matY + 3);
        drawArt(ctx, mat, at.matX, at.matY);

        // 주고받는 동안: 멍석의 것은 상대 쪽으로, 소금 자루는 내 쪽으로 옮겨 간다
        const trade = now >= s.tradeAt && s.closing ? (calm ? 1 : Math.min(1, (now - s.tradeAt) / TRADE_MS)) : 0;
        const ease = trade * trade * (3 - 2 * trade);

        // 내 쪽: 나, 쌀 자루와 되, 베
        const scooping = now - s.scoopAt < FLY_MS + 120;
        const heroCol = scooping ? COL.work + (Math.floor((now - s.scoopAt) / 70) % 4) : COL.idle + (Math.floor(now / 760) % 2);
        drawFoot(ctx, shadow, at.heroX, at.heroY);
        drawPerson(ctx, heroSheet, heroCol, DIRS.indexOf('right'), at.heroX, at.heroY);
        drawArt(ctx, sackShade, at.sackX - 13, at.sackY - 5);
        drawArt(ctx, riceSacks[t.rice], at.sackX - 13, at.sackY - 27);
        if (!scooping) drawArt(ctx, measure[0], at.sackX + 9, at.sackY - 8);
        const joined = joinedCloth[t.joined];
        if (joined) drawArt(ctx, joined, at.clothX, at.clothY - 10);
        for (let i = 0; i < t.spare; i++) drawArt(ctx, sparePiece, at.clothX + t.joined * SEG + 4 + i * (SEG + 3), at.clothY - 10 - (i % 2) * 2);

        // 멍석 위: 쌀 무더기는 윗줄, 베는 아랫줄. 날아오는 것은 놓일 자리까지 포물선으로 온다.
        const slide = Math.round(ease * (at.keeperX - at.matX - at.matW / 2));
        let riceN = 0;
        let cutN = 0;
        // 쌀 무더기는 다섯씩 한 줄(넘으면 둘째 줄)
        const riceStep = Math.min(16, Math.floor((at.matW - 14) / Math.min(5, rule.rice)));
        const cutStep = Math.min(16, Math.floor((at.matW - 12) / rule.cloth));
        t.put.forEach((thing, index) => {
          let tx: number;
          let ty: number;
          let img: HTMLCanvasElement;
          let fromX: number;
          let fromY: number;
          if (thing === 'rice') {
            img = heap;
            const k = riceN++;
            tx = at.matX + 5 + (k % 5) * riceStep + (k >= 5 ? Math.round(riceStep / 2) : 0);
            ty = at.matY + 3 + Math.floor(k / 5) * 10;
            fromX = at.sackX - 2;
            fromY = at.sackY - 26;
          } else if (thing === 'cut') {
            img = cutPiece;
            tx = at.matX + 5 + cutN++ * cutStep;
            ty = at.matY + at.matH - 15;
            fromX = at.clothX + t.joined * SEG;
            fromY = at.clothY - 10;
          } else {
            img = wholeCloth;
            tx = at.matX + Math.round((at.matW - wholeCloth.width / ART) / 2);
            ty = at.matY + at.matH - 15;
            fromX = at.clothX;
            fromY = at.clothY - 10;
          }
          const flight = s.flights.find((f) => f.index === index);
          if (flight && !calm && now - flight.born < FLY_MS) {
            const u = (now - flight.born) / FLY_MS;
            // 날아가는 자리는 그림 점마다(곱게)
            const x = Math.round((fromX + (tx - fromX) * u) * ART) / ART;
            const y = Math.round((fromY + (ty - fromY) * u - Math.sin(u * Math.PI) * 12) * ART) / ART;
            // 쌀은 되에 담겨 날아와 쏟아진다
            drawArt(ctx, thing === 'rice' ? measure[1] : img, x, y);
            return;
          }
          drawArt(ctx, img, tx + slide, ty - Math.round(Math.sin(trade * Math.PI) * 6));
        });
        s.flights = s.flights.filter((f) => now - f.born < FLY_MS);

        // 상대 쪽: 소금을 가진 어른과 소금 자루. 모자라면 고개를 젓고(좌우로), 됐으면 끄덕인다(위아래로).
        let kx = at.keeperX;
        let ky = at.keeperY;
        if (!calm && now - s.shakeAt < NOD_MS) kx += Math.round(Math.sin(((now - s.shakeAt) / NOD_MS) * Math.PI * 6) * 1.6);
        if (!calm && now - s.nodAt < NOD_MS) ky += Math.round(Math.abs(Math.sin(((now - s.nodAt) / NOD_MS) * Math.PI * 3)) * 2);
        const keeperCol = COL.idle + (Math.floor(now / 820) % 2);
        drawFoot(ctx, shadow, at.keeperX, at.keeperY);
        drawPerson(ctx, keeperSheet, keeperCol, DIRS.indexOf('left'), kx, ky);
        for (let k = rule.sacks - 1; k >= 0; k--) {
          const fromX = at.saltX + k * 9;
          const fromY = at.saltY - k * 5;
          const saltX = Math.round(fromX + (at.sackX + 30 + k * 9 - fromX) * ease);
          const saltY = Math.round(fromY + (at.sackY + 6 - k * 5 - fromY) * ease - Math.sin(trade * Math.PI) * 10);
          drawArt(ctx, sackShade, saltX - 13, saltY - 5);
          drawArt(ctx, saltSack, saltX - 13, saltY - 27);
        }
      },
    });
    if (!stage) return;

    // 놀이판의 쌀 자루를 누르면 쌀 한 되를, 베를 누르면 한 조각을 끊어 얹는다(아래 단추와 같은 일이다)
    const onDown = (ev: PointerEvent): void => {
      ev.preventDefault();
      const [x, y] = stage.at(ev);
      if (Math.abs(x - at.sackX - 2) <= 19 && y >= at.sackY - 34 && y <= at.sackY + 8) s.tapRice();
      else if (x >= at.clothX - 8 && x <= at.clothX + rule.cloth * SEG + 34 && y >= at.clothY - 20 && y <= at.clothY + 8) s.tapCloth();
    };
    canvas.addEventListener('pointerdown', onDown);
    return () => {
      stage.stop();
      window.clearTimeout(s.timer);
      canvas.removeEventListener('pointerdown', onDown);
    };
  }, []);

  // 자판: 왼쪽·오른쪽 화살표로 단추를 오간다(누르는 것은 Enter·Space — 단추가 스스로 눌린다)
  const onBarKey = (ev: KeyboardEvent): void => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    const items = Array.from(barRef.current?.querySelectorAll<HTMLElement>('button') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    ev.preventDefault();
    items[(index + (ev.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length].focus();
  };

  const count = payCount(table);
  const mood = payMood(table, rule);
  const enough = mood === 'enough' || mood === 'plenty';
  const on: string[] = [];
  if (count.rice > 0) on.push(`쌀 ${count.rice}되`);
  if (count.cut > 0) on.push(`끊은 베 ${count.cut}조각`);
  if (count.whole > 0) on.push('통째인 베');
  const closing = traded !== null;
  /** 누를 수 없는 단추도 초점은 받는다(자판으로 오가다 초점을 잃지 않게). 눌러도 아무 일이 없다. */
  const act = (label: string, can: boolean, run: () => boolean, autofocus = false): JSX.Element => (
    <button type="button" class={`btn pay-act${can && !closing ? '' : ' off'}`} aria-disabled={!can || closing} data-autofocus={autofocus ? true : undefined} onClick={() => void (can && run())}>
      {label}
    </button>
  );
  return (
    <PlayFrame
      title="쌀과 베로 값 치르기"
      howTo={HOW_TO[rules] ?? HOW_TO['1395']}
      doneLabel="이만큼 건넬게요"
      ready={enough && !closing}
      onDone={offer}
      onLeave={() => {
        // 셈은 어머니가 하신다(값 치르기에는 "하다 만 것"이 없다 — 건네기 전이니 left)
        if (!sim.current.closing) end('left');
      }}
      status={
        <div class="play-status-row">
          <Say strong={enough}>
            {closing
              ? `${rule.goods}를 받았어요.`
              : on.length === 0
                ? '쌀 자루와 베를 눌러 멍석에 얹어요.'
                : `멍석에 얹은 것: ${on.join(', ')}.${enough ? ' “이만큼 건넬게요”를 눌러요.' : ''}`}
          </Say>
        </div>
      }
    >
      <div class="pay-wrap">
        <div class="play-box yard pay-box" ref={boxRef}>
          <canvas class="play-canvas" ref={canvasRef} role="img" aria-label={`가운데 멍석을 두고 내 쌀 자루와 베, 건너편에 소금 자루를 가진 ${rule.keeper.label}이 있어요. 쌀 자루나 베를 누르면 멍석에 얹혀요.`} />
          <p class="pay-bubble" aria-live="polite">
            <span class="pay-bubble-who">{rule.keeper.label}</span>
            {said ?? (mood === 'none' ? `${rule.goods}다. ${MOOD_SAYS.none}` : MOOD_SAYS[mood])}
          </p>
          <span class="play-tag pay-tag-mine">내 쌀과 베</span>
          <span class="play-tag pay-tag-measure" style={{ left: `${measureTag.x * 100}%`, top: `${measureTag.y * 100}%` }}>
            되: 쌀을 되는 그릇
          </span>
        </div>
        <div class="pay-bar" ref={barRef} onKeyDown={onBarKey}>
          {act('쌀 한 되 얹기', table.rice > 0, addRice, true)}
          {act('베 한 조각 끊어 얹기', canCut(table), addCut)}
          {act(asking ? '그래도 통째로 줄게요' : '베 통째로 얹기', canWhole(table, rule), addWhole)}
          {act('하나 덜기', table.put.length > 0, undo)}
        </div>
      </div>
    </PlayFrame>
  );
}
