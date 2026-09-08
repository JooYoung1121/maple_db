// Requires Playwright + Chrome. Only runs against a local audit server.
// NODE_PATH=/path/to/test/node_modules node scripts/test_site_audit_browser.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.AUDIT_BASE || 'http://localhost:3101';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Never mutate production');

(async () => {
  assert((await fetch(base + '/api/health')).ok, 'Wait for backend readiness before testing');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, colorScheme: 'dark', reducedMotion: 'reduce'});
    const requests = [];
    let failSave = true;
    await context.route('**/api/game-results', route => {
      if (route.request().method() !== 'POST') return route.continue();
      requests.push(route.request().postDataJSON());
      return route.fulfill({status: failSave ? 500 : 200, contentType: 'application/json', body: JSON.stringify(failSave ? {detail:'simulated'} : {id: 1, ok: true})});
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/pq?tab=timer');
    const kenta = page.locator('.pixel-panel').filter({has: page.getByRole('heading', {name: /켄타/})});
    await kenta.getByRole('button', {name: '+', exact: true}).waitFor();
    for (let i = 0; i < 10; i++) await kenta.getByRole('button', {name: '+', exact: true}).click();
    assert(await kenta.getByRole('button', {name: '+', exact: true}).isDisabled());
    assert((await kenta.innerText()).replace(/\s/g, '').includes('0/10'));
    assert(await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('pq-counters'))).some(c => c.count === 10)));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole('button', {name: '지금 입장 기록'}).click();
    const timestamp = await page.evaluate(() => localStorage.getItem('maple-amorian-entry-v1'));
    assert(timestamp && Math.abs(Date.now() - Number(timestamp)) < 15000);
    await page.reload();
    await page.getByText(/마지막 입장/).waitFor();
    await page.getByLabel('직접 입력 (한국 시간)').fill('2099-01-01T12:00');
    await page.getByRole('button', {name: '시각 저장', exact: true}).click();
    assert((await page.locator('main').getByRole('alert').innerText()).includes('이전'));
    assert.equal(await page.evaluate(() => localStorage.getItem('maple-amorian-entry-v1')), timestamp);
    console.log('PASS Kenta 10/10, APQ persistence and future-time rejection');

    await page.goto(base + '/play');
    await page.getByRole('button', {name: '🎲 주사위', exact: true}).click();
    for (const name of ['감사A', '감사B']) {
      await page.getByPlaceholder('닉네임 입력').fill(name);
      await page.getByRole('button', {name: '추가', exact: true}).click();
    }
    page.once('dialog', dialog => dialog.accept());
    await page.getByPlaceholder('닉네임 입력').fill('감사A');
    await page.getByRole('button', {name: '추가', exact: true}).click();
    await page.evaluate(() => { Math.random = () => 0.5; });
    await page.getByRole('button', {name: '🎲 주사위 굴리기', exact: true}).click();
    await page.getByRole('button', {name: '📋 기록 저장', exact: true}).waitFor();
    assert.equal(await page.getByLabel('공동 순위를 포함한 1위').count(), 2);
    const colors = await page.locator('.absolute.rounded-full.bg-gray-800').first().evaluate(e => [getComputedStyle(e).backgroundColor, getComputedStyle(e.parentElement.parentElement).backgroundColor]);
    assert.notEqual(colors[0], colors[1]);
    await page.getByRole('button', {name: '📋 기록 저장', exact: true}).click();
    await page.locator('main').getByRole('alert').waitFor();
    assert.equal(await page.getByText('✓ 저장됨', {exact: true}).count(), 0);
    assert.deepEqual(requests[0].participants, ['감사A', '감사B']);
    assert.deepEqual(requests[0].result.winners, ['감사A', '감사B']);
    failSave = false;
    await page.getByRole('button', {name: '📋 기록 저장', exact: true}).click();
    await page.getByText('✓ 저장됨', {exact: true}).waitFor();
    console.log('PASS tie winners, duplicate names, dark dots, failed-save retry');

    await page.goto(base + '/battle-mage');
    await page.getByText('필요 마북과 획득 경로 펼치기', {exact: true}).click();
    const book = page.getByRole('checkbox', {name: '피니쉬 블로우 20', exact: true});
    await book.check();
    await page.reload();
    await page.getByText('필요 마북과 획득 경로 펼치기', {exact: true}).click();
    assert(await book.isChecked());
    await page.goto(base + '/skills/381');
    await page.getByText('메랜 공식 · 2026-09-07 조정', {exact: true}).waitFor();
    assert.equal(await page.locator('details').getAttribute('open'), null);
    await page.goto(base + '/skills/91');
    await page.getByText('도적', {exact: true}).first().waitFor();
    await page.goto(base + '/quests/9');
    await page.getByText(/공략 2건을 교차/).waitFor();
    assert(!(await page.locator('main').innerText()).includes('다크스텀프 드롭 아이템'));
    console.log('PASS mastery persistence, historical skill table, old skill URL, Maya provenance');

    await page.goto(base + '/quiz?theme=edelstein');
    await page.getByRole('button', {name: /에델슈타인/}).waitFor();
    assert((await page.getByRole('button', {name: /에델슈타인/}).getAttribute('class')).includes('pixel-btn'));
    await page.goto(base + '/playground');
    const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul'}).format(new Date());
    await page.evaluate(day => localStorage.setItem(`daily_mob_${day}`, JSON.stringify({solved: true})), today);
    await page.reload();
    await page.getByText('✓ 오늘 완료', {exact: true}).waitFor();
    await page.goto(base + '/performance');
    await page.getByRole('checkbox', {name: '로컬 성능 기록 켜기'}).check();
    assert.equal(await page.evaluate(() => localStorage.getItem('maple-local-vitals-enabled')), '1');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log('PASS themed quiz, daily completion hub, opt-in diagnostics; no page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
