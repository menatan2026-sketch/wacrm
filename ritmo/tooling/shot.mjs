// Screenshot a page as a demo user (password ritmo-demo).
// Usage: BASE=http://localhost:3100 node tooling/shot.mjs <email|-> <path> <out.png> [light|dark] [width] [height]
// Prints the final URL and any console errors / failed requests.
import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const BASE = process.env.BASE ?? 'http://localhost:3100';
const { chromium } = require('@playwright/test');
const [email, path, out, theme = 'light', w = '1440', h = '1000'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, colorScheme: theme, locale: 'he-IL' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
try {
  if (email !== '-') {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', 'ritmo-demo');
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }), page.click('form button[type=submit] >> nth=0')]);
  }
  await page.goto(BASE + path, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out, fullPage: true });
  console.log('url', page.url(), 'errors', JSON.stringify(errors));
} catch (err) {
  console.error('shot failed:', err instanceof Error ? err.message : err, 'errors', JSON.stringify(errors));
  process.exitCode = 1;
} finally {
  await browser.close();
}
