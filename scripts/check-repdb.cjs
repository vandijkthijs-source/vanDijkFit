// Run with: node --test scripts/check-repdb.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const cache = new Map();
const stored = new Map();
const storagePath = path.join(root, "lib/storage/asyncStorage.ts");
const imagePaths = new Set();

// Load the real domain/store code without the native React Native runtime.
// Storage is isolated in memory and bundled images are validated on disk.
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  if (file === storagePath) return { AsyncStorage: {
    getItem: async (key) => stored.get(key) ?? null,
    setItem: async (key, value) => { stored.set(key, value); },
    removeItem: async (key) => { stored.delete(key); },
  } };
  if (file.endsWith(".json")) return JSON.parse(fs.readFileSync(file, "utf8"));
  if (file.endsWith(".webp")) {
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF", file);
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP", file);
    assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, file);
    imagePaths.add(file);
    return file;
  }
  const module = { exports: {} };
  cache.set(file, module);
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = (specifier) => {
    if (!specifier.startsWith(".")) return require(specifier);
    const base = path.resolve(path.dirname(file), specifier);
    const resolved = [base, `${base}.ts`, `${base}.json`].find((candidate) =>
      fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!resolved) throw new Error(`Cannot resolve ${specifier} from ${file}`);
    return load(resolved);
  };
  new Function("exports", "require", "module", output)(module.exports, localRequire, module);
  return module.exports;
}

const { exercisesSeed } = load(path.join(root, "data/exercises.seed.ts"));
const { getRepDbExercise } = load(path.join(root, "features/exercises/repdb-catalog.ts"));
const { existingRepDbMatches, repDbSynonyms } = load(path.join(root, "data/repdb/matches.ts"));
const { repDbImages } = load(path.join(root, "data/repdb/images.ts"));
const { aggregateToMajorMuscleContributions } = load(path.join(root, "constants/muscles.ts"));
const { useAppStore } = load(path.join(root, "store/useAppStore.ts"));
const catalog = load(path.join(root, "data/repdb/catalog.json"));
const source = load(path.join(root, "data/repdb/source.json"));
const originals = exercisesSeed.filter((exercise) => !exercise.id.startsWith("repdb-"));
const added = exercisesSeed.filter((exercise) => exercise.id.startsWith("repdb-"));

test("the complete source catalog is covered without duplicate IDs or alias imports", () => {
  assert.equal(catalog.length, source.exerciseCount);
  assert.equal(new Set(exercisesSeed.map((exercise) => exercise.id)).size, exercisesSeed.length);
  const originalIds = new Set(originals.map((exercise) => exercise.id));
  const sourceIds = new Set(catalog.map((exercise) => exercise.id));
  const matched = new Set(Object.values(existingRepDbMatches));
  for (const [appId, sourceId] of Object.entries(existingRepDbMatches)) {
    assert.ok(originalIds.has(appId), appId);
    assert.ok(sourceIds.has(sourceId), sourceId);
  }
  for (const exercise of catalog) {
    const imported = added.some((item) => item.id === `repdb-${exercise.id}`);
    const covered = matched.has(exercise.id) || matched.has(repDbSynonyms[exercise.id]);
    assert.equal(imported, !covered, exercise.id);
  }
});

test("every mapped/new exercise has local images and all image assets are valid", () => {
  for (const exercise of exercisesSeed) {
    const sourceExercise = getRepDbExercise(exercise.id);
    if (!sourceExercise) {
      assert.ok(!exercise.id.startsWith("repdb-"), exercise.id);
      continue;
    }
    assert.ok(repDbImages[sourceExercise.id]?.length > 0, exercise.id);
  }
  assert.equal(imagePaths.size, source.imageCount);
  assert.equal(getRepDbExercise("a-user-created-exercise"), undefined);
});

test("all numeric contributions stay normalized and survive the app's muscle aggregation", () => {
  for (const exercise of added) {
    const values = Object.values(exercise.muscleContributions);
    assert.ok(values.every((value) => Number.isFinite(value) && value > 0), exercise.id);
    assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) < 1e-9, exercise.id);
    const aggregated = aggregateToMajorMuscleContributions(exercise.muscleContributions);
    assert.ok(Math.abs(Object.values(aggregated).reduce((sum, value) => sum + value, 0) - 1) < 1e-9, exercise.id);
    assert.ok(exercise.muscleContributions[exercise.primaryMuscle] > 0, exercise.id);
    assert.ok(exercise.secondaryMuscles.every((muscle) => muscle !== exercise.primaryMuscle), exercise.id);
  }
});

test("equipment variants remain separate and unsupported anatomy is not relabeled", () => {
  assert.equal(exercisesSeed.find((exercise) => exercise.id === "glute-bridge").equipment, "barbell");
  assert.equal(exercisesSeed.find((exercise) => exercise.id === "repdb-glute-bridge").equipment, "bodyweight");
  assert.equal(exercisesSeed.find((exercise) => exercise.id === "repdb-kettlebell-squat").equipment, "kettlebell");
  assert.equal(exercisesSeed.find((exercise) => exercise.id === "repdb-banded-squat").equipment, "band");
  assert.equal(exercisesSeed.find((exercise) => exercise.id === "repdb-90-90-hold").primaryMuscle, "hip_flexors");
});

test("rehydration adds catalog entries while preserving user edits, photos and workout snapshots", () => {
  const current = useAppStore.getState();
  const modified = { ...originals[0], isModified: true, name: "My bench", muscleContributions: { chest: 1 }, imageUri: "file:///my-bench.jpg" };
  const withPreferences = { ...originals[1], notes: "My cue", defaultRestSeconds: 42 };
  const custom = { ...modified, id: "custom-exercise", isCustom: true };
  const snapshot = { ...originals[0], name: "Historical bench", muscleContributions: { chest: 1 } };
  const session = { id: "history", startedAt: "2026-01-01T12:00:00Z", exercises: [{
    id: "performed", exerciseId: snapshot.id, order: 0, sets: [], exerciseSnapshot: snapshot,
  }] };
  const persisted = { exercises: [modified, withPreferences, custom], workoutHistory: [session], activeWorkout: session };
  const merged = useAppStore.persist.getOptions().merge(persisted, current);
  assert.strictEqual(merged.exercises.find((exercise) => exercise.id === modified.id), modified);
  assert.strictEqual(merged.exercises.find((exercise) => exercise.id === custom.id), custom);
  assert.equal(merged.exercises.find((exercise) => exercise.id === withPreferences.id).notes, "My cue");
  assert.equal(merged.exercises.find((exercise) => exercise.id === withPreferences.id).defaultRestSeconds, 42);
  assert.strictEqual(merged.workoutHistory[0].exercises[0].exerciseSnapshot, snapshot);
  assert.strictEqual(merged.activeWorkout.exercises[0].exerciseSnapshot, snapshot);
  assert.equal(merged.exercises.length, exercisesSeed.length + 1);
  assert.equal(merged.exercises.filter((exercise) => exercise.id.startsWith("repdb-")).length, added.length);
});

test("a newly imported exercise can be added to a workout with its own snapshot", () => {
  const exercise = added.find((item) => item.id === "repdb-90-90-hold");
  useAppStore.getState().startOpenWorkout([exercise.id]);
  const performed = useAppStore.getState().activeWorkout.exercises[0];
  assert.equal(performed.exerciseId, exercise.id);
  assert.deepEqual(performed.exerciseSnapshot.muscleContributions, exercise.muscleContributions);
  assert.notStrictEqual(performed.exerciseSnapshot.muscleContributions, exercise.muscleContributions);
  useAppStore.getState().cancelActiveWorkout();
});

test("catalog assets do not become user photos in persisted backup data", () => {
  const { createAppPersistedState } = load(path.join(root, "store/useAppStore.ts"));
  const state = createAppPersistedState(useAppStore.getState());
  assert.equal(state.exercises.filter((exercise) => exercise.imageUri).length, 0);
  assert.ok(!JSON.stringify(state).includes("assets/exercises/repdb"));
});

const { curatedExerciseIds, getExerciseRecency, selectLibraryExercises } =
  load(path.join(root, "features/exercises/exercise-library.ts"));

const { exerciseCategories, getExerciseCategory } =
  load(path.join(root, "features/exercises/exercise-category.ts"));

test("curation selects 67 original and 108 RepDB exercises, preserving all 657 entries", () => {
  const defaults = exerciseCategories.flatMap(({ value }) => selectLibraryExercises(exercisesSeed, "", value, new Map()));
  assert.equal(exercisesSeed.length, 657);
  assert.equal(curatedExerciseIds.size, 175);
  assert.equal(defaults.length, 175);
  assert.equal(defaults.filter((exercise) => !exercise.id.startsWith("repdb-")).length, 67);
  assert.equal(defaults.filter((exercise) => exercise.id.startsWith("repdb-")).length, 108);
  assert.equal(new Set(defaults.map((exercise) => exercise.id)).size, 175);
  assert.equal(exercisesSeed.length - defaults.length, 482);
  const groups = load(path.join(root, "data/exercises.curated.json"));
  const ids = new Set(exercisesSeed.map((exercise) => exercise.id));
  for (const [group, selection] of Object.entries(groups)) {
    assert.ok(selection.length > 0, group);
    for (const id of selection) assert.ok(ids.has(id), `${group}: ${id}`);
  }
});

test("category search reaches every exercise and custom exercises remain visible under Strength", () => {
  const custom = { ...exercisesSeed[0], id: "custom-test", name: "My movement", isCustom: true };
  const exercises = [...exercisesSeed, custom];
  assert.ok(selectLibraryExercises(exercises, "", "strength", new Map()).includes(custom));
  for (const exercise of exercises) {
    const category = getExerciseCategory(exercise);
    const matches = selectLibraryExercises(exercises, exercise.name, category, new Map());
    assert.ok(matches.some((result) => result.id === exercise.id), exercise.name);
    assert.ok(matches.every((result) => getExerciseCategory(result) === category));
  }
  assert.equal(selectLibraryExercises(exercises, "  ", "strength", new Map()).length, 149);
  assert.equal(selectLibraryExercises(exercises, "no-exercise-matches-this", "strength", new Map()).length, 0);
});

test("Strength, Cardio and Mobility partition the selected library without changing scoring eligibility", () => {
  const expected = { strength: 148, cardio: 17, mobility: 10 };
  for (const { value } of exerciseCategories) {
    const entries = selectLibraryExercises(exercisesSeed, "", value, new Map());
    assert.equal(entries.length, expected[value], value);
    assert.ok(entries.every((exercise) => getExerciseCategory(exercise) === value));
  }
  assert.equal(getExerciseCategory({ id: "repdb-kettlebell-swing" }), "cardio");
  assert.equal(getExerciseCategory({ id: "repdb-cat-cow" }), "mobility");
  assert.equal(getExerciseCategory({ id: "repdb-air-bike" }), "cardio");
  assert.equal(getExerciseCategory({ id: "repdb-archer-pull-ups" }), "strength");
  assert.equal(selectLibraryExercises(exercisesSeed, "Rowing Machine", "strength", new Map()).length, 0);
  assert.equal(selectLibraryExercises(exercisesSeed, "Zottman Curl", "cardio", new Map()).length, 0);
});

test("recency uses session dates rather than input order or lifetime frequency, without mutation", () => {
  const first = exercisesSeed[0];
  const second = exercisesSeed[1];
  const history = [
    { startedAt: "2026-01-01T10:00:00Z", exercises: [{ exerciseId: first.id }] },
    { startedAt: "2026-10-19T10:00:00Z", exercises: [{ exerciseId: second.id }] },
    { startedAt: "2026-01-02T10:00:00Z", exercises: [{ exerciseId: first.id }] },
  ];
  const before = JSON.stringify({ exercisesSeed, history });
  const recency = getExerciseRecency(history);
  assert.equal(selectLibraryExercises(exercisesSeed, "", "strength", recency)[0].id, second.id);
  assert.equal(selectLibraryExercises(exercisesSeed, first.name, "strength", recency)[0].id, first.id);
  assert.equal(JSON.stringify({ exercisesSeed, history }), before);
});

const muscleMetrics = load(path.join(root, "features/body-map/muscle-score.utils.ts"));
const { expandMajorMuscleContributions, MAJOR_MUSCLE_LABELS } =
  load(path.join(root, "constants/muscles.ts"));
const muscleCalculators = [
  muscleMetrics.calculateMuscleScores,
  muscleMetrics.calculateMuscleVolumes,
  muscleMetrics.calculateMajorMuscleStrengthIndexes,
  muscleMetrics.calculateMajorMuscleVolumeComparisons,
  muscleMetrics.calculateMuscleVolumeProgress,
];
const scoringSession = (exercises, offsetDays = 0) => ({
  id: `scoring-${offsetDays}`,
  startedAt: new Date(Date.now() - offsetDays * 86400000).toISOString(),
  exercises: exercises.map((exercise, order) => ({
    id: `performed-${order}`, exerciseId: exercise.id, order,
    exerciseSnapshot: { ...exercise },
    sets: [
      { id: "done", weight: 50, reps: 10, completed: true },
      { id: "unfinished", weight: 100, reps: 20, completed: false },
    ],
  })),
});

test("upper-back percentages remain separate from explicit traps through display, editing and scoring", () => {
  const contributions = { upper_back: 0.4, traps: 0.1, lats: 0.5 };
  const aggregated = aggregateToMajorMuscleContributions(contributions);
  assert.deepEqual(aggregated, contributions);
  assert.deepEqual(expandMajorMuscleContributions(aggregated), contributions);
  assert.equal(MAJOR_MUSCLE_LABELS.upper_back, "Upper Back");
  const row = { ...originals.find((exercise) => exercise.id === "machine-row"), muscleContributions: contributions };
  const session = scoringSession([row]);
  const scores = muscleMetrics.calculateMuscleScores([session], []);
  assert.deepEqual(scores, contributions);
  assert.deepEqual(muscleMetrics.calculateSessionMuscleVolumes(session, []), {
    upper_back: 200, traps: 50, lats: 250,
  });
  assert.equal(muscleMetrics.calculateMajorMuscleStrengthIndexes([session], [])
    .find((entry) => entry.key === "back").recentBest, 50 * (1 + 10 / 30));
});

test("all cardio and stretches are excluded from muscle metrics, including legacy snapshots without catalog state", () => {
  const nonStrength = exercisesSeed.filter((exercise) =>
    ["cardio", "stretching"].includes(getRepDbExercise(exercise.id)?.category));
  assert.ok(nonStrength.length > 20, "Exclude all catalog activities, not just the curated twenty");
  assert.equal(nonStrength.filter((exercise) => curatedExerciseIds.has(exercise.id)).length, 20);
  const sessions = [scoringSession(nonStrength), scoringSession(nonStrength, 40)];
  const before = JSON.stringify(sessions);
  for (const calculate of muscleCalculators) {
    assert.deepEqual(calculate(sessions, []), calculate([], []), calculate.name);
    assert.deepEqual(calculate(sessions, exercisesSeed), calculate([], exercisesSeed), calculate.name);
  }
  assert.deepEqual(muscleMetrics.calculateSessionMuscleVolumes(sessions[0], []), {});
  assert.equal(JSON.stringify(sessions), before, "Saved history and snapshots remain unchanged");
  assert.equal(muscleMetrics.calculatePerformedExerciseVolume(sessions[0], sessions[0].exercises[0], nonStrength[0]), 500,
    "Generic recorded workout volume is untouched");
});

test("mixed workouts keep strength, bodyweight and functional credit while excluding cardio and mobility", () => {
  const ids = ["machine-row", "shrugs", "repdb-push-up", "repdb-kettlebell-deadlift"];
  const strength = exercisesSeed.filter((exercise) => ids.includes(exercise.id));
  assert.equal(strength.length, ids.length);
  const cardio = exercisesSeed.find((exercise) => exercise.id === "repdb-rowing-machine");
  const stretch = exercisesSeed.find((exercise) => exercise.id === "repdb-cat-cow");
  const strengthSession = scoringSession(strength);
  const mixedSession = scoringSession([...strength, cardio, stretch]);
  for (const calculate of muscleCalculators) {
    assert.deepEqual(calculate([mixedSession], exercisesSeed), calculate([strengthSession], exercisesSeed), calculate.name);
  }
  assert.deepEqual(muscleMetrics.calculateSessionMuscleVolumes(mixedSession, exercisesSeed),
    muscleMetrics.calculateSessionMuscleVolumes(strengthSession, exercisesSeed));
  const withoutSnapshots = { ...mixedSession, exercises: mixedSession.exercises.map(({ exerciseSnapshot, ...performed }) => performed) };
  assert.deepEqual(muscleMetrics.calculateMuscleScores([withoutSnapshots], exercisesSeed),
    muscleMetrics.calculateMuscleScores([strengthSession], exercisesSeed));
});

const estimateSource = load(path.join(root, "data/exercises.muscle-estimates.json"));
const { applyMuscleEstimates } = load(path.join(root, "features/exercises/muscle-estimates.ts"));

test("all 175 supplied estimates match the curated IDs and seed defaults exactly", () => {
  assert.equal(estimateSource.exercises.length, 175);
  assert.deepEqual(new Set(estimateSource.exercises.map((entry) => entry.id)), curatedExerciseIds);
  for (const entry of estimateSource.exercises) {
    const exercise = exercisesSeed.find((item) => item.id === entry.id);
    assert.deepEqual(exercise.muscleContributions, entry.muscleContributions, entry.id);
    const total = Object.values(entry.muscleContributions).reduce((sum, value) => sum + value, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, entry.id);
    for (const [muscle, value] of Object.entries(entry.muscleContributions)) {
      assert.ok(value > 0 && value <= 1, entry.id);
      assert.ok(Math.abs(entry.percentages[muscle] / 100 - value) < 1e-9, entry.id);
    }
    assert.ok(Math.abs(Object.values(aggregateToMajorMuscleContributions(entry.muscleContributions))
      .reduce((sum, value) => sum + value, 0) - 1) < 1e-9, entry.id);
  }
  const untouched = { ...originals[0], id: "outside-curation", muscleContributions: { chest: 0.73, triceps: 0.27 } };
  assert.strictEqual(applyMuscleEstimates([untouched])[0], untouched);
});

test("all 27 ineligible supplied activities add no muscle-map credit, even with old snapshots", () => {
  const excluded = estimateSource.exercises.filter((entry) => !entry.strengthScoreEligible);
  assert.equal(excluded.length, 27);
  assert.equal(excluded.filter((entry) => entry.modality === "cardio").length, 10);
  assert.equal(excluded.filter((entry) => entry.modality === "mobility").length, 10);
  assert.equal(excluded.filter((entry) => entry.modality === "power_conditioning").length, 7);
  const activities = excluded.map((entry) => ({
    ...exercisesSeed.find((exercise) => exercise.id === entry.id),
    muscleContributions: { traps: 1 }, // stale snapshot with otherwise scoreable weight/sets
  }));
  const sessions = [scoringSession(activities), scoringSession(activities, 40)];
  for (const calculate of muscleCalculators) {
    assert.deepEqual(calculate(sessions, []), calculate([], []), calculate.name);
  }
  assert.deepEqual(muscleMetrics.calculateSessionMuscleVolumes(sessions[0], []), {});
  const strength = scoringSession([exercisesSeed.find((exercise) => exercise.id === "flat-barbell-bench-press")]);
  assert.deepEqual(muscleMetrics.calculateMuscleScores([strength], []), { chest: 0.6, triceps: 0.25, front_delts: 0.15 });
});

test("rehydration upgrades unmodified defaults while retaining custom edits and old workout percentages", () => {
  const bench = exercisesSeed.find((exercise) => exercise.id === "flat-barbell-bench-press");
  const stale = { ...bench, name: "My bench label", notes: "Keep this cue", defaultRestSeconds: 42,
    muscleContributions: { chest: 0.65, triceps: 0.2, front_delts: 0.15 } };
  const edited = { ...exercisesSeed.find((exercise) => exercise.id === "flat-dumbbell-bench-press"),
    isModified: true, muscleContributions: { chest: 1 } };
  const custom = { ...bench, id: "personal-bench", isCustom: true, muscleContributions: { chest: 1 } };
  const session = scoringSession([stale]);
  const template = { id: "saved-template", name: "My template", exercises: [{ exerciseId: bench.id, targetSets: 3 }] };
  const persisted = { exercises: [stale, edited, custom], workoutHistory: [session], activeWorkout: session, templates: [template] };
  const before = JSON.stringify(persisted);
  const merged = useAppStore.persist.getOptions().merge(persisted, useAppStore.getState());
  const upgraded = merged.exercises.find((exercise) => exercise.id === bench.id);
  assert.deepEqual(upgraded.muscleContributions, bench.muscleContributions);
  assert.equal(upgraded.name, stale.name);
  assert.equal(upgraded.notes, stale.notes);
  assert.equal(upgraded.defaultRestSeconds, 42);
  assert.strictEqual(merged.exercises.find((exercise) => exercise.id === edited.id), edited);
  assert.strictEqual(merged.exercises.find((exercise) => exercise.id === custom.id), custom);
  assert.deepEqual(merged.workoutHistory[0].exercises[0].exerciseSnapshot.muscleContributions, stale.muscleContributions);
  assert.deepEqual(merged.activeWorkout.exercises[0].exerciseSnapshot.muscleContributions, stale.muscleContributions);
  assert.strictEqual(merged.templates[0], template);
  assert.equal(JSON.stringify(persisted), before);
});

const { getExerciseUsageCounts } = load(path.join(root, "features/exercises/exercise-sort.ts"));

test("usage counts completed workouts once per exercise, excluding unfinished entries", () => {
  const history = [
    { exercises: [
      { exerciseId: "bench", sets: [{ completed: true }, { completed: true }] },
      { exerciseId: "bench", sets: [{ completed: true }] },
      { exerciseId: "row", sets: [{ completed: false }] },
    ] },
    { exercises: [
      { exerciseId: "bench", sets: [{ completed: true }] },
      { exerciseId: "row", sets: [] },
    ] },
  ];
  const before = JSON.stringify(history);
  assert.deepEqual([...getExerciseUsageCounts(history)], [["bench", 2]]);
  assert.equal(JSON.stringify(history), before);
});

test("sorting switches between latest use and usage count, with recency then name ties and relevant search", () => {
  const first = { ...exercisesSeed[0], id: "sort-a", isCustom: true, name: "Bench Press" };
  const second = { ...first, id: "sort-b", name: "Bench Press Narrow" };
  const third = { ...first, id: "sort-c", name: "Bench Press Wide" };
  const exercises = [third, second, first];
  const recency = new Map([[first.id, 1], [second.id, 3], [third.id, 2]]);
  const counts = new Map([[first.id, 5], [second.id, 2], [third.id, 2]]);
  const select = (query, sort, times = recency, usage = counts) =>
    selectLibraryExercises(exercises, query, "strength", times, sort, usage).map((exercise) => exercise.id);
  assert.deepEqual(select("", "recent"), [second.id, third.id, first.id]);
  assert.deepEqual(select("", "most-used"), [first.id, second.id, third.id]);
  assert.deepEqual(select("", "most-used", new Map(), new Map()), [first.id, second.id, third.id]);
  assert.equal(select("Bench Press", "most-used", recency, new Map([[second.id, 100]]))[0], first.id);
  assert.deepEqual(exercises.map((exercise) => exercise.id), [third.id, second.id, first.id]);
});
