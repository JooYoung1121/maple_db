// Exercise calculator behavior independently of React and live market prices.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('../web/node_modules/typescript');
const filename = path.resolve(__dirname, '../web/lib/marketComparison.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const engine = new Module(filename, module);
engine._compile(compiled, filename);
const { money, incrementalCost, replacementCost, applicationFee, gemEligibility,
  projectGemOptions, sameFinalOptions, gemCost } = engine.exports;

const base = {
  key: 'active:a', id: 'a', kind: 'active', itemId: 1072221, name: '블루 크리센트부츠',
  unitPrice: '18000000', quantity: '1', fetchedAt: '2026-11-19T00:00:00Z', sourceUrl: '',
  soldAt: null, expiresAt: null,
  options: { stats: { strength: 4, dexterity: 6, accuracy: 2 }, upgradeCount: 4, remainingUpgrades: 0,
    requiredLevelAdjustment: 0, gemApplied: false, gems: [], complete: true, status: 'inferred' },
};
const candidate = (price, dexterity) => ({ ...base, unitPrice: price,
  options: { ...base.options, stats: { ...base.options.stats, dexterity } } });
const gem = (grade, stat = 'strength', amount = [1, 3, 5][grade]) => ({
  code: 6008 + grade * 10000, itemId: 4250800 + grade, name: 'test', grade, stat, amount, weaponOnly: false,
});

assert.equal(money('9007199254740993'), 9007199254740993n);
assert.equal(money(''), null);
assert.equal(money('-1'), null);
assert.equal(money('1.5'), null);
assert.equal(money('0'), 0n);
assert.deepEqual(incrementalCost(base, candidate('25000000', 8), 'dexterity'), { delta: 2, extra: 7000000n, perPoint: 3500000n });
assert.equal(incrementalCost(base, candidate('18000001', 9), 'dexterity').perPoint, 1n);
assert.equal(incrementalCost(base, candidate('17000000', 9), 'dexterity').extra, -1000000n);
assert.equal(incrementalCost(base, candidate('25000000', 6), 'dexterity').perPoint, null);
assert.equal(incrementalCost(base, candidate('25000000', 3), 'dexterity').perPoint, null);
assert.equal(incrementalCost(base, { ...base, options: { ...base.options, complete: false } }, 'dexterity'), null);
assert.equal(replacementCost('25000000', '18000000', '1000000'), 8000000n);
assert.equal(replacementCost('25000000', '', '0'), null);
assert.equal(replacementCost('18000000', '25000000', '0'), -7000000n);

assert.equal(applicationFee([gem(2), gem(2), gem(2)]), 9500000n);
assert.equal(applicationFee([gem(1), gem(1), gem(1)]), 7250000n);
assert.equal(applicationFee([gem(0), gem(0), gem(0)]), 5000000n);
assert.equal(applicationFee([gem(0), gem(1), gem(2)]), 7250000n);
assert.equal(applicationFee([gem(2)]), 5000000n);
assert.equal(applicationFee([]), null);
assert.equal(applicationFee([gem(0), gem(0), gem(0), gem(0)]), null);
assert.equal(applicationFee([{ ...gem(0), grade: 3 }]), null);

const gems = [gem(1), gem(1, 'dexterity'), gem(2, 'accuracy')];
const projected = projectGemOptions(base, gems);
assert.deepEqual(projected.stats, { strength: 7, dexterity: 9, accuracy: 7 });
assert.equal(base.options.stats.strength, 4, 'projection must not mutate searched options');
assert.ok(gemEligibility({ ...base, options: projected }, gems), 'cannot apply twice');
assert.ok(gemEligibility({ ...base, kind: 'sold' }, gems));
assert.ok(gemEligibility({ ...base, itemId: 1122058 }, gems));
assert.ok(gemEligibility(base, [gem(1), gem(2)]), 'different grades of same gem still duplicate');
assert.ok(gemEligibility(base, [{ ...gem(2, 'attack'), weaponOnly: true }]));
assert.equal(gemEligibility({ ...base, itemId: 1472052 }, [{ ...gem(2, 'attack'), weaponOnly: true }]), null);
assert.equal(projectGemOptions({ ...base, options: { ...base.options, gemApplied: null } }, gems), null);
assert.equal(projectGemOptions(base, [gem(2, 'requiredLevelAdjustment', -3)]).requiredLevelAdjustment, -3);

const target = { ...base, options: projected };
assert.equal(sameFinalOptions(base, projected, target), true);
assert.equal(sameFinalOptions(base, projected, { ...target, itemId: 1072222 }), false);
assert.equal(sameFinalOptions(base, projected, { ...target, options: { ...projected, remainingUpgrades: 1 } }), false);
assert.equal(sameFinalOptions(base, projected, { ...target, options: { ...projected, requiredLevelAdjustment: null } }), false);
assert.equal(sameFinalOptions(base, projected, { ...target, options: { ...projected, stats: { ...projected.stats, jump: 1 } } }), false);
assert.equal(gemCost('18000000', ['1000000', '2000000', '3000000'], '9500000'), 33500000n);
assert.equal(gemCost('18000000', ['1000000', ''], '9500000'), null);
assert.equal(gemCost('18000000', [], '9500000'), null);
assert.equal(gemCost('9007199254740993', ['0'], '5000000'), 9007199259740993n);
console.log('Market comparison: integer prices, stat deltas, upgrade cost, gem fees and eligibility passed.');
