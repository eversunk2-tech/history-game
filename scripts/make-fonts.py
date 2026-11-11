#!/usr/bin/env python3
# 글꼴을 줄인다(spec.md 4절): 주아(Jua 400)와 고운바탕(Gowun Batang 700)의 원본 TTF에서
# 자주 쓰는 한글 2,350자(KS X 1001) + 한글 낱자 + ASCII + 게임이 쓰는 기호만 남겨 woff2 한 파일씩 만든다.
# 그리고 세 글꼴(주아, 고운바탕, Pretendard 공식 조각 600·800)이 실제로 담은 글자를 coverage.json에 적는다
# (tests/design.test.ts가 게임 글의 글자가 빠지지 않았는지 이것으로 본다). Pretendard 조각은 읽기만 한다
# (예약된 이름 "Pretendard" — 우리가 줄이면 이름을 바꿔야 하므로 만든 사람이 낸 조각을 그대로 쓴다).
#
# 돌리는 법(fonttools·brotli는 저장소 밖 가상 환경에만 깐다 — 새 npm 꾸러미 아님):
#   python3 -m venv <스크래치>/venv && <스크래치>/venv/bin/pip install fonttools brotli
#   <스크래치>/venv/bin/python scripts/make-fonts.py --jua <받은 곳>/Jua-Regular.ttf --gowun <받은 곳>/GowunBatang-Bold.ttf
#   → src/assets/fonts/ 에 jua-2350.woff2, gowunbatang-bold-2350.woff2, charset.txt, coverage.json
#
# 원본(저장소에 넣지 않는다 — 8MB. 받은 곳·날짜·라이선스는 src/assets/fonts/SOURCES.md):
#   Jua-Regular.ttf        2,119,352바이트  SHA-256 769677aef240bfc3b9965f2b50748075bff885e6c6992fc591a3fb268279f898
#     https://raw.githubusercontent.com/google/fonts/main/ofl/jua/Jua-Regular.ttf
#   GowunBatang-Bold.ttf   8,178,712바이트  SHA-256 dbfcaa646e5831e7478524924f02906f550285a5050699b4e38c9950b3ec4b94
#     https://raw.githubusercontent.com/google/fonts/main/ofl/gowunbatang/GowunBatang-Bold.ttf
# 다른 원본이 들어오면 스크립트가 멈춘다(같은 파일로 다시 만들 수 있게). 일부러 바꿀 때는 위 값과 EXPECT를 함께 고친다.
#
# 글이 늘어 2,350자 밖의 글자가 나오면(tests/design.test.ts가 알린다) EXTRA에 그 글자를 더해 다시 돌린다.

import argparse
import hashlib
import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.join(ROOT, 'src', 'assets', 'fonts')
PRETENDARD = os.path.join(ROOT, 'node_modules', 'pretendard', 'dist', 'web', 'static', 'woff2-subset')

EXPECT = {
    'jua': (2119352, '769677aef240bfc3b9965f2b50748075bff885e6c6992fc591a3fb268279f898'),
    'gowun': (8178712, 'dbfcaa646e5831e7478524924f02906f550285a5050699b4e38c9950b3ec4b94'),
}

# 게임이 쓰는 기호와 흔한 문장 부호(spec.md 4.2). ASCII(공백~물결)는 따로 모두 넣는다.
SYMBOLS = '·×—–‘’“”…←↑→↓−⋮①②③④⑤⑥⑦⑧⑨⑩■□▲▶▼◀●○☀➤「」『』〈〉※'
# 2,350자 밖이지만 게임 글에 들어온 글자(없으면 빈 칸)
EXTRA = ''


def ksx1001_hangul() -> list[str]:
    """KS X 1001(완성형)의 한글 2,350자: EUC-KR의 B0A1~C8FE 자리를 차례로 읽는다."""
    out = []
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            try:
                ch = bytes([hi, lo]).decode('euc_kr')
            except UnicodeDecodeError:
                continue
            if 0xAC00 <= ord(ch) <= 0xD7A3:
                out.append(ch)
    if len(out) != 2350:
        raise SystemExit(f'KS X 1001 한글이 2,350자가 아니다: {len(out)}')
    return out


def charset() -> list[str]:
    jamo = [chr(c) for c in range(0x3131, 0x3164)]  # ㄱ~ㅎ, ㅏ~ㅣ(옛 낱자는 빼고)
    ascii_ = [chr(c) for c in range(0x20, 0x7F)]
    seen: dict[str, None] = {}
    for ch in ksx1001_hangul() + jamo + ascii_ + list(SYMBOLS) + list(EXTRA):
        seen.setdefault(ch, None)
    return list(seen)


def check_source(key: str, path: str) -> None:
    raw = open(path, 'rb').read()
    size, sha = EXPECT[key]
    got = hashlib.sha256(raw).hexdigest()
    if len(raw) != size or got != sha:
        raise SystemExit(f'{path}: 적어 둔 원본과 다르다({len(raw):,}바이트, {got}). 받은 곳과 EXPECT를 살펴본다.')


def make_subset(src: str, dst: str, text: str) -> None:
    options = subset.Options()
    options.flavor = 'woff2'
    options.hinting = False
    options.desubroutinize = True
    options.name_IDs = ['*']  # 저작권·라이선스 줄을 남긴다
    options.name_languages = ['*']
    options.notdef_outline = True
    font = TTFont(src)
    sub = subset.Subsetter(options=options)
    sub.populate(text=text)
    sub.subset(font)
    font.flavor = 'woff2'
    font.save(dst)


def covered(path: str) -> str:
    cmap = TTFont(path).getBestCmap()
    return ''.join(chr(c) for c in sorted(cmap) if c >= 0x20)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--jua', required=True)
    ap.add_argument('--gowun', required=True)
    args = ap.parse_args()
    check_source('jua', args.jua)
    check_source('gowun', args.gowun)

    chars = charset()
    text = ''.join(chars)
    os.makedirs(OUT, exist_ok=True)
    # 글자 목록: 한 줄에 50자씩(사람이 읽기 쉽게). 줄바꿈 글자는 글꼴에 넣지 않는다.
    with open(os.path.join(OUT, 'charset.txt'), 'w', encoding='utf-8') as f:
        for i in range(0, len(text), 50):
            f.write(text[i : i + 50].replace('\n', '') + '\n')

    made = {
        'jua': ('jua-2350.woff2', 'Jua', 400, args.jua),
        'gowun': ('gowunbatang-bold-2350.woff2', 'Gowun Batang', 700, args.gowun),
    }
    fonts = {}
    for key, (name, family, weight, src) in made.items():
        dst = os.path.join(OUT, name)
        make_subset(src, dst, text)
        fonts[key] = {'file': name, 'family': family, 'weight': weight, 'bytes': os.path.getsize(dst), 'chars': covered(dst)}
    for key, (name, weight) in {'pretendard600': ('Pretendard-SemiBold.subset.woff2', 600), 'pretendard800': ('Pretendard-ExtraBold.subset.woff2', 800)}.items():
        path = os.path.join(PRETENDARD, name)
        fonts[key] = {'file': f'pretendard/dist/web/static/woff2-subset/{name}', 'family': 'Pretendard', 'weight': weight, 'bytes': os.path.getsize(path), 'chars': covered(path)}

    hangul = [c for c in chars if 0xAC00 <= ord(c) <= 0xD7A3]
    report = {
        'note': 'scripts/make-fonts.py가 쓴다. 글꼴마다 실제로 담은 글자(공백 위). 손으로 고치지 않는다.',
        'charset': {'hangul': len(hangul), 'all': len(chars)},
        'fonts': fonts,
    }
    with open(os.path.join(OUT, 'coverage.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
        f.write('\n')

    for key, info in fonts.items():
        have = set(info['chars'])
        lost = [c for c in hangul if c not in have]
        syms = ''.join(c for c in SYMBOLS if c not in have)
        print(f"{key:14} {info['file']:58} {info['bytes']:>9,}바이트  한글 2,350자 중 빠짐 {len(lost)}  없는 기호 {syms or '없음'}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
