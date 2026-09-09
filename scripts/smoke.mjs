// Drives the web export in headless Chromium: opens every screen, plays each
// game for a few seconds, and fails on any console error or page crash.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:8090';
const OUT = process.env.OUT ?? 'screens';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`));
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const tap = (x, y) => page.mouse.click(x, y);
const settle = (ms) => page.waitForTimeout(ms);
const testId = (id) => page.locator(`[data-testid="${id}"]`);

await page.goto(BASE, { waitUntil: 'networkidle' });
await settle(800);
await shot('00-hub');
if (!(await page.getByText('BLOKARCADE').count())) throw new Error('Hub title missing');

const results = {};
async function openGame(id) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await settle(400);
  await testId(`game-${id}`).click();
  await settle(700);
  await shot(`${id}-1-idle`);
}
async function waitGameOver(timeout = 25000) {
  await testId('game-over').waitFor({ timeout });
}
async function readScore() {
  return (await testId('hud-score').first().textContent())?.trim();
}

// JUMP RUN — start, jump a few times, then stop jumping and die.
await openGame('jumprun');
await tap(195, 500);
for (let i = 0; i < 6; i++) { await settle(650); await tap(195, 500); }
await shot('jumprun-2-playing');
await waitGameOver();
results.jumprun = await readScore();
await shot('jumprun-3-over');
await testId('play-again').click();
await settle(300);
if (!(await testId('tap-to-start').count())) throw new Error('jumprun: play again did not reset');

// GEM MATCH — find and perform a valid swap through the DOM.
await openGame('gemmatch');
const before = await readScore();
const swapped = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('[data-testid^="gem-"]')];
  return cells.length;
});
if (swapped !== 49) throw new Error(`gemmatch: expected 49 cells, saw ${swapped}`);
// Tap adjacent pairs until the score changes (invalid swaps snap back).
let scored = false;
outer: for (let r = 0; r < 7 && !scored; r++) {
  for (let c = 0; c < 6; c++) {
    await testId(`gem-${r}-${c}`).click();
    await testId(`gem-${r}-${c + 1}`).click();
    await settle(1200);
    if ((await readScore()) !== before) { scored = true; break outer; }
  }
}
if (!scored) throw new Error('gemmatch: no swap produced a score');
results.gemmatch = await readScore();
await shot('gemmatch-2-playing');

// TAP STACK — start, drop several blocks, then let one miss.
await openGame('tapstack');
await tap(195, 500);
for (let i = 0; i < 5; i++) { await settle(700); await tap(195, 500); }
await shot('tapstack-2-playing');
for (let i = 0; i < 40 && !(await testId('game-over').count()); i++) { await settle(120); await tap(195, 500); }
await waitGameOver(5000);
results.tapstack = await readScore();
await shot('tapstack-3-over');

// BRIK BREAK — start, launch, wiggle the paddle, wait for lives to run out.
await openGame('brikbreak');
await tap(195, 500);
await settle(300);
await tap(195, 600);
await settle(1500);
await shot('brikbreak-2-playing');
for (let i = 0; i < 60 && !(await testId('game-over').count()); i++) {
  await page.mouse.move(60 + (i % 2) * 270, 600);
  await page.mouse.down(); await page.mouse.up();
  await settle(400);
}
await waitGameOver(30000);
results.brikbreak = await readScore();
await shot('brikbreak-3-over');

// ZIG ZAG — start, then never turn: should fall off.
await openGame('zigzag');
await tap(195, 500);
await settle(900);
await shot('zigzag-2-playing');
await waitGameOver();
results.zigzag = await readScore();
await shot('zigzag-3-over');

// SNAKE — start, turn via d-pad, then run into a wall.
await openGame('snake');
await tap(195, 500);
await settle(600);
await testId('snake-down').click();
await settle(600);
await shot('snake-2-playing');
await waitGameOver();
results.snake = await readScore();
await shot('snake-3-over');

// High scores should be persisted and shown on the hub.
await page.goto(BASE, { waitUntil: 'networkidle' });
await settle(600);
await shot('99-hub-after');
const hub = await page.textContent('body');
for (const [id, score] of Object.entries(results)) {
  if (score && Number(score) > 0 && !hub.includes(score)) throw new Error(`hub missing best for ${id} (${score})`);
}

await browser.close();
console.log('scores', results);
if (errors.length) {
  console.error('ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('SMOKE OK');
