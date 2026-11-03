// The menu: three dots at the top right; opened, how to walk, the picture (the automatic lowering of the resolution
// on or off, the frame rate now), the time of day, the music on or off and how loud, and who made what. Clicks on it go no further (not a look round, not the eagle's flight
// cut short); Esc or a click outside closes it.

const CSS = `
#menuBtn { position: fixed; top: 12px; right: var(--menu-right, 16px); z-index: 20; width: 40px; height: 36px; border: none;
  background: none; color: #fbe9cf; cursor: pointer; font: 600 22px/1 system-ui, sans-serif; letter-spacing: 1px;
  display: grid; place-items: center; text-shadow: 0 0 6px rgba(40,28,16,0.9); opacity: 0.85; transition: opacity 0.3s;
  padding: 0 0 8px; }
#menuBtn:hover { opacity: 1; }
#menuBox { position: fixed; top: 60px; right: var(--menu-right, 16px); z-index: 20; width: min(330px, calc(100vw - 32px));
  max-height: calc(100vh - 80px); overflow-y: auto; box-sizing: border-box; padding: 18px 20px 16px;
  background: rgba(36,27,20,0.82); color: #fbe9cf; border: 1px solid rgba(251,233,207,0.18); border-radius: 12px;
  font: 13px/1.75 'Noto Sans SC', system-ui, sans-serif; backdrop-filter: blur(10px);
  opacity: 0; transform: translateY(-6px); pointer-events: none; transition: opacity 0.25s, transform 0.25s; }
#menuBox.open { opacity: 1; transform: none; pointer-events: auto; }
#menuBox h3 { margin: 14px 0 6px; font-weight: 500; font-size: 12px; letter-spacing: 0.3em; opacity: 0.6; }
#menuBox h3:first-child { margin-top: 0; }
#menuBox .keys { margin: 0; padding: 0; list-style: none; }
#menuBox .keys li { display: flex; justify-content: space-between; gap: 12px; }
#menuBox .keys b { font-weight: 500; opacity: 0.95; white-space: nowrap; }
#menuBox .keys span { opacity: 0.75; text-align: right; }
#menuBox .row { display: flex; gap: 6px; align-items: center; }
#menuBox button.opt { flex: 1; padding: 6px 0; border-radius: 8px; border: 1px solid rgba(251,233,207,0.25); background: transparent;
  color: inherit; font: inherit; cursor: pointer; transition: background 0.2s, border-color 0.2s; }
#menuBox button.opt:hover { background: rgba(251,233,207,0.08); }
#menuBox button.opt.on { background: rgba(251,233,207,0.18); border-color: rgba(251,233,207,0.6); }
#menuBox input[type=range] { flex: 1; accent-color: #e9b97a; }
#menuBox .stat { margin-top: 6px; font-size: 12px; opacity: 0.75; font-variant-numeric: tabular-nums; }
#menuBox .credits { font-size: 12px; line-height: 1.7; opacity: 0.8; }
#menuBox .credits p { margin: 0 0 6px; }
#menuBox a { color: inherit; }
`;

export function createMenu({ times, titles, timeNow, setTime, musicOn, setMusic, volume, setVolume, autoOn = () => true, setAuto = () => {}, stats = () => ({ fps: 0, res: 1 }), right = 16 }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  document.documentElement.style.setProperty('--menu-right', `${right}px`);

  const btn = document.createElement('button');
  btn.id = 'menuBtn';
  btn.title = '菜单';
  btn.setAttribute('aria-label', '菜单');
  btn.textContent = '···';
  const box = document.createElement('div');
  box.id = 'menuBox';
  box.innerHTML = `
    <h3>操作</h3>
    <ul class="keys">
      <li><b>拖动</b><span>环顾四周</span></li>
      <li><b>W A S D / 方向键</b><span>行走</span></li>
      <li><b>Shift</b><span>奔跑</span></li>
      <li><b>F</b><span>飞行（空格 上升 · C 下降）</span></li>
      <li><b>E</b><span>在塔庙顶上：随鹰鸟瞰</span></li>
      <li><b>T</b><span>换时段</span></li>
      <li><b>M</b><span>音乐开关</span></li>
    </ul>
    <h3>画面</h3>
    <div class="row"><span style="flex:2">帧率不够时自动降低分辨率</span><button class="opt" data-auto>开</button></div>
    <div class="stat" data-stats>帧率 —</div>
    <h3>时段</h3>
    <div class="row" data-times>${times.map((n) => `<button class="opt" data-time="${n}">${titles[n]}</button>`).join('')}</div>
    <h3>音乐</h3>
    <div class="row"><button class="opt" data-music>开</button><input type="range" min="0" max="1" step="0.05" data-volume aria-label="音量"></div>
    <h3>致谢</h3>
    <div class="credits">
      <p>模型：<a href="https://sketchfab.com/3d-models/gudea-reconstruction-56e13a61114f4a2dac76f87d5257e984" target="_blank" rel="noopener">“Gudea reconstruction”</a> · Daniel Pett；<a href="https://sketchfab.com/3d-models/sheep-5b11b1aedc9a478eb5e2f3adcf0f4e2e" target="_blank" rel="noopener">“Sheep”</a> · DibArts（均为 <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>，有改动）。</p>
      <p>音乐：在浏览器中实时合成；里拉琴的调弦依据乌尔与尼普尔出土的古巴比伦泥板（UET VII 126、CBS 10996、UET VII 74）。</p>
      <p>引擎与字体：three.js、three-mesh-bvh（MIT）；Noto Sans SC、Rajdhani（SIL OFL）。</p>
    </div>`;
  document.body.append(btn, box);

  const timeBtns = [...box.querySelectorAll('[data-time]')];
  const musicBtn = box.querySelector('[data-music]'), vol = box.querySelector('[data-volume]');
  const autoBtn = box.querySelector('[data-auto]'), statLine = box.querySelector('[data-stats]');
  // (the frame rate and the resolution drawn now, kept up to date while the menu is open)
  const showStats = () => {
    const s = stats();
    statLine.textContent = `帧率 ${s.fps ? Math.round(s.fps) : '—'} · 渲染分辨率 ${Math.round(s.res * 100)}%`;
  };
  let statTimer = 0;
  const show = () => {
    timeBtns.forEach((b) => b.classList.toggle('on', b.dataset.time === timeNow()));
    musicBtn.classList.toggle('on', musicOn());
    musicBtn.textContent = musicOn() ? '开' : '关';
    vol.value = volume();
    autoBtn.classList.toggle('on', autoOn());
    autoBtn.textContent = autoOn() ? '开' : '关';
    showStats();
  };
  const open = (v) => {
    box.classList.toggle('open', v);
    clearInterval(statTimer);
    if (v) { show(); statTimer = setInterval(showStats, 500); }
  };
  btn.addEventListener('click', () => open(!box.classList.contains('open')));
  // (a button let go of at once: the keys go on walking, Space not pressing it again)
  const done = () => document.activeElement?.blur();
  timeBtns.forEach((b) => b.addEventListener('click', () => { setTime(b.dataset.time); show(); done(); }));
  musicBtn.addEventListener('click', () => { setMusic(!musicOn()); show(); done(); });
  autoBtn.addEventListener('click', () => { setAuto(!autoOn()); show(); done(); });
  vol.addEventListener('input', () => setVolume(+vol.value));
  vol.addEventListener('change', done);
  btn.addEventListener('click', done);
  // (its clicks its own)
  for (const el of [btn, box]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
  addEventListener('keydown', (e) => { if (e.code === 'Escape') open(false); });
  addEventListener('pointerdown', (e) => { if (!box.contains(e.target) && e.target !== btn) open(false); });
  return {
    refresh: show,
  };
}
