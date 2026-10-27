const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const api = {};
new Function('exports', ts.transpileModule(fs.readFileSync(require.resolve('../features/reorder/order.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(api);
const { moveId, reconcileOrder, slots, insertionOrder } = api;
const ids = ['A', 'B', 'C', 'D'];
const heights = { A: 114, B: 294, C: 74, D: 194 }; // includes each measured gap

test('fourth item moves to second without mutating the original IDs', () => {
  assert.deepEqual(moveId(ids, 'D', 1), ['A', 'D', 'B', 'C']);
  assert.deepEqual(ids, ['A', 'B', 'C', 'D']);
});
test('first/last moves clamp and an unknown ID never creates an item', () => {
  assert.deepEqual(moveId(ids, 'D', -10), ['D', 'A', 'B', 'C']);
  assert.deepEqual(moveId(ids, 'A', 100), ['B', 'C', 'D', 'A']);
  assert.deepEqual(moveId(ids, 'missing', 0), ids);
});
test('positions use actual unequal heights including gaps', () => {
  assert.deepEqual(slots(ids, heights), { A: 0, B: 114, C: 408, D: 482 });
});
test('picking up any item at its original top leaves the order intact', () => {
  const positions = slots(ids, heights);
  for (const id of ids) assert.deepEqual(insertionOrder(ids, id, positions[id], heights), ids);
});
test('drag fourth to second, with stable order of its neighbours', () => {
  assert.deepEqual(insertionOrder(ids, 'D', 200, heights), ['A', 'D', 'B', 'C']);
});
test('tall item moves past short rows and can return', () => {
  const moved = insertionOrder(ids, 'B', 500, heights);
  assert.deepEqual(moved, ['A', 'C', 'D', 'B']);
  assert.deepEqual(insertionOrder(moved, 'B', 114, heights), ids);
});
test('short item can pass a tall row and reach first or last', () => {
  assert.deepEqual(insertionOrder(ids, 'C', -50, heights), ['C', 'A', 'B', 'D']);
  assert.deepEqual(insertionOrder(ids, 'C', 1000, heights), ['A', 'B', 'D', 'C']);
});
test('six pixel hysteresis prevents oscillation at the same boundary', () => {
  const original = ['A', 'B']; const measured = { A: 100, B: 100 };
  assert.deepEqual(insertionOrder(original, 'A', 55, measured), original);
  const moved = insertionOrder(original, 'A', 57, measured);
  assert.deepEqual(moved, ['B', 'A']);
  assert.deepEqual(insertionOrder(moved, 'A', 49, measured), moved);
  assert.deepEqual(insertionOrder(moved, 'A', 43, measured), original);
});
test('concurrent removal/addition never resurrects, duplicates, or loses an ID', () => {
  assert.deepEqual(reconcileOrder(['D', 'A', 'B', 'C', 'D'], ['A', 'C', 'D', 'E']), ['D', 'A', 'C', 'E']);
});
test('reconciling orders keeps the latest item data and completion state', () => {
  const current = [{ id: 'A', completed: true, notes: 'new note' }, { id: 'B', completed: false, sets: [1, 2] }];
  const byId = new Map(current.map(item => [item.id, item]));
  const ordered = reconcileOrder(['B', 'A'], current.map(item => item.id)).map(id => byId.get(id));
  assert.equal(ordered[0], current[1]); assert.equal(ordered[1], current[0]);
  assert.equal(ordered[1].completed, true); assert.equal(ordered[1].notes, 'new note');
});

const { foldedDragLayout } = api;
test('folding all rows preserves the grabbed card screen position when scrolled', () => {
  const compact = { A: 130, B: 150, C: 110, D: 140 };
  const layout = foldedDragLayout(ids, compact, 'D', 1650, 1500);
  assert.equal(layout.scrollOffset, 240);
  assert.equal(layout.origin.D - layout.scrollOffset, 150);
  assert.equal(layout.paddingTop, 0);
});
test('folding near the top uses padding instead of a negative scroll or a jumping card', () => {
  const compact = { A: 100, B: 100, C: 100, D: 100 };
  const layout = foldedDragLayout(ids, compact, 'D', 900, 500);
  assert.equal(layout.scrollOffset, 0);
  assert.equal(layout.paddingTop, 100);
  assert.equal(layout.origin.D - layout.scrollOffset, 400);
});
test('folded measurements leave the order unchanged until the finger moves', () => {
  const compact = { A: 100, B: 170, C: 140, D: 120 };
  const layout = foldedDragLayout(ids, compact, 'D', 900, 500);
  assert.deepEqual(insertionOrder(ids, 'D', layout.origin.D - layout.paddingTop, compact), ids);
});
test('compact slots include actual unequal header heights without overlap', () => {
  const compact = { A: 100, B: 170, C: 140, D: 120 };
  const layout = foldedDragLayout(ids, compact, 'B', 300, 200);
  for (let i = 1; i < ids.length; i++) {
    assert.equal(layout.origin[ids[i]], layout.origin[ids[i - 1]] + compact[ids[i - 1]]);
  }
});
test('expanding after drop can restore the same screen anchor', () => {
  const compact = { A: 100, B: 100, C: 100, D: 100 };
  const full = { A: 500, B: 600, C: 550, D: 450 };
  const layout = foldedDragLayout(ids, compact, 'D', 1650, 1500);
  const restoredScroll = layout.scrollOffset + slots(ids, full).D - layout.origin.D;
  assert.equal(restoredScroll, 1500);
});
