// 시안 B의 도트 아이콘 — 맵(3.1차 도트 화풍)과 UI를 잇는 작은 그림.
// 16×16 칸에 면만 칠하고, 바깥 테(먹색 한 칸)는 저절로 두른다. 칸은 늘 정수 배(32px = 한 칸 2px)로 그려 도트가 고르게 보인다.
// 쓰는 법: <i class="px" data-px="sack"></i>  (data-size="40"처럼 크기를 바꿀 수 있다. 16의 배수 또는 2.5배(40)만)

(function () {
  const N = 16;
  const INK = '#3b2a1e';
  const PAL = {
    // 곡식 자루
    a: '#e3bd74', b: '#c4924a', c: '#f6dfa8', r: '#8a5a2b',
    // 사람
    s: '#f2c9a0', h: '#3b2a1e', o: '#e39a52', O: '#c27a35', p: '#8a6a4a',
    // 맞잡은 손
    L: '#e2b588', R: '#f7dfc4', l: '#cf9d6c',
    // 해
    y: '#f2b443', Y: '#ffd877', q: '#b8ab95',
    // 자물쇠
    g: '#8f8578', G: '#d9c7a1', z: '#b9a57d',
    // 두루마리
    P: '#f6ecd4', n: '#b8854a', m: '#9c8b74',
    // 보자기(쪽빛)
    B: '#3f8f86', C: '#6fb5aa', D: '#2c6b64',
    // 초가
    T: '#d9b061', U: '#b88c3e', W: '#efe2c4', d: '#7a5532',
    // 손가락
    f: '#f6d2ac', F: '#d9a77c', w: '#f3ead6', v: '#d8cbb0',
    // 계절
    e: '#7fa650', E: '#a9cf66', k2: '#5d8a34', i: '#e0a93a', I: '#f3cf6a', j: '#b77f1d', x: '#ffffff', X: '#bcd3e6',
    // 생활 카드
    K: '#fbf6ea', M: '#c4462a',
  };

  const blank = () => Array.from({ length: N }, () => Array(N).fill(null));
  const set = (g, x, y, c) => {
    if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c;
  };
  const rect = (g, x, y, w, h, c) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(g, i, j, c);
  };
  const disc = (g, cx, cy, rx, ry, c) => {
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const dx = (i + 0.5 - cx) / rx;
        const dy = (j + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(g, i, j, c);
      }
  };
  const seg = (g, x0, y0, x1, y1, r, c) => {
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const px = i + 0.5;
        const py = j + 0.5;
        const vx = x1 - x0;
        const vy = y1 - y0;
        const t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / (vx * vx + vy * vy || 1)));
        const dx = px - (x0 + t * vx);
        const dy = py - (y0 + t * vy);
        if (dx * dx + dy * dy <= r * r) set(g, i, j, c);
      }
  };
  const rows = (g, list, x0 = 0, y0 = 0) => {
    list.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && set(g, x0 + i, y0 + j, ch)));
  };
  /** 칠한 칸 둘레의 빈 칸에 먹 테를 두른다(4방향) */
  const outline = (g, skip = new Set()) => {
    const out = g.map((row) => row.slice());
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        if (g[j][i]) continue;
        const near = [
          [i + 1, j],
          [i - 1, j],
          [i, j + 1],
          [i, j - 1],
        ].some(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && g[b][a] && !skip.has(g[b][a]));
        if (near) out[j][i] = 'k';
      }
    return out;
  };

  const ICONS = {
    // 살림: 곡식 자루
    sack() {
      const g = blank();
      disc(g, 8, 10.2, 5.6, 4.6, 'a');
      rect(g, 6, 4, 4, 3, 'a');
      rect(g, 6, 5, 4, 1, 'r');
      seg(g, 7, 4.5, 5, 1.8, 0.7, 'a');
      seg(g, 9, 4.5, 11, 1.8, 0.7, 'a');
      // 그늘(오른쪽 아래)과 빛(왼쪽 위)
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (g[j][i] === 'a' && (i >= 11 || j >= 13)) g[j][i] = 'b';
      rect(g, 4, 9, 1, 2, 'c');
      rect(g, 5, 8, 1, 1, 'c');
      return outline(g);
    },
    // 기력: 두 팔을 번쩍 든 사람
    body() {
      const g = blank();
      rows(g, [
        '................',
        '................',
        '.ss...hhhh...ss.',
        '.ss...ssss...ss.',
        '..oo..ssss..oo..',
        '...oo..ss..oo...',
        '....oooooooo....',
        '.....ooooooO....',
        '.....ooooooO....',
        '.....ooooooO....',
        '.....pppppp.....',
        '.....pp..pp.....',
        '.....pp..pp.....',
        '....ppp..ppp....',
        '................',
        '................',
      ]);
      return outline(g);
    },
    // 인심: 맞잡은 손
    trust() {
      // 왼쪽 아래와 오른쪽 아래에서 올라온 두 팔(흰 소매)이 가운데에서 손을 맞잡는다
      const g = blank();
      seg(g, 1.2, 14, 3.6, 11.4, 2.1, 'w');
      seg(g, 14.8, 14, 12.4, 11.4, 2.1, 'v');
      seg(g, 3.8, 11, 7.6, 7.4, 1.75, 'L');
      seg(g, 12.2, 11, 8.6, 7.4, 1.75, 'R');
      disc(g, 8.2, 6.4, 3.3, 2.5, 'R');
      rect(g, 6, 5, 1, 2, 'l');
      rect(g, 8, 5, 1, 2, 'l');
      rect(g, 10, 5, 1, 1, 'l');
      set(g, 5, 7, 'L');
      set(g, 5, 6, 'L');
      return outline(g, new Set(['l']));
    },
    // 해 ☀(남은 해)
    sun() {
      const g = blank();
      const rays = [0, 45, 90, 135, 180, 225, 270, 315];
      for (const deg of rays) {
        const a = (deg * Math.PI) / 180;
        seg(g, 8 + Math.cos(a) * 5.4, 8 + Math.sin(a) * 5.4, 8 + Math.cos(a) * 6.9, 8 + Math.sin(a) * 6.9, 0.55, 'y');
      }
      disc(g, 8, 8, 3.9, 3.9, 'y');
      rect(g, 6, 6, 2, 1, 'Y');
      rect(g, 6, 7, 1, 1, 'Y');
      return outline(g);
    },
    // 진 해: 빈 점선 동그라미(모양으로 가른다)
    sunSpent() {
      const g = blank();
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const d = Math.hypot(i + 0.5 - 8, j + 0.5 - 8);
          if (d > 3.3 && d < 4.6 && (i + j) % 2 === 0) set(g, i, j, 'q');
        }
      return g;
    },
    lock() {
      const g = blank();
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const d = Math.hypot(i + 0.5 - 8, j + 0.5 - 7);
          if (d <= 4.2 && d >= 2.2 && j < 8) set(g, i, j, 'g');
        }
      rect(g, 3, 7, 10, 7, 'G');
      rect(g, 3, 13, 10, 1, 'z');
      rect(g, 7, 9, 2, 3, 'h');
      return outline(g, new Set(['h']));
    },
    // 지난 이야기: 두루마리
    scroll() {
      const g = blank();
      rect(g, 3, 4, 10, 8, 'P');
      rect(g, 1, 3, 2, 10, 'n');
      rect(g, 13, 3, 2, 10, 'n');
      rect(g, 5, 6, 6, 1, 'm');
      rect(g, 5, 8, 4, 1, 'm');
      rect(g, 5, 10, 5, 1, 'm');
      return outline(g, new Set(['m']));
    },
    // 봇짐: 쪽빛 보자기
    bundle() {
      const g = blank();
      disc(g, 8, 10.5, 6, 4, 'B');
      disc(g, 8, 5.6, 1.8, 1.6, 'B');
      seg(g, 7, 5, 3.6, 2.2, 0.75, 'B');
      seg(g, 9, 5, 12.4, 2.2, 0.75, 'B');
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (g[j][i] === 'B' && j >= 12) g[j][i] = 'D';
      rect(g, 4, 9, 2, 1, 'C');
      rect(g, 5, 8, 1, 1, 'C');
      set(g, 9, 10, 'C');
      set(g, 11, 11, 'C');
      return outline(g);
    },
    // 처음으로: 초가
    house() {
      const g = blank();
      rows(g, [
        '................',
        '................',
        '................',
        '.....TTTTTT.....',
        '....TTTTTTTT....',
        '...TTTTTTTTTT...',
        '..UUUUUUUUUUUU..',
        '...WWWWWWWWWW...',
        '...WWWWWWWWWW...',
        '...WWWWddWWWW...',
        '...WWWWddWWWW...',
        '...WWWWddWWWW...',
        '...WWWWddWWWW...',
        '................',
        '................',
        '................',
      ]);
      return outline(g);
    },
    // 손가락(누르는 곳을 알려 준다)
    hand() {
      const g = blank();
      rows(g, [
        '......ff........',
        '......ff........',
        '......ff........',
        '......ff........',
        '......ffff......',
        '......ffffff....',
        '...ffffffffff...',
        '...ffFffFffFf...',
        '...ffffffffff...',
        '...ffffffffff...',
        '....ffffffff....',
        '....ffffffff....',
        '....wwwwwwww....',
        '....wwwwwwww....',
        '....vvvvvvvv....',
        '................',
      ]);
      return outline(g, new Set());
    },
    // 계절 표시
    spring() {
      const g = blank();
      seg(g, 8, 14, 8, 8, 0.7, 'k2');
      disc(g, 5.2, 6.8, 2.9, 2, 'e');
      disc(g, 10.8, 5.6, 3.1, 2.1, 'E');
      return outline(g);
    },
    summer() {
      const g = blank();
      seg(g, 7.5, 14, 3.5, 3, 0.75, 'e');
      seg(g, 8, 14, 8.5, 1.5, 0.75, 'E');
      seg(g, 8.5, 14, 12.5, 4, 0.75, 'e');
      return outline(g);
    },
    autumn() {
      const g = blank();
      seg(g, 4.5, 14.5, 7.5, 3.5, 0.6, 'j');
      for (const [x, y] of [
        [8.6, 3.6],
        [9.6, 5.6],
        [10.4, 7.8],
        [10.6, 10.2],
        [7.2, 6],
        [7.4, 8.6],
      ])
        disc(g, x, y, 1.15, 1.15, 'i');
      set(g, 9, 5, 'I');
      set(g, 10, 7, 'I');
      return outline(g);
    },
    winter() {
      const g = blank();
      for (const deg of [90, 30, 150]) {
        const a = (deg * Math.PI) / 180;
        seg(g, 8 - Math.cos(a) * 6, 8 - Math.sin(a) * 6, 8 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, 0.6, 'x');
      }
      disc(g, 8, 8, 1.4, 1.4, 'X');
      return outline(g);
    },
    // 생활 카드
    card() {
      const g = blank();
      rect(g, 3, 1, 10, 14, 'K');
      rect(g, 5, 3, 6, 5, 'E');
      rect(g, 5, 6, 6, 2, 'e');
      rect(g, 5, 10, 6, 1, 'm');
      rect(g, 5, 12, 4, 1, 'm');
      set(g, 11, 13, 'M');
      return outline(g, new Set(['m']));
    },
  };

  function svgOf(name, size) {
    const make = ICONS[name];
    if (!make) return '';
    const g = make();
    const cell = size / N;
    let rects = '';
    for (let j = 0; j < N; j++) {
      let i = 0;
      while (i < N) {
        const c = g[j][i];
        if (!c) {
          i++;
          continue;
        }
        let w = 1;
        while (i + w < N && g[j][i + w] === c) w++;
        const fill = c === 'k' ? INK : PAL[c] ?? INK;
        rects += `<rect x="${i}" y="${j}" width="${w}" height="1" fill="${fill}"/>`;
        i += w;
      }
    }
    return `<svg viewBox="0 0 ${N} ${N}" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
  }

  function paint(root = document) {
    root.querySelectorAll('i.px[data-px]').forEach((el) => {
      const size = Number(el.dataset.size || 32);
      el.innerHTML = svgOf(el.dataset.px, size);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
    });
  }

  window.pxIcons = { paint, svgOf, names: Object.keys(ICONS) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => paint());
  else paint();
})();
