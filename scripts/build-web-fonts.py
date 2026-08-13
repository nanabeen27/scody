#!/usr/bin/env python3
"""웹용 폰트 서브셋을 만든다.

왜 필요한가: `assets/fonts/Pretendard-*.ttf`는 굵기당 약 2.5MB(4종 10.7MB)다.
웹에서는 expo-font가 넣는 `@font-face`의 `font-display`가 `auto`여서 브라우저가
약 3초만 기다리고 폴백으로 먼저 그린다. 2.5MB짜리는 그 시간을 넘겨 텍스트가
`Apple SD Gothic Neo`로 그려졌다가 뒤늦게 바뀐다(실측: 텍스트 7,397ms / 폰트 7,671ms).

무엇을 하는가: 한글 완성형 전체(U+AC00-D7A3)와 실제로 쓰는 기호 범위만 남기고
woff2로 압축한다. 한자·가나·키릴은 뺀다(앱 어디에도 쓰지 않는다).

**이름을 바꾸는 이유**: Pretendard 라이선스(SIL OFL 1.1)에 Reserved Font Name
`Pretendard`가 걸려 있다. 서브셋은 OFL이 말하는 Modified Version이라 원래 이름을
그대로 쓸 수 없다(4항). 그래서 웹 서브셋만 `ScodyKR`로 바꿔 넣는다. 네이티브는
원본 TTF를 그대로 쓰므로 `Pretendard` 이름을 유지한다.

실행:
    python3 -m venv .fontenv && .fontenv/bin/pip install fonttools brotli
    .fontenv/bin/python scripts/build-web-fonts.py

결과: assets/fonts/web/ScodyKR-{Regular,Medium,SemiBold,Bold}.woff2
"""

import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'fonts'
OUT = SRC / 'web'

WEIGHTS = [('Regular', 400), ('Medium', 500), ('SemiBold', 600), ('Bold', 700)]

# 남길 글자. 코드 전체를 훑어 실제로 쓰는 비ASCII 기호를 확인한 뒤 그 범위를 넣었다
# (①-⑨ 문항 번호, ★☆ 별표, 「」 인용, ㄱㄴㄷ 자모, → − × ÷ ± § · … ₩).
# 한글은 완성형 전체를 남긴다 — 학생 이름·지문·AI 답변에 어떤 음절이 올지 모른다.
UNICODES = ','.join([
    'U+0020-007E',  # 기본 라틴
    'U+00A0-00FF',  # 라틴-1 보충(· × ÷ ± § °)
    'U+2000-206F',  # 일반 구두점(– — “ ” … ‹ ›)
    'U+20A9', 'U+20AC',  # ₩ €
    'U+2190-21FF',  # 화살표(→)
    'U+2200-22FF',  # 수학 기호(− ≤ ≥)
    'U+2460-24FF',  # 원문자(① ② ③)
    'U+2500-25FF',  # 도형(● ■ ▲)
    'U+2600-26FF',  # 기호(★ ☆)
    'U+3000-303F',  # CJK 구두점(「」 『』 〈〉)
    'U+1100-11FF',  # 한글 자모
    'U+3130-318F',  # 한글 호환 자모(ㄱ ㄴ ㄷ)
    'U+AC00-D7A3',  # 한글 완성형 전체 11,172자
    'U+FF01-FF60',  # 전각 형태
])

NEW_FAMILY = 'ScodyKR'


def rename(path: pathlib.Path, weight_name: str) -> None:
    """name 테이블의 패밀리 이름을 바꾼다. OFL 4항(Reserved Font Name) 때문이다."""
    from fontTools.ttLib import TTFont

    font = TTFont(path)
    full = f'{NEW_FAMILY} {weight_name}'
    postscript = f'{NEW_FAMILY}-{weight_name}'
    for record in font['name'].names:
        # 1 패밀리 · 2 서브패밀리 · 3 고유 id · 4 전체 이름 · 6 PostScript 이름
        # 16/17 타이포그래픽 패밀리 · 21/22 WWS
        if record.nameID in (1, 16, 21):
            record.string = NEW_FAMILY
        elif record.nameID in (4,):
            record.string = full
        elif record.nameID in (3, 6):
            record.string = postscript
    font.save(path)
    font.close()


def main() -> int:
    if not SRC.exists():
        print(f'원본 폰트를 찾을 수 없어요: {SRC}', file=sys.stderr)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)

    for name, _ in WEIGHTS:
        src = SRC / f'Pretendard-{name}.ttf'
        dst = OUT / f'{NEW_FAMILY}-{name}.woff2'
        subprocess.run(
            [
                sys.executable, '-m', 'fontTools.subset', str(src),
                f'--unicodes={UNICODES}',
                '--layout-features=*',
                '--flavor=woff2',
                f'--output-file={dst}',
            ],
            check=True,
        )
        rename(dst, name)
        before = src.stat().st_size
        after = dst.stat().st_size
        print(f'{name:<10} {before / 1048576:6.2f}MB → {after / 1024:6.0f}KB')
    print(f'\n{OUT} 에 만들었어요. 라이선스는 assets/fonts/Pretendard-LICENSE.txt 를 함께 둡니다.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
