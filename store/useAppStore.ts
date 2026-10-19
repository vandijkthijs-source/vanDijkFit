import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { AsyncStorage } from "../lib/storage/asyncStorage";
import { exercisesSeed } from "../data/exercises.seed";
import { templatesSeed } from "../data/templates.seed";
import { Exercise } from "../features/exercises/exercise.types";
import {
  BodyweightLoadMode,
  ExerciseSnapshot,
  PerformedExercise,
  RestTimerState,
  SetLog,
  WorkoutSession,
  WorkoutTemplate,
} from "../features/workouts/workout.types";
import { updateTemplateExercisesFromWorkout } from "../features/workouts/template.utils";
import { createId } from "../utils/ids";
import {
  OVERVIEW_CARD_KEYS,
  OverviewCardKey,
} from "../features/overview/overview-cards";

export { OVERVIEW_CARD_KEYS };
export type { OverviewCardKey };

export interface AppState {
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  workoutHistory: WorkoutSession[];
  activeWorkout: WorkoutSession | null;
  activeRestTimer: RestTimerState | null;
  isWorkoutMinimized: boolean;
  isWorkoutTransitioning: boolean;
  pendingWorkoutMinimizeRoute: string | null;
  weeklyWorkoutGoal: number;
  currentBodyWeightKg: number | null;
  overviewCardOrder: OverviewCardKey[];
  hiddenOverviewCards: OverviewCardKey[];
  creatineTakenDate: string | null;
  creatineLogs: Record<string, number>;
  creatineReminderEnabled: boolean;
  creatineReminderHour: number;
  creatineReminderMinute: number;
  creatineReminderNotificationId: string[] | null;
  darkMode: boolean;
  hasHydrated: boolean;

  setHasHydrated: (hasHydrated: boolean) => void;
  startWorkoutFromTemplate: (templateId: string) => void;
  startOpenWorkout: (exerciseIds?: string[]) => void;
  finishActiveWorkout: (options?: { updateTemplate?: boolean }) => string | null;
  cancelActiveWorkout: () => void;
  setWorkoutMinimized: (isMinimized: boolean) => void;
  setWorkoutTransitioning: (isTransitioning: boolean) => void;
  requestWorkoutMinimize: (route: string) => void;
  clearWorkoutMinimizeRequest: () => void;
  setWeeklyWorkoutGoal: (goal: number) => void;
  setActiveWorkoutBodyWeight: (weightKg: number) => void;
  setBodyweightLoadMode: (
    performedExerciseId: string,
    mode: BodyweightLoadMode
  ) => void;
  setOverviewCardOrder: (order: OverviewCardKey[]) => void;
  hideOverviewCard: (card: OverviewCardKey) => void;
  showOverviewCard: (card: OverviewCardKey) => void;
  setCreatineTakenDate: (date: string | null) => void;
  setCreatineLog: (date: string, grams: number | null) => void;
  setCreatineReminderEnabled: (enabled: boolean) => void;
  setCreatineReminderTime: (hour: number, minute: number) => void;
  setCreatineReminderNotificationId: (notificationId: string[] | null) => void;
  setDarkMode: (darkMode: boolean) => void;
  saveWorkoutAsTemplate: (sessionId: string, name: string) => void;
  removeTemplate: (templateId: string) => void;
  removeWorkoutHistorySession: (sessionId: string) => void;
  updateWorkoutHistoryTitle: (sessionId: string, title: string) => void;
  updateWorkoutHistoryTimestamps: (
    sessionId: string,
    updates: { startedAt?: string; endedAt?: string }
  ) => void;
  updateWorkoutHistoryNotes: (sessionId: string, notes: string) => void;
  updateWorkoutHistoryExerciseNotes: (
    sessionId: string,
    performedExerciseId: string,
    notes: string
  ) => void;
  updateWorkoutHistorySet: (
    sessionId: string,
    performedExerciseId: string,
    setId: string,
    updates: Partial<SetLog>
  ) => void;
  addSetToWorkoutHistoryExercise: (sessionId: string, performedExerciseId: string) => void;
  removeSetFromWorkoutHistoryExercise: (
    sessionId: string,
    performedExerciseId: string,
    setId: string
  ) => void;
  removeExerciseFromWorkoutHistory: (sessionId: string, performedExerciseId: string) => void;
  addExerciseToWorkoutHistory: (sessionId: string, exerciseId: string) => void;

  addSetToExercise: (performedExerciseId: string) => void;
  removeSetFromExercise: (performedExerciseId: string, setId: string) => void;
  removeExerciseFromActiveWorkout: (performedExerciseId: string) => void;
  moveExerciseInActiveWorkout: (performedExerciseId: string, toIndex: number) => void;
  updateSet: (
    performedExerciseId: string,
    setId: string,
    updates: Partial<SetLog>
  ) => void;
  updateExerciseNotes: (performedExerciseId: string, notes: string) => void;
  updateActiveWorkoutNotes: (notes: string) => void;
  updateActiveWorkoutTitle: (title: string) => void;
  completeSet: (performedExerciseId: string, setId: string) => void;
  startRestTimer: (setId: string, durationSeconds: number) => void;
  stopRestTimer: () => void;

  addCustomExercise: (exercise: Omit<Exercise, "id">) => void;
  updateCustomExercise: (exerciseId: string, updates: Omit<Exercise, "id">) => void;
  revertExerciseToSeed: (exerciseId: string) => void;
  removeCustomExercise: (exerciseId: string) => void;
  addExerciseToActiveWorkout: (exerciseId: string) => void;
  updateExerciseRest: (performedExerciseId: string, restSeconds: number) => void;
}

const createEmptySet = (): SetLog => ({
  id: createId(),
  weight: 0,
  reps: null,
  completed: false,
});

const createSetFromPrevious = (previousSet?: SetLog): SetLog => ({
  id: createId(),
  weight: previousSet?.weight ?? 0,
  reps: previousSet?.reps ?? null,
  completed: false,
});

const createCompletedHistorySet = (previousSet?: SetLog): SetLog => ({
  ...createSetFromPrevious(previousSet),
  completed: true,
  timestamp: new Date().toISOString(),
});

const createCompletedHistoryExercise = (
  exercise: Exercise,
  order: number,
  targetSets: number,
  restSeconds?: number,
  notes?: string,
  previousSets?: SetLog[]
): PerformedExercise => ({
  ...buildPerformedExercise(exercise, order, targetSets, restSeconds, notes, previousSets),
  sets: Array.from({ length: targetSets }, (_, index) =>
    createCompletedHistorySet(previousSets?.[index] ?? previousSets?.[previousSets.length - 1])
  ),
});

const createInitialSetsFromPrevious = (
  targetSets: number,
  previousSets?: SetLog[]
): SetLog[] => {
  if (!previousSets || previousSets.length === 0) {
    return Array.from({ length: targetSets }, () => createEmptySet());
  }

  return Array.from({ length: targetSets }, (_, index) =>
    createSetFromPrevious(previousSets[index] ?? previousSets[previousSets.length - 1])
  );
};

const updateFollowingSets = (
  sets: SetLog[],
  setId: string,
  field: "weight" | "reps",
  value: number | null
) => {
  const sourceIndex = sets.findIndex((setItem) => setItem.id === setId);

  if (sourceIndex === -1) {
    return sets;
  }

  return sets.map((setItem, index) =>
    index >= sourceIndex && !setItem.completed ? { ...setItem, [field]: value } : setItem
  );
};

const getLatestExerciseNotes = (
  workoutHistory: WorkoutSession[],
  exerciseId: string
) => {
  const sortedHistory = [...workoutHistory].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  for (const session of sortedHistory) {
    const performedExercise = session.exercises.find(
      (exercise) => exercise.exerciseId === exerciseId
    );

    if (performedExercise?.notes?.trim()) {
      return performedExercise.notes;
    }
  }

  return undefined;
};

const getLatestPerformedExercise = (
  workoutHistory: WorkoutSession[],
  exerciseId: string
) => {
  const sortedHistory = [...workoutHistory].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  for (const session of sortedHistory) {
    const performedExercise = session.exercises.find(
      (exercise) => exercise.exerciseId === exerciseId
    );

    if (performedExercise) {
      return performedExercise;
    }
  }

  return undefined;
};

const buildPerformedExercise = (
  exercise: Exercise,
  order: number,
  targetSets: number,
  restSeconds?: number,
  notes?: string,
  previousSets?: SetLog[],
  bodyweightLoadMode: BodyweightLoadMode = "added"
): PerformedExercise => ({
  id: createId(),
  exerciseId: exercise.id,
  order,
  sets: createInitialSetsFromPrevious(targetSets, previousSets),
  restTimerEnabled: true,
  restSeconds,
  notes,
  exerciseSnapshot: createExerciseSnapshot(exercise),
  bodyweightLoadMode,
});

const createExerciseSnapshot = (exercise: Exercise): ExerciseSnapshot => ({
  id: exercise.id,
  name: exercise.name,
  primaryMuscle: exercise.primaryMuscle,
  secondaryMuscles: [...exercise.secondaryMuscles],
  equipment: exercise.equipment,
  muscleContributions: { ...exercise.muscleContributions },
});

const resolvePerformedExercise = (
  performedExercise: PerformedExercise,
  exerciseMap: Map<string, Exercise>
) => performedExercise.exerciseSnapshot ?? exerciseMap.get(performedExercise.exerciseId);

const snapshotWorkoutSession = (
  session: WorkoutSession,
  exerciseMap: Map<string, Exercise>
): WorkoutSession => {
  const exercises = session.exercises.map((performedExercise) => {
    const exercise = resolvePerformedExercise(performedExercise, exerciseMap);
    return {
      ...performedExercise,
      exerciseSnapshot:
        performedExercise.exerciseSnapshot ??
        (exercise ? createExerciseSnapshot(exercise) : undefined),
      bodyweightLoadMode: performedExercise.bodyweightLoadMode ?? "added",
    };
  });

  return {
    ...session,
    exercises,
  };
};

const sanitizeOverviewCardOrder = (value?: readonly string[]): OverviewCardKey[] => {
  const valid = (value ?? []).filter(
    (card, index, values): card is OverviewCardKey =>
      OVERVIEW_CARD_KEYS.includes(card as OverviewCardKey) && values.indexOf(card) === index
  );
  return [...valid, ...OVERVIEW_CARD_KEYS.filter((card) => !valid.includes(card))];
};

const mergeSeedExercises = (persistedExercises?: Exercise[]) => {
  const currentExercises = persistedExercises ?? [];
  const existingIds = new Set(currentExercises.map((exercise) => exercise.id));
  const missingSeedExercises = exercisesSeed.filter((exercise) => !existingIds.has(exercise.id));

  const latestSeedById = new Map(exercisesSeed.map((exercise) => [exercise.id, exercise]));
  const updatedExercises = currentExercises.map((exercise) => {
    const seedExercise = latestSeedById.get(exercise.id);
    if (!seedExercise || exercise.isCustom || exercise.isModified) {
      return exercise;
    }

    return {
      ...exercise,
      primaryMuscle: seedExercise.primaryMuscle,
      secondaryMuscles: seedExercise.secondaryMuscles,
      muscleContributions: seedExercise.muscleContributions,
    };
  });

  return [...updatedExercises, ...missingSeedExercises];
};

export const APP_STORAGE_KEY = "vandijkfit-storage-v2";

export const createAppPersistedState = (state: AppState) => ({
  exercises: state.exercises,
  templates: state.templates,
  workoutHistory: state.workoutHistory,
  activeWorkout: state.activeWorkout,
  activeRestTimer: state.activeRestTimer,
  isWorkoutMinimized: state.isWorkoutMinimized,
  weeklyWorkoutGoal: state.weeklyWorkoutGoal,
  currentBodyWeightKg: state.currentBodyWeightKg,
  overviewCardOrder: state.overviewCardOrder,
  hiddenOverviewCards: state.hiddenOverviewCards,
  creatineTakenDate: state.creatineTakenDate,
  creatineLogs: state.creatineLogs,
  creatineReminderEnabled: state.creatineReminderEnabled,
  creatineReminderHour: state.creatineReminderHour,
  creatineReminderMinute: state.creatineReminderMinute,
  creatineReminderNotificationId: state.creatineReminderNotificationId,
  darkMode: state.darkMode,
});

export type AppPersistedState = ReturnType<typeof createAppPersistedState>;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      exercises: exercisesSeed,
      templates: templatesSeed,
      workoutHistory: [],
      activeWorkout: null,
      activeRestTimer: null,
      isWorkoutMinimized: false,
      isWorkoutTransitioning: false,
      pendingWorkoutMinimizeRoute: null,
      weeklyWorkoutGoal: 5,
      currentBodyWeightKg: null,
      overviewCardOrder: [...OVERVIEW_CARD_KEYS],
      hiddenOverviewCards: [],
      creatineTakenDate: null,
      creatineLogs: {},
      creatineReminderEnabled: false,
      creatineReminderHour: 18,
      creatineReminderMinute: 0,
      creatineReminderNotificationId: null,
      darkMode: true,
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => {
        set({ hasHydrated });
      },

      startWorkoutFromTemplate: (templateId) => {
        const templates = get().templates ?? templatesSeed;
        const allExercises = get().exercises ?? exercisesSeed;
        const workoutHistory = get().workoutHistory ?? [];

        const template = templates.find((item) => item.id === templateId);
        if (!template) return;

        const exerciseMap = new Map(
          allExercises.map((exercise) => [exercise.id, exercise])
        );

        const performedExercises = template.exercises
          .map((templateExercise, index) => {
            const exercise = exerciseMap.get(templateExercise.exerciseId);
            if (!exercise) return null;

            return buildPerformedExercise(
              exercise,
              index,
              templateExercise.targetSets,
              templateExercise.restSecondsOverride ?? exercise.defaultRestSeconds ?? 90,
              getLatestExerciseNotes(workoutHistory, templateExercise.exerciseId) ??
                exercise.notes,
              getLatestPerformedExercise(workoutHistory, templateExercise.exerciseId)?.sets,
              getLatestPerformedExercise(workoutHistory, templateExercise.exerciseId)
                ?.bodyweightLoadMode ?? "added"
            );
          })
          .filter((exercise): exercise is PerformedExercise => exercise !== null);

        const session: WorkoutSession = {
          id: createId(),
          templateId: template.id,
          templateName: template.name,
          startedAt: new Date().toISOString(),
          exercises: performedExercises,
        };

        set({
          activeWorkout: session,
          activeRestTimer: null,
          isWorkoutMinimized: false,
          isWorkoutTransitioning: false,
          pendingWorkoutMinimizeRoute: null,
        });
      },

      startOpenWorkout: (exerciseIds = []) => {
        const allExercises = get().exercises ?? exercisesSeed;
        const workoutHistory = get().workoutHistory ?? [];
        const exerciseMap = new Map(
          allExercises.map((exercise) => [exercise.id, exercise])
        );

        const performedExercises = exerciseIds
          .map((exerciseId, index) => {
            const exercise = exerciseMap.get(exerciseId);
            if (!exercise) return null;
            const latestPerformedExercise = getLatestPerformedExercise(
              workoutHistory,
              exerciseId
            );

            return buildPerformedExercise(
              exercise,
              index,
              latestPerformedExercise?.sets.length ?? 3,
              exercise.defaultRestSeconds ?? 90,
              getLatestExerciseNotes(workoutHistory, exerciseId) ?? exercise.notes,
              latestPerformedExercise?.sets,
              latestPerformedExercise?.bodyweightLoadMode ?? "added"
            );
          })
          .filter((exercise): exercise is PerformedExercise => exercise !== null);

        const session: WorkoutSession = {
          id: createId(),
          templateName: "Open Workout",
          startedAt: new Date().toISOString(),
          exercises: performedExercises,
        };

        set({
          activeWorkout: session,
          activeRestTimer: null,
          isWorkoutMinimized: false,
          isWorkoutTransitioning: false,
          pendingWorkoutMinimizeRoute: null,
        });
      },

      finishActiveWorkout: (options) => {
        const activeWorkout = get().activeWorkout;
        if (!activeWorkout) return null;
        const exerciseMap = new Map(
          (get().exercises ?? []).map((exercise) => [exercise.id, exercise])
        );

        const finishedWorkout: WorkoutSession = snapshotWorkoutSession(
          {
            ...activeWorkout,
            exercises: activeWorkout.exercises
              .map((exercise) => ({
                ...exercise,
                sets: exercise.sets.filter((setItem) => setItem.completed),
              }))
              .filter((exercise) => exercise.sets.length > 0),
            endedAt: new Date().toISOString(),
          },
          exerciseMap
        );

        set((state) => ({
          templates: options?.updateTemplate
            ? (state.templates ?? []).map((template) =>
                template.id === activeWorkout.templateId
                  ? updateTemplateExercisesFromWorkout(template, activeWorkout)
                  : template
              )
            : state.templates,
          workoutHistory: [finishedWorkout, ...(state.workoutHistory ?? [])],
          activeWorkout: null,
          activeRestTimer: null,
          isWorkoutMinimized: false,
          isWorkoutTransitioning: false,
          pendingWorkoutMinimizeRoute: null,
        }));

        return finishedWorkout.id;
      },

      cancelActiveWorkout: () => {
        set({
          activeWorkout: null,
          activeRestTimer: null,
          isWorkoutMinimized: false,
          isWorkoutTransitioning: false,
          pendingWorkoutMinimizeRoute: null,
        });
      },

      setWorkoutMinimized: (isMinimized) => {
        set({ isWorkoutMinimized: isMinimized });
      },

      setWorkoutTransitioning: (isTransitioning) => {
        set({ isWorkoutTransitioning: isTransitioning });
      },

      requestWorkoutMinimize: (route) => {
        set({ pendingWorkoutMinimizeRoute: route });
      },

      clearWorkoutMinimizeRequest: () => {
        set({ pendingWorkoutMinimizeRoute: null });
      },

      setWeeklyWorkoutGoal: (goal) => {
        set({ weeklyWorkoutGoal: goal });
      },

      setActiveWorkoutBodyWeight: (weightKg) => {
        const safeWeightKg = Math.min(500, Math.max(1, Math.round(weightKg * 10) / 10));
        set((state) => ({
          currentBodyWeightKg: safeWeightKg,
          activeWorkout: state.activeWorkout
            ? { ...state.activeWorkout, bodyWeightKg: safeWeightKg }
            : null,
        }));
      },

      setBodyweightLoadMode: (performedExerciseId, mode) => {
        set((state) => {
          if (!state.activeWorkout) return state;
          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((exercise) =>
                exercise.id === performedExerciseId
                  ? { ...exercise, bodyweightLoadMode: mode }
                  : exercise
              ),
            },
          };
        });
      },

      setOverviewCardOrder: (order) => {
        set({ overviewCardOrder: sanitizeOverviewCardOrder(order) });
      },

      hideOverviewCard: (card) => {
        set((state) => ({
          hiddenOverviewCards: state.hiddenOverviewCards.includes(card)
            ? state.hiddenOverviewCards
            : [...state.hiddenOverviewCards, card],
        }));
      },

      showOverviewCard: (card) => {
        set((state) => ({
          hiddenOverviewCards: state.hiddenOverviewCards.filter((item) => item !== card),
        }));
      },

      setCreatineTakenDate: (date) => {
        set({ creatineTakenDate: date });
      },

      setCreatineLog: (date, grams) => {
        set((state) => {
          const nextLogs = { ...(state.creatineLogs ?? {}) };
          const safeGrams = Math.max(0, Math.round(grams ?? 0));

          if (safeGrams > 0) {
            nextLogs[date] = safeGrams;
          } else {
            delete nextLogs[date];
          }

          return {
            creatineLogs: nextLogs,
            creatineTakenDate: safeGrams > 0 ? date : null,
          };
        });
      },

      setCreatineReminderEnabled: (enabled) => {
        set({ creatineReminderEnabled: enabled });
      },

      setCreatineReminderTime: (hour, minute) => {
        set({
          creatineReminderHour: Math.min(Math.max(Math.round(hour), 0), 23),
          creatineReminderMinute: Math.min(Math.max(Math.round(minute), 0), 59),
        });
      },

      setCreatineReminderNotificationId: (notificationId) => {
        set({ creatineReminderNotificationId: notificationId });
      },

      setDarkMode: (darkMode) => {
        set({ darkMode });
      },

      saveWorkoutAsTemplate: (sessionId, name) => {
        set((state) => {
          const session = (state.workoutHistory ?? []).find((item) => item.id === sessionId);
          if (!session) return state;

          const templateName = name.trim() || session.templateName?.trim() || "Workout Template";

          const nextTemplate: WorkoutTemplate = {
            id: createId(),
            name: templateName,
            exercises: session.exercises.map((exercise) => ({
              exerciseId: exercise.exerciseId,
              targetSets: exercise.sets.length,
              notes: exercise.notes,
              restSecondsOverride: exercise.restSeconds,
            })),
          };

          return {
            templates: [...(state.templates ?? []), nextTemplate],
          };
        });
      },

      removeTemplate: (templateId) => {
        set((state) => ({
          templates: (state.templates ?? []).filter((template) => template.id !== templateId),
        }));
      },

      removeWorkoutHistorySession: (sessionId) => {
        set((state) => ({
          workoutHistory: (state.workoutHistory ?? []).filter(
            (session) => session.id !== sessionId
          ),
        }));
      },

      updateWorkoutHistoryTitle: (sessionId, title) => {
        set((state) => ({
          workoutHistory: (state.workoutHistory ?? []).map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  templateName: title,
                }
              : session
          ),
        }));
      },

      updateWorkoutHistoryTimestamps: (sessionId, updates) => {
        set((state) => ({
          workoutHistory: (state.workoutHistory ?? []).map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  ...updates,
                }
              : session
          ),
        }));
      },

      updateWorkoutHistoryNotes: (sessionId, notes) => {
        set((state) => ({
          workoutHistory: (state.workoutHistory ?? []).map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  notes,
                }
              : session
          ),
        }));
      },

      updateWorkoutHistoryExerciseNotes: (sessionId, performedExerciseId, notes) => {
        set((state) => ({
          workoutHistory: (state.workoutHistory ?? []).map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  exercises: session.exercises.map((exercise) =>
                    exercise.id === performedExerciseId ? { ...exercise, notes } : exercise
                  ),
                }
              : session
          ),
        }));
      },

      updateWorkoutHistorySet: (sessionId, performedExerciseId, setId, updates) => {
        set((state) => ({
          workoutHistory: (state.workoutHistory ?? []).map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  exercises: session.exercises.map((exercise) => {
                    if (exercise.id !== performedExerciseId) {
                      return exercise;
                    }

                    let nextSets = exercise.sets;

                    if (Object.prototype.hasOwnProperty.call(updates, "weight")) {
                      nextSets = updateFollowingSets(
                        nextSets,
                        setId,
                        "weight",
                        updates.weight ?? null
                      );
                    }

                    if (Object.prototype.hasOwnProperty.call(updates, "reps")) {
                      nextSets = updateFollowingSets(
                        nextSets,
                        setId,
                        "reps",
                        updates.reps ?? null
                      );
                    }

                    return {
                      ...exercise,
                      sets: nextSets.map((setItem) =>
                        setItem.id === setId
                          ? {
                              ...setItem,
                              ...updates,
                              completed:
                                Object.prototype.hasOwnProperty.call(updates, "weight") ||
                                Object.prototype.hasOwnProperty.call(updates, "reps")
                                  ? true
                                  : setItem.completed,
                              timestamp:
                                Object.prototype.hasOwnProperty.call(updates, "weight") ||
                                Object.prototype.hasOwnProperty.call(updates, "reps")
                                  ? setItem.timestamp ?? new Date().toISOString()
                                  : setItem.timestamp,
                            }
                          : setItem
                      ),
                    };
                  }),
                }
              : session
          ),
        }));
      },

      addSetToWorkoutHistoryExercise: (sessionId, performedExerciseId) => {
        set((state) => ({
          workoutHistory: (state.workoutHistory ?? []).map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  exercises: session.exercises.map((exercise) =>
                    exercise.id === performedExerciseId
                      ? {
                          ...exercise,
                          sets: [
                            ...exercise.sets,
                            createCompletedHistorySet(
                              exercise.sets[exercise.sets.length - 1]
                            ),
                          ],
                        }
                      : exercise
                  ),
                }
              : session
          ),
        }));
      },

      removeSetFromWorkoutHistoryExercise: (sessionId, performedExerciseId, setId) => {
        set((state) => ({
          workoutHistory: (state.workoutHistory ?? []).map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  exercises: session.exercises.map((exercise) =>
                    exercise.id === performedExerciseId
                      ? {
                          ...exercise,
                          sets: exercise.sets.filter((setItem) => setItem.id !== setId),
                        }
                      : exercise
                  ),
                }
              : session
          ),
        }));
      },

      removeExerciseFromWorkoutHistory: (sessionId, performedExerciseId) => {
        set((state) => ({
          workoutHistory: (state.workoutHistory ?? []).map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  exercises: session.exercises
                    .filter((exercise) => exercise.id !== performedExerciseId)
                    .map((exercise, index) => ({ ...exercise, order: index })),
                }
              : session
          ),
        }));
      },

      addExerciseToWorkoutHistory: (sessionId, exerciseId) => {
        set((state) => {
          const exercise = (state.exercises ?? []).find((item) => item.id === exerciseId);
          if (!exercise) {
            return state;
          }

          const latestPerformedExercise = getLatestPerformedExercise(
            state.workoutHistory ?? [],
            exerciseId
          );

          return {
            workoutHistory: (state.workoutHistory ?? []).map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    exercises: [
                      ...session.exercises,
                      createCompletedHistoryExercise(
                        exercise,
                        session.exercises.length,
                        latestPerformedExercise?.sets.length ?? 3,
                        exercise.defaultRestSeconds ?? 90,
                        getLatestExerciseNotes(state.workoutHistory ?? [], exerciseId) ??
                          exercise.notes,
                        latestPerformedExercise?.sets
                      ),
                    ],
                  }
                : session
            ),
          };
        });
      },

      addSetToExercise: (performedExerciseId) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((exercise) =>
                exercise.id === performedExerciseId
                  ? {
                      ...exercise,
                      sets: [
                        ...exercise.sets,
                        createSetFromPrevious(exercise.sets[exercise.sets.length - 1]),
                      ],
                    }
                  : exercise
              ),
            },
          };
        });
      },

      removeSetFromExercise: (performedExerciseId, setId) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((exercise) => {
                if (exercise.id !== performedExerciseId) {
                  return exercise;
                }

                return {
                  ...exercise,
                  sets: exercise.sets.filter((setItem) => setItem.id !== setId),
                };
              }),
            },
            activeRestTimer:
              state.activeRestTimer?.setId === setId ? null : state.activeRestTimer,
          };
        });
      },

      removeExerciseFromActiveWorkout: (performedExerciseId) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises
                .filter((exercise) => exercise.id !== performedExerciseId)
                .map((exercise, index) => ({ ...exercise, order: index })),
            },
            activeRestTimer: state.activeWorkout.exercises
              .find((exercise) => exercise.id === performedExerciseId)
              ?.sets.some((setItem) => setItem.id === state.activeRestTimer?.setId)
              ? null
              : state.activeRestTimer,
          };
        });
      },

      moveExerciseInActiveWorkout: (performedExerciseId, toIndex) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          const currentExercises = state.activeWorkout.exercises;
          const fromIndex = currentExercises.findIndex(
            (exercise) => exercise.id === performedExerciseId
          );

          if (fromIndex === -1) {
            return state;
          }

          const boundedToIndex = Math.min(
            Math.max(Math.round(toIndex), 0),
            currentExercises.length - 1
          );

          if (fromIndex === boundedToIndex) {
            return state;
          }

          const nextExercises = [...currentExercises];
          const [movedExercise] = nextExercises.splice(fromIndex, 1);
          nextExercises.splice(boundedToIndex, 0, movedExercise);

          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: nextExercises.map((exercise, index) => ({
                ...exercise,
                order: index,
              })),
            },
          };
        });
      },

      updateSet: (performedExerciseId, setId, updates) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((exercise) => {
                if (exercise.id !== performedExerciseId) {
                  return exercise;
                }

                const updatesTrainingValues =
                  Object.prototype.hasOwnProperty.call(updates, "weight") ||
                  Object.prototype.hasOwnProperty.call(updates, "reps");
                const targetSet = exercise.sets.find((setItem) => setItem.id === setId);

                if (updatesTrainingValues && targetSet?.completed) {
                  return exercise;
                }

                let nextSets = exercise.sets;

                if (Object.prototype.hasOwnProperty.call(updates, "weight")) {
                  nextSets = updateFollowingSets(
                    nextSets,
                    setId,
                    "weight",
                    updates.weight ?? null
                  );
                }

                if (Object.prototype.hasOwnProperty.call(updates, "reps")) {
                  nextSets = updateFollowingSets(
                    nextSets,
                    setId,
                    "reps",
                    updates.reps ?? null
                  );
                }

                return {
                  ...exercise,
                  sets: nextSets.map((setItem) =>
                    setItem.id === setId ? { ...setItem, ...updates } : setItem
                  ),
                };
              }),
            },
          };
        });
      },

      updateExerciseNotes: (performedExerciseId, notes) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((exercise) =>
                exercise.id === performedExerciseId
                  ? { ...exercise, notes }
                  : exercise
              ),
            },
          };
        });
      },

      updateActiveWorkoutNotes: (notes) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          return {
            activeWorkout: {
              ...state.activeWorkout,
              notes,
            },
          };
        });
      },

      updateActiveWorkoutTitle: (title) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          return {
            activeWorkout: {
              ...state.activeWorkout,
              templateName: title,
            },
          };
        });
      },

      completeSet: (performedExerciseId, setId) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((exercise) =>
                exercise.id === performedExerciseId
                  ? {
                      ...exercise,
                      sets: exercise.sets.map((setItem) =>
                        setItem.id === setId
                          ? (() => {
                              const completed = !setItem.completed;

                              return {
                                ...setItem,
                                completed,
                                timestamp: completed ? new Date().toISOString() : undefined,
                              };
                            })()
                          : setItem
                      ),
                    }
                  : exercise
              ),
            },
            activeRestTimer:
              state.activeRestTimer?.setId === setId ? null : state.activeRestTimer,
          };
        });
      },

      startRestTimer: (setId, durationSeconds) => {
        const safeDurationSeconds = Math.max(0, Math.round(durationSeconds));
        if (safeDurationSeconds <= 0) {
          set({ activeRestTimer: null });
          return;
        }

        set({
          activeRestTimer: {
            setId,
            durationSeconds: safeDurationSeconds,
            endsAt: new Date(Date.now() + safeDurationSeconds * 1000).toISOString(),
          },
        });
      },

      stopRestTimer: () => {
        set({ activeRestTimer: null });
      },

      addCustomExercise: (exercise) => {
        const newExercise: Exercise = {
          ...exercise,
          id: createId(),
        };

        set((state) => ({
          exercises: [...(state.exercises ?? []), newExercise],
        }));
      },

      updateCustomExercise: (exerciseId, updates) => {
        set((state) => ({
          exercises: (state.exercises ?? []).map((exercise) =>
            exercise.id === exerciseId ? { ...exercise, ...updates } : exercise
          ),
        }));
      },

      revertExerciseToSeed: (exerciseId) => {
        const seedExercise = exercisesSeed.find((exercise) => exercise.id === exerciseId);
        if (!seedExercise) {
          return;
        }

        set((state) => ({
          exercises: (state.exercises ?? []).map((exercise) =>
            exercise.id === exerciseId ? seedExercise : exercise
          ),
        }));
      },

      removeCustomExercise: (exerciseId) => {
        set((state) => ({
          exercises: (state.exercises ?? []).filter((exercise) => exercise.id !== exerciseId),
          activeWorkout: state.activeWorkout
            ? {
                ...state.activeWorkout,
                exercises: state.activeWorkout.exercises.filter(
                  (exercise) => exercise.exerciseId !== exerciseId
                ),
              }
            : null,
          activeRestTimer: state.activeWorkout?.exercises
            .filter((exercise) => exercise.exerciseId === exerciseId)
            .some((exercise) =>
              exercise.sets.some((setItem) => setItem.id === state.activeRestTimer?.setId)
            )
            ? null
            : state.activeRestTimer,
        }));
      },

      addExerciseToActiveWorkout: (exerciseId) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          const exercise = (state.exercises ?? []).find((item) => item.id === exerciseId);
          if (!exercise) return state;
          const latestPerformedExercise = getLatestPerformedExercise(
            state.workoutHistory ?? [],
            exerciseId
          );

          const newExercise = buildPerformedExercise(
            exercise,
            state.activeWorkout.exercises.length,
            latestPerformedExercise?.sets.length ?? 3,
            exercise.defaultRestSeconds ?? 90,
            getLatestExerciseNotes(state.workoutHistory ?? [], exerciseId) ?? exercise.notes,
            latestPerformedExercise?.sets,
            latestPerformedExercise?.bodyweightLoadMode ?? "added"
          );

          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: [...state.activeWorkout.exercises, newExercise],
            },
          };
        });
      },

      updateExerciseRest: (performedExerciseId, restSeconds) => {
        set((state) => {
          if (!state.activeWorkout) return state;

          return {
            activeWorkout: {
              ...state.activeWorkout,
              exercises: state.activeWorkout.exercises.map((exercise) =>
                exercise.id === performedExerciseId
                  ? { ...exercise, restSeconds }
                  : exercise
              ),
            },
          };
        });
      },
    }),
    {
      name: APP_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: createAppPersistedState,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<AppState>) ?? {};
        const mergedExercises =
          persisted.exercises && persisted.exercises.length > 0
            ? mergeSeedExercises(persisted.exercises)
            : currentState.exercises;
        const exerciseMap = new Map(
          mergedExercises.map((exercise) => [exercise.id, exercise])
        );
        const currentBodyWeightKg =
          persisted.currentBodyWeightKg ?? currentState.currentBodyWeightKg;

        return {
          ...currentState,
          ...persisted,
          exercises: mergedExercises,
          templates:
            persisted.templates && persisted.templates.length > 0
              ? persisted.templates
              : currentState.templates,
          workoutHistory: (persisted.workoutHistory ?? currentState.workoutHistory).map(
            (session) => snapshotWorkoutSession(session, exerciseMap)
          ),
          activeWorkout: persisted.activeWorkout
            ? snapshotWorkoutSession(persisted.activeWorkout, exerciseMap)
            : currentState.activeWorkout,
          activeRestTimer: persisted.activeRestTimer ?? currentState.activeRestTimer,
          isWorkoutMinimized:
            persisted.isWorkoutMinimized ?? currentState.isWorkoutMinimized,
          isWorkoutTransitioning: currentState.isWorkoutTransitioning,
          pendingWorkoutMinimizeRoute: currentState.pendingWorkoutMinimizeRoute,
          weeklyWorkoutGoal:
            persisted.weeklyWorkoutGoal ?? currentState.weeklyWorkoutGoal,
          currentBodyWeightKg,
          overviewCardOrder: sanitizeOverviewCardOrder(persisted.overviewCardOrder),
          hiddenOverviewCards: (persisted.hiddenOverviewCards ?? []).filter(
            (card): card is OverviewCardKey =>
              OVERVIEW_CARD_KEYS.includes(card as OverviewCardKey)
          ),
          creatineTakenDate:
            persisted.creatineTakenDate ?? currentState.creatineTakenDate,
          creatineLogs:
            persisted.creatineLogs ??
            (persisted.creatineTakenDate
              ? { [persisted.creatineTakenDate]: 5 }
              : currentState.creatineLogs),
          creatineReminderEnabled:
            persisted.creatineReminderEnabled ??
            currentState.creatineReminderEnabled,
          creatineReminderHour:
            persisted.creatineReminderHour ?? currentState.creatineReminderHour,
          creatineReminderMinute:
            persisted.creatineReminderMinute ?? currentState.creatineReminderMinute,
          creatineReminderNotificationId: Array.isArray(
            persisted.creatineReminderNotificationId
          )
            ? persisted.creatineReminderNotificationId
            : typeof persisted.creatineReminderNotificationId === "string"
              ? [persisted.creatineReminderNotificationId]
              : currentState.creatineReminderNotificationId,
          darkMode: persisted.darkMode ?? currentState.darkMode,
          hasHydrated: currentState.hasHydrated,
        };
      },
    }
  )
);
