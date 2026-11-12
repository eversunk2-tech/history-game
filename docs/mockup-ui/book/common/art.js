// 준비 중인 이야기의 "먹 밑그림" — 코드로 그린 가는 먹선(2px) + 옅은 먹 번짐. 새 그림 파일이 아니다(이 파일 하나, 합 약 6KB).
// 뜻: 아직 채색되지 않은 밑그림 = 준비 중. 이야기가 만들어지면 그 이야기의 채색화(대화 장면 그림 하나)로 바뀐다.
// 고증: 싸우는 장면·무기·사람 얼굴을 그리지 않는다. 물건과 곳 하나씩만(책과 붓 / 산길과 봇짐 / 눈 덮인 성곽 / 엽전 꾸러미 / 갓 / 전차와 전깃줄).
// 쓰는 법: BOOK_ART.svg('ink-1446') → <svg> 글자. 그림은 꾸밈이다(aria-hidden) — 뜻은 곁의 글(해·제목·준비 중)이 전한다.
(function () {
  const W = 'fill="rgba(43,36,29,.075)" stroke="none"'; // 먹 번짐
  const L = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"';
  const T = 'fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" opacity=".7"';
  const ground = (y = 86) => `<path ${T} d="M14 ${y} Q80 ${y - 3} 146 ${y}"/>`;

  const ART = {
    // ① (채색화가 있어 열린 때는 쓰지 않는다 — 부품 견본에서만): 느티나무와 초가
    'ink-1395': `
      <ellipse ${W} cx="62" cy="40" rx="34" ry="22"/>
      <path ${L} d="M62 84 C60 70 64 60 58 52 M62 70 C70 60 74 56 82 52 M58 58 C50 54 46 50 40 50"/>
      <path ${L} d="M30 46 C26 30 44 18 60 20 C74 12 94 22 92 36 C100 44 90 58 78 54 C70 62 50 62 44 56 C32 58 26 52 30 46Z"/>
      <path ${L} d="M100 84 V66 M138 84 V66 M96 68 Q119 50 142 68"/>
      <path ${L} d="M112 84 V74 H122 V84"/>
      ${ground()}`,
    // ② 1446 세종 때, 가르치는 나라: 펼친 책과 붓(글자는 그리지 않고 줄만)
    'ink-1446': `
      <ellipse ${W} cx="80" cy="72" rx="56" ry="10"/>
      <path ${L} d="M28 70 Q54 62 80 68 V34 Q54 28 28 36 Z"/>
      <path ${L} d="M132 70 Q106 62 80 68 V34 Q106 28 132 36 Z"/>
      <path ${T} d="M38 42 Q54 38 70 41 M38 49 Q54 45 70 48 M38 56 Q54 52 70 55 M90 41 Q106 38 122 42 M90 48 Q106 45 122 49"/>
      <path ${L} d="M110 22 L140 52"/>
      <path ${L} d="M140 52 Q146 60 148 64 Q141 62 136 56 Z"/>
      ${ground(84)}`,
    // ③ 1592 임진왜란: 산길과 봇짐(피란 — 싸우는 장면 없이)
    'ink-1592': `
      <path ${W} d="M8 80 L44 34 L64 56 L92 24 L132 80 Z"/>
      <path ${L} d="M8 80 L44 34 L64 56 L92 24 L132 80"/>
      <path ${T} d="M86 32 L80 44 M48 42 L44 52"/>
      <path ${L} d="M60 96 Q84 86 74 74 Q66 64 92 60"/>
      <path ${L} d="M112 92 L150 38"/>
      <path ${W} d="M124 56 Q120 72 136 74 Q152 75 153 60 Q153 49 140 48 Q127 47 124 56 Z"/>
      <path ${L} d="M124 56 Q120 72 136 74 Q152 75 153 60 Q153 49 140 48 Q127 47 124 56 Z"/>
      <path ${L} d="M135 49 Q131 41 125 43 M143 49 Q147 41 153 44"/>
      <path ${T} d="M128 62 Q138 66 150 61"/>
      ${ground(88)}`,
    // ④ 1636 병자호란과 남한산성: 산등성이를 따라 도는 성곽과 눈
    'ink-1636': `
      <path ${W} d="M4 84 Q48 40 96 46 Q130 50 156 70 V90 H4 Z"/>
      <path ${L} d="M4 84 Q48 40 96 46 Q130 50 156 70"/>
      <path ${L} d="M18 70 Q50 44 96 48 Q128 52 148 66"/>
      <path ${L} d="M22 67 v-6 h7 v4 m6 -8 v-6 h7 v4 m6 -7 v-6 h7 v4 m6 -5 v-6 h7 v5 m6 -3 v-6 h7 v6 m6 0 v-5 h7 v7 m6 3 v-5 h7 v7"/>
      <path ${L} d="M86 70 V58 Q94 50 102 58 V70"/>
      <circle ${L} cx="34" cy="20" r="1.4"/><circle ${L} cx="62" cy="14" r="1.4"/><circle ${L} cx="118" cy="22" r="1.4"/><circle ${L} cx="140" cy="12" r="1.4"/><circle ${L} cx="90" cy="26" r="1.4"/>
      ${ground(90)}`,
    // ⑤ 1795 달라지는 살림과 서민 문화: 끈에 꿴 엽전 꾸러미
    'ink-1795': `
      <ellipse ${W} cx="82" cy="76" rx="54" ry="9"/>
      <path ${L} d="M18 54 Q40 46 52 52"/>
      <circle ${L} cx="62" cy="54" r="16"/><rect ${L} x="57" y="49" width="10" height="10"/>
      <circle ${L} cx="88" cy="58" r="16"/><rect ${L} x="83" y="53" width="10" height="10"/>
      <circle ${L} cx="114" cy="54" r="16"/><rect ${L} x="109" y="49" width="10" height="10"/>
      <path ${L} d="M130 54 Q142 60 146 74 M146 74 l-5 6 M146 74 l5 6"/>
      ${ground(86)}`,
    // ⑥ 1863 흔들리는 신분, 새로운 생각: 갓과 갓끈
    'ink-1863': `
      <ellipse ${W} cx="80" cy="66" rx="56" ry="11"/>
      <ellipse ${L} cx="80" cy="64" rx="56" ry="10"/>
      <path ${L} d="M60 62 V34 Q80 26 100 34 V62"/>
      <ellipse ${L} cx="80" cy="34" rx="20" ry="5"/>
      <path ${T} d="M60 56 Q80 60 100 56"/>
      <path ${L} d="M64 70 Q60 80 66 92 M96 70 Q100 80 94 92"/>
      <circle ${L} cx="66" cy="94" r="1.6"/><circle ${L} cx="94" cy="94" r="1.6"/>`,
    // ⑦ 1899 전차가 달리는 한성: 전차와 전깃줄
    'ink-1899': `
      <path ${T} d="M4 14 Q80 20 156 14"/>
      <path ${L} d="M86 17 L74 34"/>
      <path ${W} d="M26 74 V42 Q26 34 36 34 H124 Q134 34 134 42 V74 Z"/>
      <path ${L} d="M26 74 V42 Q26 34 36 34 H124 Q134 34 134 42 V74 Z"/>
      <path ${L} d="M30 34 Q80 26 130 34"/>
      <rect ${L} x="36" y="42" width="14" height="14" rx="2"/><rect ${L} x="56" y="42" width="14" height="14" rx="2"/><rect ${L} x="76" y="42" width="14" height="14" rx="2"/><rect ${L} x="96" y="42" width="14" height="14" rx="2"/>
      <path ${L} d="M116 74 V44 H128 V74"/>
      <circle ${L} cx="48" cy="78" r="6"/><circle ${L} cx="112" cy="78" r="6"/>
      <path ${L} d="M6 86 H154 M6 90 H154"/>`,
  };

  function svg(name, cls = '') {
    const body = ART[name];
    if (!body) return '';
    return `<svg class="ink-art ${cls}" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  window.BOOK_ART = { svg, names: Object.keys(ART) };
})();
