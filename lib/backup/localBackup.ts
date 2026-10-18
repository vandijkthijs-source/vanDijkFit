import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Exercise } from "../../features/exercises/exercise.types";
import {
  ExerciseSnapshot,
  PerformedExercise,
  RestTimerState,
  SetLog,
  WorkoutSession,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from "../../features/workouts/workout.types";
import {
  APP_STORAGE_KEY,
  AppPersistedState,
  OVERVIEW_CARD_KEYS,
  OverviewCardKey,
  createAppPersistedState,
  useAppStore,
} from "../../store/useAppStore";
import { AsyncStorage } from "../storage/asyncStorage";

export const BACKUP_SETTINGS_KEY = "vandijkfit-backup-settings";
const BACKUP_FORMAT = "vandijkfit-backup";
const BACKUP_VERSION = 2;
const EXERCISE_IMAGE_DIRECTORY = "exercise-images";

type BackupReason = "manual" | "workout-finished";

type EmbeddedExerciseImage = {
  exerciseId: string;
  mimeType: string;
  extension: string;
  base64: string;
};

type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  state: AppPersistedState;
  assets: {
    exerciseImages: EmbeddedExerciseImage[];
  };
};

export type BackupSettings = {
  directoryUri: string | null;
  lastBackupAt: string | null;
  lastBackupFileName: string | null;
  lastBackupReason: BackupReason | null;
  lastWorkoutBackupSessionId: string | null;
  lastRestoreAt: string | null;
  lastRestoreFileName: string | null;
  lastError: string | null;
};

export type BackupResult = {
  created: boolean;
  fileName: string | null;
  message: string;
  settings: BackupSettings;
};

export type BackupImportSelection = {
  fileName: string;
  createdAt: string | null;
  state: AppPersistedState;
  embeddedImages: EmbeddedExerciseImage[];
  warnings: string[];
  summary: {
    exerciseCount: number;
    customExerciseCount: number;
    templateCount: number;
    workoutCount: number;
    creatineDayCount: number;
    photoCount: number;
  };
};

export type BackupRestoreResult = {
  restoredImageCount: number;
  settings: BackupSettings;
};

const defaultBackupSettings: BackupSettings = {
  directoryUri: null,
  lastBackupAt: null,
  lastBackupFileName: null,
  lastBackupReason: null,
  lastWorkoutBackupSessionId: null,
  lastRestoreAt: null,
  lastRestoreFileName: null,
  lastError: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";
const isOptionalString = (value: unknown) => value === undefined || isString(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isNullableNumber = (value: unknown) => value === null || isFiniteNumber(value);

const isExerciseSnapshot = (value: unknown): value is ExerciseSnapshot =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isString(value.primaryMuscle) &&
  Array.isArray(value.secondaryMuscles) &&
  value.secondaryMuscles.every(isString) &&
  isString(value.equipment) &&
  isNumberRecord(value.muscleContributions);

const isSetLog = (value: unknown): value is SetLog =>
  isRecord(value) &&
  isString(value.id) &&
  isNullableNumber(value.weight) &&
  isNullableNumber(value.reps) &&
  typeof value.completed === "boolean" &&
  isOptionalString(value.timestamp) &&
  isOptionalString(value.notes);

const isPerformedExercise = (value: unknown): value is PerformedExercise =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.exerciseId) &&
  isFiniteNumber(value.order) &&
  Array.isArray(value.sets) &&
  value.sets.every(isSetLog) &&
  isOptionalString(value.notes) &&
  (value.exerciseSnapshot === undefined || isExerciseSnapshot(value.exerciseSnapshot)) &&
  (value.bodyweightLoadMode === undefined ||
    value.bodyweightLoadMode === "added" ||
    value.bodyweightLoadMode === "assisted") &&
  (value.restTimerEnabled === undefined || typeof value.restTimerEnabled === "boolean") &&
  (value.restSeconds === undefined || isFiniteNumber(value.restSeconds));

const isWorkoutSession = (value: unknown): value is WorkoutSession =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.startedAt) &&
  isOptionalString(value.endedAt) &&
  isOptionalString(value.templateId) &&
  isOptionalString(value.templateName) &&
  isOptionalString(value.notes) &&
  (value.bodyWeightKg === undefined ||
    (isFiniteNumber(value.bodyWeightKg) && value.bodyWeightKg > 0)) &&
  Array.isArray(value.exercises) &&
  value.exercises.every(isPerformedExercise);

const isTemplateExercise = (value: unknown): value is WorkoutTemplateExercise => {
  if (
    !isRecord(value) ||
    !isString(value.exerciseId) ||
    !isFiniteNumber(value.targetSets) ||
    !isOptionalString(value.notes) ||
    (value.restSecondsOverride !== undefined && !isFiniteNumber(value.restSecondsOverride))
  ) {
    return false;
  }

  return (
    value.repRange === undefined ||
    (isRecord(value.repRange) &&
      isFiniteNumber(value.repRange.min) &&
      isFiniteNumber(value.repRange.max))
  );
};

const isWorkoutTemplate = (value: unknown): value is WorkoutTemplate =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isOptionalString(value.description) &&
  Array.isArray(value.exercises) &&
  value.exercises.every(isTemplateExercise);

const isNumberRecord = (value: unknown): value is Record<string, number> =>
  isRecord(value) && Object.values(value).every(isFiniteNumber);

const isExercise = (value: unknown): value is Exercise =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isString(value.primaryMuscle) &&
  Array.isArray(value.secondaryMuscles) &&
  value.secondaryMuscles.every(isString) &&
  isString(value.equipment) &&
  isNumberRecord(value.muscleContributions) &&
  (value.isCustom === undefined || typeof value.isCustom === "boolean") &&
  (value.isModified === undefined || typeof value.isModified === "boolean") &&
  (value.defaultRestSeconds === undefined || isFiniteNumber(value.defaultRestSeconds)) &&
  isOptionalString(value.notes) &&
  isOptionalString(value.imageUri);

const isRestTimer = (value: unknown): value is RestTimerState =>
  isRecord(value) &&
  isString(value.setId) &&
  isFiniteNumber(value.durationSeconds) &&
  isString(value.endsAt);

const normalizeNotificationIds = (value: unknown): string[] | null | undefined => {
  if (value === null || value === undefined) {
    return null;
  }

  if (isString(value)) {
    return [value];
  }

  if (Array.isArray(value) && value.every(isString)) {
    return value;
  }

  return undefined;
};

const parsePersistedState = (value: unknown): AppPersistedState => {
  if (!isRecord(value)) {
    throw new Error("This file does not contain VanDijkFit app data.");
  }

  const notificationIds = normalizeNotificationIds(
    value.creatineReminderNotificationId
  );
  const creatineTakenDate =
    value.creatineTakenDate === null || isString(value.creatineTakenDate)
      ? value.creatineTakenDate
      : null;
  const creatineLogs = isNumberRecord(value.creatineLogs)
    ? value.creatineLogs
    : creatineTakenDate
      ? { [creatineTakenDate]: 5 }
      : {};
  const currentBodyWeightKg =
    value.currentBodyWeightKg === null || value.currentBodyWeightKg === undefined
      ? null
      : isFiniteNumber(value.currentBodyWeightKg) && value.currentBodyWeightKg > 0
        ? value.currentBodyWeightKg
        : null;
  const overviewCardOrder = Array.isArray(value.overviewCardOrder)
    ? value.overviewCardOrder.filter(
        (card, index, cards): card is OverviewCardKey =>
          isString(card) &&
          OVERVIEW_CARD_KEYS.includes(card as OverviewCardKey) &&
          cards.indexOf(card) === index
      )
    : [];
  for (const card of OVERVIEW_CARD_KEYS) {
    if (!overviewCardOrder.includes(card)) overviewCardOrder.push(card);
  }
  const hiddenOverviewCards = Array.isArray(value.hiddenOverviewCards)
    ? value.hiddenOverviewCards.filter(
        (card): card is OverviewCardKey =>
          isString(card) && OVERVIEW_CARD_KEYS.includes(card as OverviewCardKey)
      )
    : [];

  if (
    !Array.isArray(value.exercises) ||
    !value.exercises.every(isExercise) ||
    !Array.isArray(value.templates) ||
    !value.templates.every(isWorkoutTemplate) ||
    !Array.isArray(value.workoutHistory) ||
    !value.workoutHistory.every(isWorkoutSession) ||
    !(value.activeWorkout === null || isWorkoutSession(value.activeWorkout)) ||
    !(value.activeRestTimer === null || isRestTimer(value.activeRestTimer)) ||
    typeof value.isWorkoutMinimized !== "boolean" ||
    !isFiniteNumber(value.weeklyWorkoutGoal) ||
    notificationIds === undefined
  ) {
    throw new Error("The backup is incomplete or contains invalid app data.");
  }

  const activeWorkout = value.activeWorkout;

  return {
    exercises: value.exercises,
    templates: value.templates,
    workoutHistory: value.workoutHistory,
    activeWorkout,
    activeRestTimer: value.activeRestTimer,
    isWorkoutMinimized: activeWorkout ? value.isWorkoutMinimized : false,
    weeklyWorkoutGoal: Math.max(1, Math.round(value.weeklyWorkoutGoal)),
    currentBodyWeightKg,
    overviewCardOrder,
    hiddenOverviewCards,
    creatineTakenDate,
    creatineLogs,
    creatineReminderEnabled:
      typeof value.creatineReminderEnabled === "boolean"
        ? value.creatineReminderEnabled
        : false,
    creatineReminderHour: isFiniteNumber(value.creatineReminderHour)
      ? Math.min(23, Math.max(0, Math.round(value.creatineReminderHour)))
      : 18,
    creatineReminderMinute: isFiniteNumber(value.creatineReminderMinute)
      ? Math.min(59, Math.max(0, Math.round(value.creatineReminderMinute)))
      : 0,
    creatineReminderNotificationId: notificationIds,
    darkMode: typeof value.darkMode === "boolean" ? value.darkMode : true,
  };
};

const parseEmbeddedImages = (value: unknown): EmbeddedExerciseImage[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("The backup's embedded photo data is invalid.");
  }

  return value.map((item) => {
    if (
      !isRecord(item) ||
      !isString(item.exerciseId) ||
      !isString(item.mimeType) ||
      !item.mimeType.startsWith("image/") ||
      !isString(item.extension) ||
      !isString(item.base64) ||
      item.base64.length === 0
    ) {
      throw new Error("The backup contains an invalid embedded exercise photo.");
    }

    return {
      exerciseId: item.exerciseId,
      mimeType: item.mimeType,
      extension: item.extension.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg",
      base64: item.base64,
    };
  });
};

const formatBackupTimestamp = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("-");
};

const sanitizeSettings = (settings: Partial<BackupSettings> | null): BackupSettings => ({
  ...defaultBackupSettings,
  ...settings,
});

const saveBackupSettings = async (settings: BackupSettings) => {
  await AsyncStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(settings));
};

const getImageMetadata = (uri: string) => {
  const dataUriMatch = uri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  const cleanUri = uri.split(/[?#]/)[0];
  const uriExtension = cleanUri.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  const mimeType = dataUriMatch?.[1] ??
    (uriExtension === "png"
      ? "image/png"
      : uriExtension === "webp"
        ? "image/webp"
        : uriExtension === "gif"
          ? "image/gif"
          : "image/jpeg");
  const extension =
    uriExtension ??
    (mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg");

  return { mimeType, extension };
};

const embedExerciseImages = async (
  exercises: Exercise[]
): Promise<EmbeddedExerciseImage[]> => {
  const images: EmbeddedExerciseImage[] = [];

  for (const exercise of exercises) {
    if (!exercise.imageUri) {
      continue;
    }

    const { mimeType, extension } = getImageMetadata(exercise.imageUri);
    const dataUriMatch = exercise.imageUri.match(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/s
    );
    const base64 = dataUriMatch?.[1] ??
      (await FileSystem.readAsStringAsync(exercise.imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      }));

    images.push({
      exerciseId: exercise.id,
      mimeType,
      extension,
      base64,
    });
  }

  return images;
};

const buildBackupFile = async (createdAt: Date): Promise<BackupFile> => {
  const state = createAppPersistedState(useAppStore.getState());
  const exerciseImages = await embedExerciseImages(state.exercises);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: createdAt.toISOString(),
    state,
    assets: { exerciseImages },
  };
};

const persistRestoredState = async (state: AppPersistedState) => {
  const restoredState = {
    ...state,
    creatineReminderNotificationId: null,
  };

  await AsyncStorage.setItem(
    APP_STORAGE_KEY,
    JSON.stringify({
      state: restoredState,
      version: 0,
    })
  );

  useAppStore.setState({
    ...restoredState,
    isWorkoutTransitioning: false,
    pendingWorkoutMinimizeRoute: null,
    hasHydrated: true,
  });
};

export const canUseLocalBackups = () => Platform.OS === "android";
export const canRestoreLocalBackups = () =>
  Platform.OS === "android" || Platform.OS === "ios" || Platform.OS === "web";

export const getBackupSettings = async (): Promise<BackupSettings> => {
  const rawSettings = await AsyncStorage.getItem(BACKUP_SETTINGS_KEY);

  if (!rawSettings) {
    return defaultBackupSettings;
  }

  try {
    return sanitizeSettings(JSON.parse(rawSettings) as Partial<BackupSettings>);
  } catch {
    return defaultBackupSettings;
  }
};

export const chooseBackupDirectory = async (): Promise<BackupSettings> => {
  if (!canUseLocalBackups()) {
    throw new Error("Local backups are only available on Android.");
  }

  const currentSettings = await getBackupSettings();
  const permissions =
    await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
      currentSettings.directoryUri
    );

  if (!permissions.granted) {
    return currentSettings;
  }

  const nextSettings: BackupSettings = {
    ...currentSettings,
    directoryUri: permissions.directoryUri,
    lastError: null,
  };

  await saveBackupSettings(nextSettings);
  return nextSettings;
};

export const createBackupNow = async (
  reason: BackupReason = "manual",
  workoutSessionId?: string
): Promise<BackupResult> => {
  const settings = await getBackupSettings();

  if (!canUseLocalBackups()) {
    return {
      created: false,
      fileName: null,
      message: "Local backups are only available on Android.",
      settings,
    };
  }

  if (!settings.directoryUri) {
    return {
      created: false,
      fileName: null,
      message: "Choose a backup folder first.",
      settings,
    };
  }

  const createdAt = new Date();
  const fileName = `vandijkfit-backup-${formatBackupTimestamp(createdAt)}.json`;

  try {
    const payload = await buildBackupFile(createdAt);
    const content = JSON.stringify(payload, null, 2);
    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      settings.directoryUri,
      fileName,
      "application/json"
    );
    await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, content);

    const nextSettings: BackupSettings = {
      ...settings,
      lastBackupAt: createdAt.toISOString(),
      lastBackupFileName: fileName,
      lastBackupReason: reason,
      lastWorkoutBackupSessionId:
        reason === "workout-finished"
          ? workoutSessionId ?? settings.lastWorkoutBackupSessionId
          : settings.lastWorkoutBackupSessionId,
      lastError: null,
    };

    await saveBackupSettings(nextSettings);

    return {
      created: true,
      fileName,
      message:
        payload.assets.exerciseImages.length > 0
          ? `Backup created with ${payload.assets.exerciseImages.length} exercise photo${payload.assets.exerciseImages.length === 1 ? "" : "s"}.`
          : "Backup created.",
      settings: nextSettings,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create backup.";
    const nextSettings: BackupSettings = {
      ...settings,
      lastError: message,
    };

    await saveBackupSettings(nextSettings);

    return {
      created: false,
      fileName: null,
      message,
      settings: nextSettings,
    };
  }
};

export const selectBackupFile = async (): Promise<BackupImportSelection | null> => {
  if (!canRestoreLocalBackups()) {
    throw new Error("Backup restore is not available on this platform.");
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/json", "text/plain", "application/octet-stream"],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) {
    return null;
  }

  const selectedFile = result.assets[0];
  if (!selectedFile) {
    return null;
  }

  let parsed: unknown;
  try {
    const content = selectedFile.file
      ? await selectedFile.file.text()
      : await FileSystem.readAsStringAsync(selectedFile.uri);
    parsed = JSON.parse(content);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new Error("This file is not a VanDijkFit backup.");
  }

  if (parsed.format !== undefined && parsed.format !== BACKUP_FORMAT) {
    throw new Error("This file belongs to a different backup format.");
  }

  if (parsed.version !== undefined && !isFiniteNumber(parsed.version)) {
    throw new Error("This backup has an invalid format version.");
  }

  if (isFiniteNumber(parsed.version) && parsed.version > BACKUP_VERSION) {
    throw new Error("This backup was created by a newer version of VanDijkFit.");
  }

  const state = parsePersistedState(parsed.state);
  if (parsed.assets !== undefined && !isRecord(parsed.assets)) {
    throw new Error("The backup's embedded asset data is invalid.");
  }

  const assetsRecord = isRecord(parsed.assets) ? parsed.assets : null;
  const embeddedImages = parseEmbeddedImages(assetsRecord?.exerciseImages);
  const exerciseIds = new Set(state.exercises.map((exercise) => exercise.id));
  const embeddedExerciseIds = new Set(
    embeddedImages.map((image) => image.exerciseId)
  );

  if (embeddedExerciseIds.size !== embeddedImages.length) {
    throw new Error("The backup contains duplicate embedded exercise photos.");
  }

  if (embeddedImages.some((image) => !exerciseIds.has(image.exerciseId))) {
    throw new Error("The backup contains a photo for an unknown exercise.");
  }

  const unembeddedPhotoCount = state.exercises.filter(
    (exercise) => exercise.imageUri && !embeddedExerciseIds.has(exercise.id)
  ).length;
  const warnings: string[] = [];

  if (parsed.version === undefined) {
    warnings.push("This is a legacy backup without embedded app metadata.");
  }

  if (unembeddedPhotoCount > 0) {
    warnings.push(
      `${unembeddedPhotoCount} exercise photo${unembeddedPhotoCount === 1 ? " is" : "s are"} referenced but not embedded in this backup.`
    );
  }

  return {
    fileName: selectedFile.name,
    createdAt: isString(parsed.createdAt) ? parsed.createdAt : null,
    state,
    embeddedImages,
    warnings,
    summary: {
      exerciseCount: state.exercises.length,
      customExerciseCount: state.exercises.filter((exercise) => exercise.isCustom).length,
      templateCount: state.templates.length,
      workoutCount: state.workoutHistory.length,
      creatineDayCount: Object.keys(state.creatineLogs).length,
      photoCount: embeddedImages.length,
    },
  };
};

export const restoreBackup = async (
  selection: BackupImportSelection
): Promise<BackupRestoreResult> => {
  const restoredImageUris = new Map<string, string>();

  if (selection.embeddedImages.length > 0) {
    if (FileSystem.documentDirectory) {
      const imageDirectory = `${FileSystem.documentDirectory}${EXERCISE_IMAGE_DIRECTORY}/`;
      await FileSystem.makeDirectoryAsync(imageDirectory, { intermediates: true });

      for (const [index, image] of selection.embeddedImages.entries()) {
        const safeExerciseId = image.exerciseId.replace(/[^a-zA-Z0-9_-]/g, "-");
        const imageUri = `${imageDirectory}${safeExerciseId}-${Date.now()}-${index}.${image.extension}`;

        await FileSystem.writeAsStringAsync(imageUri, image.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        restoredImageUris.set(image.exerciseId, imageUri);
      }
    } else {
      for (const image of selection.embeddedImages) {
        restoredImageUris.set(
          image.exerciseId,
          `data:${image.mimeType};base64,${image.base64}`
        );
      }
    }
  }

  const restoredState: AppPersistedState = {
    ...selection.state,
    exercises: selection.state.exercises.map((exercise) => ({
      ...exercise,
      imageUri: restoredImageUris.get(exercise.id) ?? exercise.imageUri,
    })),
  };

  await persistRestoredState(restoredState);

  const restoredAt = new Date().toISOString();
  const currentSettings = await getBackupSettings();
  const nextSettings: BackupSettings = {
    ...currentSettings,
    lastRestoreAt: restoredAt,
    lastRestoreFileName: selection.fileName,
    lastError: null,
  };
  await saveBackupSettings(nextSettings);

  return {
    restoredImageCount: restoredImageUris.size,
    settings: nextSettings,
  };
};

export const createBackupAfterWorkout = async (
  workoutSessionId: string
): Promise<BackupResult> => {
  const settings = await getBackupSettings();

  if (settings.lastWorkoutBackupSessionId === workoutSessionId) {
    return {
      created: false,
      fileName: settings.lastBackupFileName,
      message: "Workout already backed up.",
      settings,
    };
  }

  return createBackupNow("workout-finished", workoutSessionId);
};
