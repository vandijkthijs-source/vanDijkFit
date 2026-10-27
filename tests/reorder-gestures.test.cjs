const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(file, imports) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('exports', 'require', code)(exports, name => {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  });
  return exports;
}
function nativeHarness(pickup = true) {
  const callbacks = {}, config = {}, calls = [];
  const pan = new Proxy({}, { get: (_target, name) => value => {
    (String(name).startsWith('on') ? callbacks : config)[name] = value;
    return pan;
  }});
  const { createReorderPan } = load('../features/reorder/native-gesture.ts', {
    'react-native-gesture-handler': { Gesture: { Pan: () => pan } },
  });
  const scrollGesture = {};
  createReorderPan({ enabled: true, scrollGesture,
    pickUp: y => { calls.push(['pickUp', y]); return pickup; },
    move: y => calls.push(['move', y]), drop: () => calls.push(['drop']), cancel: () => calls.push(['cancel']),
  });
  return { callbacks, config, calls, scrollGesture };
}

test('native recognizer waits 350ms, fails early scrolling and makes scroll wait for recognition', () => {
  const { config, scrollGesture } = nativeHarness();
  assert.equal(config.activateAfterLongPress, 350);
  assert.deepEqual(config.failOffsetX, [-8, 8]);
  assert.deepEqual(config.failOffsetY, [-8, 8]);
  assert.equal(config.blocksExternalGesture, scrollGesture);
  assert.equal(config.maxPointers, 1);
  assert.equal(config.runOnJS, true); // no Reanimated/manual state-manager dependency
});
test('short tap or early scroll does not pick up or commit an item', () => {
  const { callbacks, calls } = nativeHarness();
  callbacks.onBegin({ absoluteY: 200 });
  callbacks.onFinalize({}, false);
  assert.deepEqual(calls, []);
});
test('pickup and dragging use the same touch and preserve the initial finger offset', () => {
  const { callbacks, calls } = nativeHarness();
  callbacks.onBegin({ absoluteY: 200 });
  callbacks.onStart({ absoluteY: 203 });
  callbacks.onUpdate({ absoluteY: 430 });
  callbacks.onEnd({}, true);
  callbacks.onFinalize({}, true);
  assert.deepEqual(calls, [['pickUp', 200], ['move', 203], ['move', 430], ['drop']]);
});
test('native interruption cancels once and never commits', () => {
  const { callbacks, calls } = nativeHarness();
  callbacks.onBegin({ absoluteY: 200 }); callbacks.onStart({ absoluteY: 200 });
  callbacks.onEnd({}, false); callbacks.onFinalize({}, false);
  assert.equal(calls.filter(([name]) => name === 'cancel').length, 1);
  assert.equal(calls.some(([name]) => name === 'drop'), false);
});
test('finalization without normal release also cancels the active preview', () => {
  const { callbacks, calls } = nativeHarness();
  callbacks.onBegin({ absoluteY: 200 }); callbacks.onStart({ absoluteY: 200 });
  callbacks.onFinalize({}, false);
  assert.deepEqual(calls.at(-1), ['cancel']);
});
test('missing row measurements cannot commit a native gesture', () => {
  const { callbacks, calls } = nativeHarness(false);
  callbacks.onBegin({ absoluteY: 200 }); callbacks.onStart({ absoluteY: 200 });
  callbacks.onUpdate({ absoluteY: 500 }); callbacks.onEnd({}, true); callbacks.onFinalize({}, true);
  assert.deepEqual(calls, [['pickUp', 200]]);
});

function controlsHarness() {
  const calls = []; let dragging = false;
  const touch = { block: () => calls.push('block'), release: () => calls.push('release'), isDragging: () => dragging };
  const controls = load('../components/ui/ReorderControls.tsx', {
    'react': { createContext: () => ({}), useContext: () => touch, forwardRef: render => render },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { Pressable: 'Pressable', TextInput: 'TextInput' },
  });
  return { ...controls, calls, setDragging: value => { dragging = value; } };
}
test('creatine/header row action allows dragging and keeps its short-tap action', () => {
  const h = controlsHarness(); const action = h.ReorderRowPressable({ onPress: () => h.calls.push('open') }, null);
  assert.equal(action.props.onTouchStart, undefined); // broad row actions do not reject pickup
  action.props.onPress({}); assert.deepEqual(h.calls, ['open']);
  h.setDragging(true); action.props.onPress({});
  assert.deepEqual(h.calls, ['open']); // releasing a long press must not navigate/open a dialog
});
test('dose/check/delete controls reject dragging and keep their own action', () => {
  const h = controlsHarness(); const button = h.ReorderPressable({ onPress: () => h.calls.push('dose') }, null);
  button.props.onTouchStart({}); button.props.onPress({}); button.props.onTouchEnd({});
  assert.deepEqual(h.calls, ['block', 'dose', 'release']);
});
test('input exclusion releases after touch cancellation instead of leaving a row disabled', () => {
  const h = controlsHarness(); const input = h.ReorderTextInput({ onTouchStart: () => h.calls.push('focus-handler') }, null);
  input.props.onTouchStart({}); input.props.onTouchCancel({});
  assert.deepEqual(h.calls, ['block', 'focus-handler', 'release']);
});
