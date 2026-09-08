// No browser/framework required: compile the pure TS module in memory and test
// every possible answer from the contributed decision tables.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('../web/node_modules/typescript');
const filename = path.resolve(__dirname, '../web/lib/amorianSolver.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const engine = new Module(filename, module);
engine.filename = filename;
engine.paths = Module._nodeModulePaths(path.dirname(filename));
engine._compile(compiled, filename);
const { TREES, movement, replay, restoreSession, newSession, PLATFORM_LABELS } = engine.exports;

const ropes = [];
for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5 - a; b++) ropes.push([a, b, 5 - a - b]);
const platforms = [];
for (let mask = 0; mask < 512; mask++) {
  const combination = Array.from({ length: 9 }, (_, i) => i + 1).filter(n => mask & (1 << (n - 1)));
  if (combination.length === 5) platforms.push(combination);
}
const score = (mode, query, answer) => mode === 'rope'
  ? query.filter((n, i) => n === answer[i]).length
  : query.filter(n => answer.includes(n)).length;

function checkMovement(mode, from, to) {
  if (!from) { assert.deepEqual(movement(mode, from, to), []); return; }
  const moves = movement(mode, from, to);
  const actual = [...from];
  let count = 0;
  for (const move of moves) {
    assert.ok(move.count > 0);
    count += move.count;
    if (mode === 'rope') {
      actual[move.from] -= move.count;
      actual[move.to] += move.count;
      assert.ok(actual.every(n => n >= 0));
    } else {
      assert.ok(actual.includes(move.from));
      assert.ok(!actual.includes(move.to));
      actual.splice(actual.indexOf(move.from), 1, move.to);
    }
  }
  assert.deepEqual(mode === 'rope' ? actual : actual.sort((a, b) => a - b), to);
  const minimum = mode === 'rope' ? from.reduce((n, v, i) => n + Math.abs(v - to[i]), 0) / 2 : from.filter(n => !to.includes(n)).length;
  assert.equal(count, minimum);
}

for (const [mode, answers, limit] of [['rope', ropes, 4], ['platform', platforms, 5]]) {
  assert.equal(answers.length, mode === 'rope' ? 21 : 126);
  let maxChecks = 0;
  for (const answer of answers) {
    let candidates = answers;
    const results = [];
    let previous;
    while (true) {
      const state = replay(mode, results);
      assert.equal(state.solved, null);
      assert.equal(state.node.candidates, candidates.length);
      assert.equal(state.node.qno, results.length + 1);
      checkMovement(mode, previous, state.node.q);
      const possible = [...new Set(candidates.map(a => score(mode, state.node.q, a)))].sort();
      assert.deepEqual(Object.keys(state.node.children).map(Number).sort(), possible);
      const result = score(mode, state.node.q, answer);
      candidates = candidates.filter(a => score(mode, state.node.q, a) === result);
      previous = state.node.q;
      results.push(result);
      assert.ok(results.length <= limit, `${mode} exceeds ${limit} checks`);
      const next = replay(mode, results);
      assert.deepEqual(next.valid, results);
      if (next.solved) {
        assert.equal(candidates.length, 1);
        assert.deepEqual(next.solved.answer, answer);
        assert.equal(next.solved.directClear, result === (mode === 'rope' ? 3 : 5));
        checkMovement(mode, previous, answer);
        // Undo from any solved state restores the exact preceding query.
        assert.deepEqual(replay(mode, results.slice(0, -1)).node.q, previous);
        const saved = newSession(); saved.mode = mode; saved.sessions[mode] = results;
        assert.deepEqual(restoreSession(JSON.stringify(saved)), saved);
        maxChecks = Math.max(maxChecks, results.length);
        break;
      }
    }
  }
  console.log(`${mode}: ${answers.length} answers verified, at most ${maxChecks} feedback inputs; all movement plans and restores valid`);
}

assert.deepEqual(PLATFORM_LABELS, ['A', '2', 'B', '3', 'C', '6', 'D', '9', '5']);
for (const raw of ['bad JSON', 'null', '{}', '{"version":2}', JSON.stringify({ ...newSession(), mode: '__proto__' }),
  JSON.stringify({ ...newSession(), sessions: { rope: [2], platform: [] } }),
  JSON.stringify({ ...newSession(), sessions: { rope: ['1'], platform: [] } }),
  JSON.stringify({ ...newSession(), sessions: { rope: [3, 0], platform: [] } })]) assert.equal(restoreSession(raw), null);
const independent = { ...newSession(), sessions: { rope: [1], platform: [4] } };
assert.deepEqual(restoreSession(JSON.stringify(independent)), independent);
assert.equal(replay('rope', [2, 1]).valid.length, 0);
assert.equal(replay('platform', [0]).valid.length, 0);
assert.deepEqual(movement('rope', [5, 0, 0], [4, 1, 0]), [{ from: 0, to: 1, count: 1 }]);
assert.deepEqual(movement('platform', [1, 2, 3, 4, 5], [1, 2, 3, 4, 6]), [{ from: 5, to: 6, count: 1 }]);
console.log('Corrupt storage, invalid feedback, independent sessions, labels and movement regression checks passed.');
