#!/usr/bin/env python3
# 제목 그림을 만든다: 사용자가 업스케일한 그림(제미나이로 만든 1376×768을 2880×1620으로 키운 것)에서
# 1376 판과 같은 구도(아래 156/768을 잘라 낸 것 — 오른쪽 아래의 제미나이 표시가 그 아래에 있다)를 잘라
# 가로 2400px로 줄이고 WebP로 쓴다. 그림의 맨 윗줄 빛깔(하늘을 이어 칠하는 값)도 함께 알려 준다.
#
#   python3 scripts/make-title.py            → src/assets/ui/title-dawn.webp
#
# 쓰는 것: PIL(이 컴퓨터의 python3에 있다 — 새 도구 아님). 새 그림을 넣으면 이 파일만 고치면 된다:
#   - 원본 자리: SOURCES의 맨 앞에서 있는 것을 쓴다(업스케일 판이 없으면 1376 판).
#   - 원본은 저장소에 넣지 않는다(docs/shots/는 git이 무시하는 폴더). 쓴 원본의 크기와 SHA-256은 아래에 적어 둔다.
#
# 2026-11-11 만든 값(업스케일 판):
#   원본  docs/shots/upscale/title-upscaled.png  2880×1620 PNG  7,523,514바이트
#         SHA-256 1fff2087044374dfa1641d39ed216d9982e10b64ffcd85f33d7e40bc8c7a36ce
#   잘라 냄 위에서 1291줄(1620 × 612/768) → 2400×1067(1376:612의 꼴로 되돌림, Lanczos) → WebP 품질 90 → 257,850바이트
#   맨 윗줄의 빛깔: #eaebeb 0%, #efece7 35%, #e1e9ee 65%, #d7dee6 100%
#   (제미나이 표시 ✦는 원본의 x 2590~2690 · y 1315~1420에 있어, 위에서 1291줄을 남기면 빠진다)
#   그림의 출처: AI(제미나이)로 만들고 사용자가 업스케일했다. 눈에 보이지 않는 생성 표시(SynthID)가 들어 있다.

import hashlib
import os
import sys

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SOURCES = [
    # (원본, 위에서 남길 몫) — 1376 판은 이미 잘라 둔 것이라 모두 남긴다
    ('docs/shots/upscale/title-upscaled.png', 612 / 768),
    ('docs/mockup-ui/assets/bg-title-dawn-1376.jpg', 1.0),
]
OUT = 'src/assets/ui/title-dawn.webp'
WIDTH = 2400  # 아이패드 에어(1180×2 = 2360 화소)를 덮는 너비
ASPECT = 612 / 1376  # 1376 판의 꼴(시안 B가 이 꼴로 놓았다)
QUALITY = 90


def main() -> int:
    for rel, keep in SOURCES:
        path = os.path.join(ROOT, rel)
        if os.path.exists(path):
            break
    else:
        print('원본 그림이 없다:', ', '.join(s for s, _ in SOURCES), file=sys.stderr)
        return 1
    raw = open(path, 'rb').read()
    src = Image.open(path).convert('RGB')
    w, h = src.size
    cut = round(h * keep)
    art = src.crop((0, 0, w, cut))
    width = min(WIDTH, w)
    height = round(width * ASPECT)
    art = art.resize((width, height), Image.LANCZOS)
    out = os.path.join(ROOT, OUT)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    art.save(out, 'WEBP', quality=QUALITY, method=6)

    # 하늘을 이어 칠할 빛깔: 맨 윗줄 몇 줄을 가로 네 곳(0 · 35 · 65 · 100%)에서 고르게 잰다
    top = art.crop((0, 0, width, 6)).resize((101, 1), Image.BOX)
    stops = []
    for at in (0, 35, 65, 100):
        r, g, b = top.getpixel((at, 0))
        stops.append(f'#{r:02x}{g:02x}{b:02x} {at}%')

    print(f'원본  {rel}  {w}×{h}  {len(raw):,}바이트  SHA-256 {hashlib.sha256(raw).hexdigest()}')
    print(f'잘라 냄 위에서 {cut}줄 → {width}×{height} WebP 품질 {QUALITY} → {OUT}  {os.path.getsize(out):,}바이트')
    print('맨 윗줄의 빛깔(screens.css의 .title 하늘):', ', '.join(stops))
    return 0


if __name__ == '__main__':
    sys.exit(main())
