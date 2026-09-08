const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('../web/node_modules/typescript');
function load(name) {
  const file = path.resolve(__dirname, `../web/lib/${name}.ts`);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const m = new Module(file, module); m.filename = file; m._compile(compiled, file); return m.exports;
}
const { parseEntry, SIX_HOURS, formatKst } = load('amorianCooldown');
const now = Date.parse('2026-09-08T23:00:00+09:00');
for (const raw of [null, '', 'oops', 'NaN', 'Infinity', '-1', '0', String(now + 1)]) assert.equal(parseEntry(raw, now), null);
assert.equal(parseEntry(String(now), now), now);
assert.equal(SIX_HOURS, 21600000);
assert.match(formatKst(now + SIX_HOURS), /9.*9.*05:00/);
const { percentile75, readVitals } = load('localVitals');
assert.equal(percentile75([]), null);
assert.equal(percentile75([100, 300, 200, 400]), 300);
assert.equal(percentile75([0]), 0);
global.localStorage = {getItem: () => '{bad'};
assert.deepEqual(readVitals(), []);
global.localStorage = {getItem: () => '[{"id":"a","name":"INP","value":10,"screen":"mobile"},{"id":"b","name":"SECRET","value":20,"screen":"desktop"}]'};
assert.equal(readVitals().length, 1);
console.log('PASS cooldown validation/KST rollover and local INP percentile/storage validation');
