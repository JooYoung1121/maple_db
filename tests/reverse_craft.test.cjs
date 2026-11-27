// Run: node tests/reverse_craft.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../web/node_modules/typescript');
const source = fs.readFileSync(`${__dirname}/../web/lib/reverseCraft.ts`, 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS}}).outputText;
const exportsForTest = {};
new Function('exports', compiled)(exportsForTest);
const {attackDistribution} = exportsForTest;
const {weapons} = require('../data/reverse_weapons.json');
const bonus = [60,17.6,12.1,6.4,2.7,1.1];
const get = id => weapons.find(w => w.itemId === id);
for (const weapon of weapons) {
  const dist = [...attackDistribution(weapon, bonus)].filter(([, p]) => p > 0);
  assert.ok(Math.abs(dist.reduce((sum, [, p]) => sum + p, 0) - 1) < 1e-10);
  assert.equal(Math.min(...dist.map(([a]) => a)), weapon.baseAtk + 3 * weapon.levelMin);
  assert.equal(Math.max(...dist.map(([a]) => a)), weapon.baseAtk + 5 + 3 * (weapon.levelMin + weapon.levelWeights.length - 1) + 14);
}
// Retain the previous six-weapon physical calculation; Lampeon max 82.
assert.equal(Math.max(...attackDistribution(get(1472071), bonus).keys()), 82);
assert.equal(get(1472071).mainBase, 13);
// Magic growth is +1..4, not physical +0..2; INT is the main stat.
assert.equal(get(1382059).attackLabel, '마력');
assert.equal(get(1382059).mainName, 'INT');
assert.equal(Math.max(...attackDistribution(get(1382059), bonus).keys()), 169);
// Knuckle growth starts at +1; deterministic growth weights shift all outcomes.
const knuckle = get(1482024);
const minOnly = [...attackDistribution({...knuckle,levelWeights:[1,0]},[1,0,0,0,0,0])].filter(([,p])=>p>0);
assert.equal(Math.min(...minOnly.map(([a])=>a)), 88);
assert.equal(Math.max(...minOnly.map(([a])=>a)), 102);
// All-zero weights remain a normalized deterministic minimum, no NaNs.
const zeros = [...attackDistribution({...get(1382059),levelWeights:[0,0,0,0]},[0,0,0,0,0,0])];
assert.ok(zeros.every(([,p])=>Number.isFinite(p)));
assert.ok(Math.abs(zeros.reduce((s,[,p])=>s+p,0)-1)<1e-10);
console.log('Reverse weapons: 18 catalogs, distributions and magic/pirate boundaries passed');
