const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Render the actual card's element tree with lightweight native/hook substitutes.
// Check that folding changes visibility, rather than destroying set/input instances.
function renderCard(folded) {
  const react = {
    useMemo: fn => fn(), useEffect: () => {}, useRef: value => ({ current: value }),
    useState: value => [typeof value === 'function' ? value() : value, () => {}],
  };
  const styles = { create: value => value, absoluteFillObject: {} };
  const mocks = {
    'react': react,
    'react/jsx-runtime': { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }), Fragment: 'Fragment' },
    'react-native': { Animated: { View: 'Animated.View' }, PanResponder: {}, StyleSheet: styles, Text: 'Text', View: 'View', TextInput: 'TextInput' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '../ui/ReorderControls': { ReorderRowPressable: 'RowPressable', ReorderPressable: 'Control', ReorderTextInput: 'Input' },
    '../../hooks/useExerciseStats': { useExerciseStats: () => ({ timesTrained: 0 }) },
    '../../constants/theme': { radii: {}, useThemeColors: () => ({}) },
    '../../utils/date': { daysAgoText: () => 'Never' },
    '../../utils/format': { formatMuscleSplitSummary: () => 'Legs', formatWeightReps: () => '-', titleCase: value => value },
    '../ui/AppInput': { default: 'NotesInput' },
    './SetRow': { default: 'SetRow' }, '../../lib/ui/alert': { showAlert: () => {} },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../components/workout/ExerciseCard.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('exports', 'require', code)(exports, name => {
    assert.ok(name in mocks, `Unexpected runtime import ${name}`);
    return mocks[name];
  });
  const performedExercise = { id: 'exercise-1', restSeconds: 90, notes: 'Keep this note', sets: [
    { id: 'set-1', weight: 40, reps: 12, completed: true },
    { id: 'set-2', weight: 45, reps: 10, completed: false },
  ] };
  return exports.default({ folded, exercise: { id: 'squat', name: 'Squat', equipment: 'Barbell' }, performedExercise,
    activeRestSetId: 'set-1', remainingSeconds: 30, restTimerDurationSeconds: 90, finishedRestSetIds: [],
  });
}
function all(node) {
  if (Array.isArray(node)) return node.flatMap(all);
  if (!node || typeof node !== 'object') return [];
  return [node, ...all(node.props?.children)];
}
test('folded card keeps title, column headings and an explicit folded icon/label', () => {
  const tree = all(renderCard(true));
  const texts = tree.filter(node => node.type === 'Text').map(node => node.props.children);
  for (const text of ['Squat', 'SET', 'PREVIOUS SETS', 'KG', 'REPS', 'OK', 'FOLDED']) assert.ok(texts.includes(text), text);
  const badge = tree.find(node => node.props?.testID === 'exercise-folded-exercise-1');
  assert.ok(badge);
  assert.ok(all(badge).some(node => node.type === 'Icon' && node.props.name === 'chevron-down-outline'));
});
test('folded and expanded cards retain identical set keys, values, completion and notes', () => {
  const full = all(renderCard(false)), folded = all(renderCard(true));
  for (const nodes of [full, folded]) {
    const sets = nodes.filter(node => node.type === 'SetRow');
    assert.deepEqual(sets.map(node => [node.props.weight, node.props.reps, node.props.completed]), [[40, 12, true], [45, 10, false]]);
    assert.equal(nodes.find(node => node.type === 'NotesInput').props.value, 'Keep this note');
    assert.ok(nodes.some(node => node.key === 'set-1')); assert.ok(nodes.some(node => node.key === 'set-2'));
  }
});
test('folding is one visibility change, with no height measurement/animation feedback', () => {
  const hidden = all(renderCard(true)).find(node => node.props?.testID === 'exercise-details-exercise-1');
  const open = all(renderCard(false)).find(node => node.props?.testID === 'exercise-details-exercise-1');
  assert.equal(hidden.type, 'View'); assert.equal(open.type, 'View');
  assert.equal(hidden.props.style.display, 'none'); assert.equal(open.props.style, undefined);
  assert.equal(hidden.props.importantForAccessibility, 'no-hide-descendants');
  assert.equal(hidden.props.onLayout, undefined);
});
