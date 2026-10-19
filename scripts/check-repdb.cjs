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

test("curation selects 67 original and 108 RepDB exercises, preserving all 657 entries", () => {
  const defaults = selectLibraryExercises(exercisesSeed, "", false, new Map());
  assert.equal(exercisesSeed.length, 657);
  assert.equal(curatedExerciseIds.size, 175);
  assert.equal(defaults.length, 175);
  assert.equal(defaults.filter((exercise) => !exercise.id.startsWith("repdb-")).length, 67);
  assert.equal(defaults.filter((exercise) => exercise.id.startsWith("repdb-")).length, 108);
  assert.equal(selectLibraryExercises(exercisesSeed, "", true, new Map()).length, 657);
  assert.equal(exercisesSeed.length - defaults.length, 482);
  const groups = load(path.join(root, "data/exercises.curated.json"));
  const ids = new Set(exercisesSeed.map((exercise) => exercise.id));
  for (const [group, selection] of Object.entries(groups)) {
    assert.ok(selection.length > 0, group);
    for (const id of selection) assert.ok(ids.has(id), `${group}: ${id}`);
  }
});

test("search reaches every exercise from either scope and custom exercises remain visible", () => {
  const custom = { ...exercisesSeed[0], id: "custom-test", name: "My movement", isCustom: true };
  const exercises = [...exercisesSeed, custom];
  assert.ok(selectLibraryExercises(exercises, "", false, new Map()).includes(custom));
  for (const exercise of exercises) {
    for (const showAll of [false, true]) {
      assert.ok(selectLibraryExercises(exercises, exercise.name, showAll, new Map())
        .some((result) => result.id === exercise.id), exercise.name);
    }
  }
  assert.equal(selectLibraryExercises(exercises, "  ", false, new Map()).length, 176);
  assert.equal(selectLibraryExercises(exercises, "no-exercise-matches-this", false, new Map()).length, 0);
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
  assert.equal(selectLibraryExercises(exercisesSeed, "", false, recency)[0].id, second.id);
  assert.equal(selectLibraryExercises(exercisesSeed, "", true, recency)[0].id, second.id);
  assert.equal(selectLibraryExercises(exercisesSeed, first.name, false, recency)[0].id, first.id);
  assert.equal(JSON.stringify({ exercisesSeed, history }), before);
});
