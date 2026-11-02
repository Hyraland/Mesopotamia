# 素材署名 / Credits

## 三维模型

- "Gudea reconstruction" (https://sketchfab.com/3d-models/gudea-reconstruction-56e13a61114f4a2dac76f87d5257e984) by Daniel Pett, licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) — `models/gudea.glb`，神庙里的古地亚坐像。改动：减面到 4 万个三角形、去掉原有贴图、居中并缩放。
- "Sheep" (https://sketchfab.com/3d-models/sheep-5b11b1aedc9a478eb5e2f3adcf0f4e2e) by DibArts (https://sketchfab.com/youssefe22), licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) — `models/sheep_dibarts/`，码头集市羊圈里的羊。改动：腿拉长、羊毛向身体收一点、按部件重新上色，公羊加了向两侧螺旋伸出的角（`src/sheep.js`）。
- 神庙门前的陶狮 `models/lion.glb`：作者以 Tripo AI 生成，参照泰勒哈尔马尔出土的陶狮，减面。
- 塔庙、芦苇棚、织布机（`models/ground_loom.glb`）：以 Astra 生成。
- `models/city.glb`、`models/eagle/eagle.glb`：本项目在 Blender 中制作。

CC BY 4.0 的模型在片头页底部和右上角菜单的“致谢”里有可见署名。

## 音乐

在浏览器中以 Web Audio 实时合成（`src/music.js`）。里拉琴的调弦依据古巴比伦泥板 UET VII 126、CBS 10996、UET VII 74，以及 A. D. Kilmer、M. L. West 等学者的研究与解读。

## 软件与字体

- three.js、three-mesh-bvh（MIT），从 jsDelivr 加载。
- Noto Sans SC、Rajdhani（SIL Open Font License 1.1），从 Google Fonts 加载。
