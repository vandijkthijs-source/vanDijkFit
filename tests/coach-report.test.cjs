const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const ts = require('typescript');
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const previousLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, file) => module._compile(compile(file), file);
after(() => { if (previousLoader) require.extensions['.ts'] = previousLoader; else delete require.extensions['.ts']; });
const { buildCoachReportData } = require('../features/reports/coach-report.ts');
const exercise = { id: 'pdf-rest-exercise', name: 'Bench & Press', primaryMuscle: 'chest', secondaryMuscles: [], equipment: 'barbell', muscleContributions: { chest: 1 }, defaultRestSeconds: 45 };
function session(restSeconds) {
  return { id: 'pdf-rest-workout', templateName: 'Rest export', startedAt: '2026-10-29T09:00:00.000Z', endedAt: '2026-10-29T10:00:00.000Z', exercises: [{
    id: 'performed-bench', exerciseId: exercise.id, order: 0, restSeconds,
    exerciseSnapshot: exercise,
    sets: [{ id: 's1', completed: true, weight: 40, reps: 12 }, { id: 's2', completed: false, weight: 45, reps: 10 }, { id: 's3', completed: true, weight: 50, reps: 8 }],
  }] };
}
const rows = value => buildCoachReportData([session(value)], [exercise]).sessions[0].exercises[0].sets;

test('report includes recorded rest for every completed set, preserving set numbers', () => {
  assert.deepEqual(rows(90).map(row => [row.setNumber, row.restLabel]), [[1, '1:30'], [3, '1:30']]);
});
test('report uses historical workout rest instead of the current exercise default', () => {
  assert.equal(rows(120)[0].restLabel, '2:00');
  assert.equal(rows(undefined)[0].restLabel, '-');
});
test('rest formatting handles zero, seconds and long durations', () => {
  for (const [seconds, expected] of [[0, '0:00'], [45, '0:45'], [60, '1:00'], [125, '2:05'], [3600, '60:00']]) {
    assert.equal(rows(seconds)[0].restLabel, expected);
  }
});
test('invalid or absent historical rest is shown as unknown', () => {
  for (const value of [undefined, null, -1, NaN, Infinity]) assert.equal(rows(value)[0].restLabel, '-');
});

async function exportedHtml(workout, nativeOverrides, action = "shareCoachReportPdf", fileOverrides = {}) {
  let html;
  const file = require.resolve('../lib/pdf/coachReportPdf.ts');
  const baseRequire = createRequire(file);
  const mocks = {
    'react-native': { Platform: { OS: 'android', Version: 35 }, NativeModules: nativeOverrides ?? {} },
    'expo-file-system/legacy': { cacheDirectory: 'file:///test-cache/', copyAsync: async () => {}, deleteAsync: async () => {}, ...fileOverrides },
    'expo-print': { printToFileAsync: async input => { html = input.html; return { uri: 'file:///test-report.pdf' }; } },
    'expo-sharing': { isAvailableAsync: async () => false },
  };
  const exports = {};
  new Function('exports', 'require', compile(file))(exports, name => mocks[name] ?? baseRequire(name));
  await exports[action]({ sessions: [workout], exercises: [exercise] });
  return html;
}
test('actual PDF export supplies a rest column and escaped content to the print service', async () => {
  const html = await exportedHtml(session(90));
  assert.match(html, /<th>Rest \(m:ss\)<\/th>/);
  assert.equal((html.match(/<td>1:30<\/td>/g) ?? []).length, 2);
  assert.match(html, /Bench &amp; Press/);
  if (process.env.REPORT_PREVIEW_HTML) fs.writeFileSync(process.env.REPORT_PREVIEW_HTML, html);
});
test('empty exercises span all four columns', async () => {
  const workout = session(90); workout.exercises[0].sets = [];
  assert.match(await exportedHtml(workout), /colspan="4" class="empty-row">No completed sets logged/);
});

test('Downloads export sends the named PDF to Android and cleans the temporary file', async () => {
  let saved; let deleted;
  await exportedHtml(session(90), { ReportDownloads: { savePdf: async (...args) => { saved = args; } } },
    'saveCoachReportPdfToDownloads', { deleteAsync: async uri => { deleted = uri; } });
  assert.match(saved[1], /^vdstrong-coach-report-.*\.pdf$/);
  assert.equal(saved[0], `file:///test-cache/${saved[1]}`);
  assert.equal(deleted, saved[0]);
});
test('Downloads failure propagates and still cleans the temporary PDF', async () => {
  let deleted = false;
  await assert.rejects(exportedHtml(session(90), { ReportDownloads: { savePdf: async () => { throw new Error('Storage full'); } } },
    'saveCoachReportPdfToDownloads', { deleteAsync: async () => { deleted = true; } }), /Storage full/);
  assert.equal(deleted, true);
});
test('Downloads export explains when the installed native app needs updating', async () => {
  await assert.rejects(exportedHtml(session(90), {}, 'saveCoachReportPdfToDownloads'), /Install the updated Android app/);
});
