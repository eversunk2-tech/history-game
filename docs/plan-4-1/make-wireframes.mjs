// 4-1 구현 계획(spec.md 11.1)의 배치 시안 — 겨루기 화면 둘과 거점 맵의 배치 하나.
// 최종 그림이 아니다. 무엇이 어디에 있는지, 단추 크기(56px 이상)와 글자 크기(본문 20px 이상)를 보이는 회색 상자 그림이다.
// 남의 게임 그림을 쓰지 않는다. 그림 자리는 점선 상자와 글로만 적었다.
//
// 만드는 법: node docs/plan-4-1/make-wireframes.mjs
//   - 머리 없는 크롬의 --screenshot으로 1024×768(태블릿, CSS 화소) PNG를 뜬다. 포트를 열지 않는다.
//   - 크롬 자리: 환경 변수 CHROME(없으면 맥의 기본 자리). 프로필: 환경 변수 CHROME_PROFILE(없으면 임시 폴더를 새로 만든다).
//   - 새 패키지 없음. 글꼴은 이미 설치된 pretendard 패키지의 woff2를 읽는다.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const fontDir = join(root, 'node_modules/pretendard/dist/web/static/woff2');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const W = 1024;
const H = 768;

const font = (weight, file) =>
  `@font-face{font-family:P;font-weight:${weight};src:url('${pathToFileURL(join(fontDir, file)).href}') format('woff2');}`;

const BASE = `
${font(400, 'Pretendard-Regular.woff2')}
${font(700, 'Pretendard-Bold.woff2')}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#efe7d6;font-family:P,'Apple SD Gothic Neo',sans-serif;color:#2b261f;font-size:20px;line-height:1.5}
.abs{position:absolute}
.band{position:absolute;left:0;top:0;width:${W}px;height:64px;background:#3a332a;color:#f6efe0;display:flex;align-items:center;gap:12px;padding:0 12px}
.btn{min-height:56px;min-width:56px;border:2px solid #6d6150;border-radius:10px;background:#fbf6ea;color:#2b261f;display:flex;align-items:center;justify-content:center;padding:0 14px;font-weight:700;font-size:20px}
.band .btn{background:#4a4237;color:#f6efe0;border-color:#8a7d68}
.dim{opacity:.45}
.pic{border:3px dashed #8d7f69;border-radius:12px;color:#6d6150;display:flex;align-items:center;justify-content:center;text-align:center;font-size:18px;background:rgba(255,255,255,.35)}
.bar{height:22px;border:2px solid #4a4237;border-radius:6px;background:#fff;position:relative;overflow:hidden}
.bar>i{position:absolute;left:0;top:0;bottom:0;background:#8fae5a}
.note{position:absolute;font-size:14px;line-height:1.3;color:#1d4f91;background:rgba(232,241,255,.92);border:1.5px dashed #1d4f91;border-radius:6px;padding:3px 7px}
.tag{display:inline-block;font-size:16px;font-weight:700;border:2px solid currentColor;border-radius:999px;padding:0 10px;line-height:26px}
`;

// ── 1. 겨루기 화면: 카드를 고르는 차례 ─────────────────────────────
const card = (x, name, kind, kindMark, power, strong, extra) => `
<div class="abs btn" style="left:${x}px;top:572px;width:212px;height:166px;flex-direction:column;align-items:flex-start;justify-content:flex-start;padding:8px 12px;gap:2px;${strong ? 'border-color:#b5651d;border-width:4px;box-shadow:0 0 0 3px #f3d29a' : ''}">
  <div style="display:flex;width:100%;justify-content:space-between;align-items:center"><span style="font-size:15px" class="tag">${kindMark} ${kind}</span>${strong ? '<span style="font-size:15px;color:#b5651d">★ 이번 판에 세다</span>' : ''}</div>
  <div style="display:flex;align-items:center;gap:8px;margin-top:6px"><span style="width:40px;height:40px;border:2px dashed #b3a58c;border-radius:8px;font-size:11px;font-weight:400;color:#8d7f69;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.1">카드<br>도트</span><span style="font-size:22px">${name}</span></div>
  <div style="font-weight:400;font-size:18px">힘 ${power} · 맞히면 ${power * 2}${strong ? ` · ×1.5` : ''}</div>
  <div style="font-weight:400;font-size:16px;color:#5c5243">${extra}</div>
</div>`;

const battleHand = `<!doctype html><meta charset="utf-8"><style>${BASE}</style>
<div class="abs pic" style="left:0;top:64px;width:${W}px;height:${H - 64}px;border:none;border-radius:0;align-items:flex-start;padding-top:250px;background:linear-gradient(#e9d9b8,#d9c39b)">
  <span style="opacity:.0">.</span>
</div>
<div class="abs" style="left:24px;top:222px;width:360px;font-size:15px;line-height:1.35;color:#7a6c55">배경: 마을 어귀 느티나무 · 해 질 녘<br>(대화 장면의 배경을 빌림 — 없으면 코드 그림)</div>
<div class="band">
  <div style="font-weight:700">「새 도읍의 봄」 · 큰 고비</div>
  <div style="flex:1"></div>
  <div class="btn" style="width:150px">잠깐 멈춤</div>
</div>

<!-- 고비 쪽(위) -->
<div class="abs" style="left:24px;top:78px;width:976px;height:132px;background:rgba(251,246,234,.92);border:2px solid #6d6150;border-radius:12px;padding:10px 16px">
  <div style="display:flex;align-items:center;gap:12px">
    <div style="font-size:24px;font-weight:700">도깨비</div>
    <span class="tag" style="color:#7b4aa0">📖 옛이야기</span>
    <div style="font-size:18px">2단계</div>
    <div style="flex:1"></div>
    <div style="font-size:18px">방패</div>
    <div style="display:flex;gap:6px">${['◆', '◆', '◇'].map((s) => `<div style="width:40px;height:40px;border:2px solid #4a4237;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px">${s}</div>`).join('')}</div>
    <div style="font-size:18px">2칸</div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
    <div style="font-size:18px;width:120px">기운 52/90</div>
    <div class="bar" style="flex:1"><i style="width:58%;background:#b0805a"></i></div>
  </div>
</div>
<!-- 고비가 다음에 할 일(예고) -->
<div class="abs" style="left:600px;top:220px;width:400px;height:84px;background:#fffaf0;border:3px solid #b5651d;border-radius:12px;padding:8px 14px">
  <div style="font-size:15px;color:#b5651d;font-weight:700">다음 차례에 도깨비가 할 일</div>
  <div style="font-weight:700">🤼 "다음은 씨름이다!" — 기운 6</div>
</div>

<!-- 고비 그림 -->
<div class="abs pic" style="left:396px;top:222px;width:196px;height:238px;font-size:17px">도깨비 그림<br>(캔바 — 없으면<br>도트 대역을 크게)<br><br>뿔·호랑이 가죽 옷·<br>쇠못 방망이 없음</div>

<!-- 정령 말풍선 -->
<div class="abs" style="left:24px;top:330px;width:290px;height:120px">
  <div class="abs pic" style="left:0;top:40px;width:72px;height:80px;font-size:14px">정령<br>느티</div>
  <div class="abs" style="left:80px;top:0;width:210px;background:#fff;border:2px solid #6d6150;border-radius:14px;padding:8px 12px;font-size:20px">씨름 판이야! 힘 카드가 세.</div>
</div>

<!-- 내 쪽(아래) -->
<div class="abs" style="left:24px;top:476px;width:976px;height:84px;background:rgba(251,246,234,.92);border:2px solid #6d6150;border-radius:12px;padding:8px 16px;display:flex;align-items:center;gap:14px">
  <div style="width:140px">내 기운 24/31</div>
  <div class="bar" style="width:220px"><i style="width:77%"></i></div>
  <div style="width:56px">기세</div>
  <div style="display:flex;gap:6px">${['●', '●', '○'].map((s) => `<div style="width:36px;height:36px;border:2px solid #4a4237;border-radius:50%;display:flex;align-items:center;justify-content:center">${s}</div>`).join('')}</div>
  <div style="flex:1"></div>
  <div style="font-size:15px;color:#5c5243;line-height:1.3;width:96px">손패 넷<br>남은 덱 4장</div>
  <div class="btn dim" style="width:200px;font-size:18px">함께 하기</div>
</div>
${card(24, '씨름 한 판', '힘', '💪', 11, true, '맞히면: 방패 한 칸 더')}
${card(266, '새 도읍 이야기', '지혜', '📜', 11, false, '맞히면: 기세 한 칸 더')}
${card(508, '흙덩이 깨기', '솜씨', '🌾', 11, false, '맞히면: 다음 할 일 약하게')}
${card(750, '서로 거들기', '어울림', '🤝', 9, false, '맞히면: 기운 4 회복')}

<div class="note" style="left:640px;top:400px;width:360px">카드 한 장 212×166 · 카드 전체가 누르는 단추(56px 이상) · "함께 하기"는 기세 칸이 차면 열린다</div>
<div class="note" style="left:24px;top:742px;width:auto">본문 20px(카드 이름 22) · 단추·카드 높이 56px 이상 · 맞음·틀림은 색만으로 보이지 않음(글·○ 표시) · 시간 제한 없음</div>
<div class="note" style="left:600px;top:312px;width:400px">예고: 그림 표시 + 한 줄(30자 안). 그 판에 센 카드는 손패에 ★로 함께 보인다</div>
`;

// ── 2. 겨루기 화면: 카드를 낸 뒤 뜨는 문제 창 ───────────────────────
const choice = (n, text, mark) =>
  `<div class="btn" style="width:100%;min-height:64px;justify-content:flex-start;padding:0 18px;font-size:21px;margin-top:10px;${mark ? 'border-color:#1d4f91;border-width:4px' : ''}">${n} ${text}</div>`;
const battleQuestion = `<!doctype html><meta charset="utf-8"><style>${BASE}</style>
<div class="abs" style="left:0;top:0;width:${W}px;height:${H}px;background:#2f2a23"></div>
<div class="band" style="opacity:.6"><div style="font-weight:700">「새 도읍의 봄」 · 큰 고비</div></div>
<div class="abs" style="left:24px;top:84px;font-size:16px;color:#cfc4ae">(무대가 어두워진다 — 고비·손패는 뒤에 흐리게)</div>
<div class="abs" style="left:132px;top:116px;width:760px;height:560px;background:#fbf6ea;border:3px solid #6d6150;border-radius:16px;padding:20px 40px">
  <div style="display:flex;align-items:center;gap:10px;font-size:17px;color:#5c5243">
    <span class="tag" style="color:#2b261f">💪 씨름 한 판</span><span>맞히면 힘이 두 배(22) · 틀려도 기본 힘 11은 나가요</span>
  </div>
  <div style="font-size:23px;font-weight:700;margin-top:18px;line-height:1.45">1395년 봄, 나라가 궁궐을 짓던 농민들을 집으로 돌려보낸 까닭은?</div>
  <div style="font-size:15px;color:#7a6c55;margin-top:4px">물음 80자 안 · 고를 것 하나 30자 안 · 2~4개 세로</div>
  ${choice('①', '농사철이 되었기 때문에', true)}
  ${choice('②', '궁궐을 다 지었기 때문에')}
  ${choice('③', '큰비가 와서 공사를 멈추어서')}
  ${choice('④', '스님들이 공사를 싫어해서')}
  <div style="display:flex;gap:12px;margin-top:16px">
    <div class="btn" style="width:280px">💡 정령의 귀띔(1번 남음)</div>
    <div style="flex:1;font-size:15px;color:#7a6c55;align-self:center">귀띔: 틀린 것 하나를 지운다. 손가락과 자판(↑↓·Enter) 모두</div>
  </div>
</div>
<div class="abs" style="left:132px;top:688px;width:372px;height:64px;background:#e9f3e1;border:2px solid #4c7a2c;border-radius:12px;padding:6px 12px;font-size:18px"><b>○ 맞았어요!</b> 힘 22가 나가고 방패 한 칸이 깎여요</div>
<div class="abs" style="left:520px;top:688px;width:372px;height:64px;background:#fff1e6;border:2px solid #9a5a2a;border-radius:12px;padding:6px 12px;font-size:16px;line-height:1.35"><b style="font-size:18px">아쉬워요</b> — 풀이 한 줄(60자 안) · 기본 힘 11 · 이 문제는 두 차례 뒤에 다시</div>
<div class="note" style="left:900px;top:300px;width:116px">고를 것 단추 높이 64px</div>
<div class="note" style="left:900px;top:130px;width:116px">물음 23px · 고를 것 21px</div>
<div class="note" style="left:900px;top:640px;width:116px">답한 뒤 두 모습(아래)</div>
`;

// ── 3. 거점(느티나무 마을) 맵의 배치 ─────────────────────────────────
// 맵은 48×36칸(16점 칸 — 4.2의 가정). 그림은 맵 전체를 칸 17화소로 줄여 그린 배치도이고, 점선 네모가 아이패드 한 화면(약 21×15칸)이다.
const T = 17;
const MX = 16;
const MY = 76;
const cell = (x, y, w, h, style, html = '') =>
  `<div class="abs" style="left:${MX + x * T}px;top:${MY + y * T}px;width:${w * T}px;height:${h * T}px;${style}">${html}</div>`;
const house = (x, y, w, h, name, open, sub) =>
  cell(
    x,
    y,
    w,
    h,
    `border:2px solid ${open ? '#4a4237' : '#9d927f'};background:${open ? '#f3e2bf' : '#e4ddd0'};border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:${open ? 17 : 15}px;font-weight:${open ? 700 : 400};color:${open ? '#2b261f' : '#7d7464'};line-height:1.25`,
    `${name}${sub ? `<span style="font-size:13px;font-weight:400">${sub}</span>` : ''}`,
  ) + cell(x + Math.floor(w / 2) - 0.5, y + h, 1, 1, `background:${open ? '#b5651d' : '#b9b0a0'};border-radius:3px`);
const hubLayout = `<!doctype html><meta charset="utf-8"><style>${BASE} body{background:#d9cfb9}</style>
<div class="band">
  <div style="font-weight:700;font-size:18px;line-height:1.2">Lv 2<br><span style="font-weight:400;font-size:14px">경험치 40/130</span></div>
  <div class="bar" style="width:110px;height:16px;border-color:#cbbfa8"><i style="width:31%"></i></div>
  <div style="font-size:18px">🌾 쌀 4되 · 🧵 베 3자</div>
  <div style="flex:1"></div>
  <div class="btn" style="width:118px;font-size:18px">시간의 문</div>
  <div class="btn" style="width:80px;font-size:18px">서당</div>
  <div class="btn" style="width:92px;font-size:18px">알림판</div>
  <div class="btn dim" style="width:72px;font-size:18px">수첩</div>
  <div class="btn" style="width:104px;font-size:18px">처음으로</div>
</div>
${cell(0, 0, 48, 36, 'background:#c9dba0;border:2px solid #6b7b46;border-radius:4px')}
${cell(0, 0, 48, 36, `background-image:linear-gradient(rgba(0,0,0,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.06) 1px,transparent 1px);background-size:${T}px ${T}px`)}
<!-- 길: 남쪽 어귀에서 마당으로, 마당 둘레 고리 -->
${cell(22, 22, 4, 14, 'background:#e6cf9f')}
${cell(8, 15, 32, 3, 'background:#e6cf9f')}
${cell(22, 3, 4, 12, 'background:#e6cf9f')}
${cell(16, 9, 16, 15, 'background:#e6cf9f;border-radius:50%')}
<!-- 가운데: 시간의 문(큰 느티나무) -->
${cell(19, 11, 10, 9, 'background:#7f9b4c;border:3px solid #4d6328;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;font-weight:700;font-size:18px;line-height:1.25', '시간의 문<br><span style="font-weight:400;font-size:14px">오백 년 느티나무</span>')}
${cell(23, 20, 2, 1, 'background:#b5651d;border-radius:3px')}
<!-- 알림판(나무 곁) -->
${cell(30, 18, 3, 2, 'background:#f3e2bf;border:2px solid #4a4237;border-radius:4px;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center', '알림판')}
<!-- 열린 시설(4-1) -->
${house(20, 0, 8, 5, '서당', true, '훈장님')}
${house(5, 9, 7, 5, '도구점', true, '할아버지')}
${house(5, 19, 7, 5, '포목점·댕기방', true, '아주머니')}
<!-- 곧 열려요(4-3) -->
${house(36, 9, 7, 5, '장터', false, '곧 열려요')}
${house(36, 19, 7, 5, '박물관', false, '곧 열려요')}
${house(31, 0, 7, 5, '공방', false, '곧 열려요')}
${house(10, 0, 7, 5, '주막', false, '곧 열려요')}
${house(33, 27, 8, 5, '우리 집', false, '곧 열려요')}
${house(7, 27, 7, 5, '사진관', false, '곧 열려요')}
<!-- 주인공과 정령 -->
${cell(23.5, 31, 1, 1.4, 'background:#3a5fb0;border-radius:4px')}
${cell(24.8, 30.6, 0.8, 0.8, 'background:#ffe27a;border:2px solid #b59a2a;border-radius:50%')}
<div class="abs" style="left:${MX + 26 * T}px;top:${MY + 30.4 * T}px;font-size:15px;font-weight:700">주인공(처음 서는 곳) · 정령</div>
<!-- 한 화면 -->
${cell(13.5, 9.5, 21, 15, 'border:3px dashed #1d4f91;border-radius:6px')}
<div class="note" style="left:${MX + 13.5 * T}px;top:${MY + 24.7 * T}px;width:${21 * T}px">점선 = 아이패드 한 화면(약 21×15칸, 지금 배율 그대로)</div>
<div class="note" style="left:${MX + 48 * T + 8}px;top:${MY}px;width:${W - MX - 48 * T - 16}px;font-size:15px">맵 48×36칸(16점 칸)<br><br>주황 칸 = 문 앞. 걸어가 닿으면 시설 종이가 뜬다(회색 칸은 "곧 열려요" 한 줄)<br><br>열린 곳: 시간의 문 · 알림판 · 서당 · 도구점 · 포목점·댕기방<br>곧 열려요: 여섯<br><br>위쪽 띠의 바로 가기 셋(시간의 문·서당·알림판)은 걷지 않고 들어가기<br><br>글자는 그림에 넣지 않는다 — 이름표는 화면 글로<br><br>처음 들어오면 정령이 마을을 소개한다(1분 안, 건너뛰기)</div>
<div class="note" style="left:8px;top:${MY + 36 * T + 6}px;width:auto">위쪽 띠 64px: 레벨·경험치 막대·돈 주머니(쌀·베) · 단추 56px 이상 · 본문 20px 이상(띠 안의 작은 글은 막대 곁의 보조 글)</div>
`;

const pages = [
  ['battle-hand.png', battleHand],
  ['battle-question.png', battleQuestion],
  ['hub-layout.png', hubLayout],
];

if (!existsSync(chrome)) {
  console.error(`크롬을 찾지 못했다: ${chrome} (환경 변수 CHROME으로 자리를 알려 준다)`);
  process.exit(1);
}
const work = mkdtempSync(join(tmpdir(), 'plan41-wire-'));
const profile = process.env.CHROME_PROFILE ?? join(work, 'profile');
mkdirSync(profile, { recursive: true });
try {
  for (const [name, html] of pages) {
    const file = join(work, name.replace('.png', '.html'));
    writeFileSync(file, html);
    const out = join(here, name);
    execFileSync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        `--user-data-dir=${profile}`,
        `--window-size=${W},${H}`,
        '--force-device-scale-factor=1',
        '--virtual-time-budget=2000',
        `--screenshot=${out}`,
        pathToFileURL(file).href,
      ],
      { stdio: 'ignore', timeout: 60000 },
    );
    console.log(`그림: ${out}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
