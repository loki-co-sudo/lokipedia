# アイコン素材

lokipedia のアプリアイコン。「トリックスター(Loki)× 知性の融合」をコンセプトに、
狐面/角のようなシルエット(悪戯好きな知恵者のモチーフ)+ 額のきらめき(知性・閃き)+
細めた目(茶目っ気)を、藍色(知性)→琥珀色(悪戯・炎)のグラデーションに乗せたデザイン。

- `icon.svg` — 通常アイコン用(角丸背景)。`public/icon-192.png` / `icon-512.png` / `favicon.ico` の元データ。
- `icon-maskable.svg` — maskable アイコン用(背景フルブリード、図案をセーフゾーンに収めて縮小)。`public/icon-512-maskable.png` の元データ。

## PNG・ICO の再生成

このリポジトリの依存関係には含めていない(一度きりのデザイン作業用ツールのため)。
再生成する場合は一時的に `cairosvg`(PNG化)と ImageMagick(`magick` コマンド。ICO 束ね)を使う。

```bash
python3 -m venv /tmp/icon-venv
/tmp/icon-venv/bin/pip install cairosvg
/tmp/icon-venv/bin/python -c "
import cairosvg
cairosvg.svg2png(url='design/icon.svg', write_to='public/icon-192.png', output_width=192, output_height=192)
cairosvg.svg2png(url='design/icon.svg', write_to='public/icon-512.png', output_width=512, output_height=512)
cairosvg.svg2png(url='design/icon-maskable.svg', write_to='public/icon-512-maskable.png', output_width=512, output_height=512)
for size in [16, 32, 48]:
    cairosvg.svg2png(url='design/icon.svg', write_to=f'/tmp/fav-{size}.png', output_width=size, output_height=size)
"
magick /tmp/fav-16.png /tmp/fav-32.png /tmp/fav-48.png public/favicon.ico
rm -rf /tmp/icon-venv /tmp/fav-*.png
```
