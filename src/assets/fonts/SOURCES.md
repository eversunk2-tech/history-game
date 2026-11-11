# 글꼴의 출처

게임이 쓰는 글꼴 셋(spec.md 4절). 모두 SIL Open Font License 1.1이다. 주아·고운바탕은 원본을 줄여 넣었고(예약된 이름이 없어 줄여도 된다), Pretendard는 만든 사람이 낸 공식 조각을 손대지 않고 쓴다.

| 글꼴 | 게임에 넣은 파일 | 받은 곳(공개 주소) | 받은 날 | 원본 크기 · SHA-256 | 라이선스 |
|---|---|---|---|---|---|
| **Jua** 400(주아, 배달의민족 주아체) | `jua-2350.woff2` · 187,308바이트 | `https://raw.githubusercontent.com/google/fonts/main/ofl/jua/Jua-Regular.ttf` | 2026-11-11(UTC 07:11) | 2,119,352바이트 · `769677aef240bfc3b9965f2b50748075bff885e6c6992fc591a3fb268279f898` | OFL 1.1, "Copyright 2018 The Jua Project Authors" — [`OFL-Jua.txt`](OFL-Jua.txt)(같은 폴더의 `OFL.txt`를 받아 그대로 옮김, 4,342바이트). 예약된 이름 없음 |
| **Gowun Batang** 700(고운바탕, 류양희) | `gowunbatang-bold-2350.woff2` · 169,108바이트 | `https://raw.githubusercontent.com/google/fonts/main/ofl/gowunbatang/GowunBatang-Bold.ttf` | 2026-11-11(UTC 07:11) | 8,178,712바이트 · `dbfcaa646e5831e7478524924f02906f550285a5050699b4e38c9950b3ec4b94` | OFL 1.1, "Copyright 2021 The Gowun Batang Project Authors" — [`OFL-GowunBatang.txt`](OFL-GowunBatang.txt)(같은 폴더의 `OFL.txt`, 4,397바이트). 예약된 이름 없음 |
| **Pretendard** 600·800 | 받지 않았다 — npm 꾸러미 `pretendard` 1.3.9의 `dist/web/static/woff2-subset/Pretendard-SemiBold.subset.woff2`(268,752바이트)·`Pretendard-ExtraBold.subset.woff2`(271,796바이트) | (이미 있던 꾸러미) | — | — | OFL 1.1, 예약된 이름 "Pretendard"(그래서 줄이지 않는다). 라이선스는 꾸러미에 있다 |

- 원본 TTF는 저장소에 넣지 않는다(고운바탕 8MB). 같은 원본으로 다시 만드는 법은 `scripts/make-fonts.py`의 머리에 있다(원본의 크기와 SHA-256이 다르면 스크립트가 멈춘다).
- 줄인 글자: KS X 1001의 한글 2,350자 + 한글 낱자(ㄱ~ㅎ, ㅏ~ㅣ) + ASCII + 게임이 쓰는 기호(`charset.txt`, 2,538자). 세 글꼴이 실제로 담은 글자는 `coverage.json`(스크립트가 쓴다).
- 원본에 없는 기호: 주아에는 · × — ‘ ’ … ← → ▲ ▶ ▼ ◀ ● ■ ☀ 「 」 같은 기호가 거의 없고, 고운바탕에는 ⋮ ☀ ➤, Pretendard 조각에는 ⋮ ▲ ▶ ▼ ◀ ➤가 없다. 그래서 글꼴 줄을 주아 → Pretendard → 고운바탕 차례로 두어(`src/styles/base.css`의 `--f-title` 등) 기호는 Pretendard나 고운바탕이 그린다. ⋮ ➤ 둘은 세 글꼴 모두에 없어 기기 글꼴이 그린다(`tests/design.test.ts`의 목록).
- 쓰는 도구: fonttools 4.60.2 + brotli(저장소 밖 가상 환경). 줄일 때 힌팅을 빼고(`hinting = False`), 이름 줄(저작권·라이선스)은 모두 남긴다.
- 선생님 자료가 생기면 이 표를 거기에도 옮긴다.
