import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import Svg, { G, Path } from "react-native-svg";
import { useAppStore } from "../../store/useAppStore";
import ExerciseCard from "../../components/workout/ExerciseCard";
import AppInput from "../../components/ui/AppInput";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { useRestTimer } from "../../hooks/useRestTimer";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";
import {
  calculatePerformedExerciseVolume,
  calculateSessionMuscleVolumes,
} from "../../features/body-map/muscle-score.utils";
import {
  FRONT_MAP_LAYER_TRANSLATE,
  FRONT_MAP_VIEWBOX,
  frontMapRegions,
} from "../../features/body-map/front-map-regions";
import {
  BACK_MAP_LAYER_TRANSLATE,
  BACK_MAP_VIEWBOX,
  backMapRegions,
} from "../../features/body-map/back-map-regions";
import { formatDuration } from "../../utils/format";
import { hasTemplateExerciseChanges } from "../../features/workouts/template.utils";
import { showAlert } from "../../lib/ui/alert";

const REORDER_ROW_HEIGHT = 62;
const EXERCISE_CARD_GAP = 14;
const REORDER_OVERSHOOT = 36;
const WORKOUT_NOTES_MIN_HEIGHT = 44;
const WORKOUT_NOTES_LINE_HEIGHT = 20;
const MAP_WIDTH = 150;
const MAP_HEIGHT = 394;
const HEATMAP_CONTENT_MAX_HEIGHT = 472;
const HEATMAP_TOAST_VISIBLE_MS = 1200;
const HEATMAP_TOAST_FADE_MS = 1400;

const frontImage = require("../../assets/body-map/front-man.png");
const backImage = require("../../assets/body-map/back-man.png");

const getWorkoutRegionHeatMap = (
  regions: { label: string; muscles: string[] }[],
  volumes: Record<string, number>,
  peakVolume: number
) =>
  new Map(
    regions.map((region) => {
      const regionVolume = region.muscles.reduce(
        (highest, muscle) => Math.max(highest, volumes[muscle] ?? 0),
        0
      );
      const ratio = regionVolume > 0 && peakVolume > 0 ? regionVolume / peakVolume : 0;

      return [
        region.label,
        {
          opacity: ratio > 0 ? Math.min(0.16 + ratio * 0.5, 0.82) : 0,
          fill: "#f13e50",
        },
      ] as const;
    })
  );

function ReorderExerciseRow({
  performedExerciseId,
  exerciseName,
  index,
  exerciseCount,
  activeDragId,
  onMove,
  onDrop,
  onDragStart,
  externalTop,
}: {
  performedExerciseId: string;
  exerciseName: string;
  index: number;
  exerciseCount: number;
  activeDragId: string | null;
  onMove: (performedExerciseId: string, draggedTop: number) => void;
  onDrop: () => void;
  onDragStart: (performedExerciseId: string) => void;
  externalTop?: number;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const top = useRef(new Animated.Value(index * REORDER_ROW_HEIGHT)).current;
  const indexRef = useRef(index);
  const exerciseCountRef = useRef(exerciseCount);
  const onMoveRef = useRef(onMove);
  const onDropRef = useRef(onDrop);
  const onDragStartRef = useRef(onDragStart);
  const startIndexRef = useRef(index);
  const isDragging = activeDragId === performedExerciseId;

  useEffect(() => {
    indexRef.current = index;
    exerciseCountRef.current = exerciseCount;
    onMoveRef.current = onMove;
    onDropRef.current = onDrop;
    onDragStartRef.current = onDragStart;
  }, [exerciseCount, index, onDragStart, onDrop, onMove]);

  useEffect(() => {
    if (isDragging) {
      return;
    }

    Animated.timing(top, {
      toValue: index * REORDER_ROW_HEIGHT,
      duration: 170,
      useNativeDriver: false,
    }).start();
  }, [index, isDragging, top]);

  useEffect(() => {
    if (externalTop === undefined) {
      return;
    }

    top.setValue(externalTop);
  }, [externalTop, top]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          startIndexRef.current = indexRef.current;
          top.stopAnimation();
          top.setValue(indexRef.current * REORDER_ROW_HEIGHT);
          onDragStartRef.current(performedExerciseId);
        },
        onPanResponderMove: (_, gestureState) => {
          const startIndex = startIndexRef.current;
          const minTop = -REORDER_OVERSHOOT;
          const maxTop =
            (exerciseCountRef.current - 1) * REORDER_ROW_HEIGHT + REORDER_OVERSHOOT;
          const draggedTop = Math.min(
            Math.max(startIndex * REORDER_ROW_HEIGHT + gestureState.dy, minTop),
            maxTop
          );
          top.setValue(draggedTop);
          onMoveRef.current(performedExerciseId, draggedTop);
        },
        onPanResponderRelease: () => {
          onDropRef.current();
        },
        onPanResponderTerminate: () => {
          onDropRef.current();
        },
      }),
    [performedExerciseId, top]
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.reorderRow,
        {
          top,
          zIndex: isDragging ? 4 : 1,
          elevation: isDragging ? 8 : 1,
        },
      ]}
    >
      <View style={styles.reorderIndex}>
        <Text style={styles.reorderIndexText}>{index + 1}</Text>
      </View>
      <Text numberOfLines={1} style={styles.reorderExerciseName}>
        {exerciseName}
      </Text>
      <Ionicons name="reorder-three-outline" size={24} color={colors.textMuted} />
    </Animated.View>
  );
}

export default function ActiveWorkoutScreen({
  resumeAnimationKey,
}: {
  resumeAnimationKey?: string | string[];
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const activeWorkout = useAppStore((state) => state.activeWorkout);
  const exercises = useAppStore((state) => state.exercises);
  const addSetToExercise = useAppStore((state) => state.addSetToExercise);
  const removeSetFromExercise = useAppStore((state) => state.removeSetFromExercise);
  const removeExerciseFromActiveWorkout = useAppStore(
    (state) => state.removeExerciseFromActiveWorkout
  );
  const moveExerciseInActiveWorkout = useAppStore(
    (state) => state.moveExerciseInActiveWorkout
  );
  const updateSet = useAppStore((state) => state.updateSet);
  const completeSet = useAppStore((state) => state.completeSet);
  const finishActiveWorkout = useAppStore((state) => state.finishActiveWorkout);
  const cancelActiveWorkout = useAppStore((state) => state.cancelActiveWorkout);
  const requestWorkoutMinimize = useAppStore((state) => state.requestWorkoutMinimize);
  const setWorkoutTransitioning = useAppStore(
    (state) => state.setWorkoutTransitioning
  );
  const updateExerciseNotes = useAppStore((state) => state.updateExerciseNotes);
  const updateActiveWorkoutNotes = useAppStore((state) => state.updateActiveWorkoutNotes);
  const updateActiveWorkoutTitle = useAppStore((state) => state.updateActiveWorkoutTitle);
  const updateExerciseRest = useAppStore((state) => state.updateExerciseRest);

  const {
    activeRestSetId,
    isRunning,
    remainingSeconds,
    durationSeconds,
    startTimer,
    stopTimer,
  } = useRestTimer();
  const { height: windowHeight } = useWindowDimensions();
  const [now, setNow] = useState(() => Date.now());
  const [finishedRestSetIds, setFinishedRestSetIds] = useState<string[]>([]);
  const [titleDraft, setTitleDraft] = useState("");
  const [workoutNotesHeight, setWorkoutNotesHeight] = useState(WORKOUT_NOTES_MIN_HEIGHT);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderExerciseIds, setReorderExerciseIds] = useState<string[]>([]);
  const [reorderEntrySpacer, setReorderEntrySpacer] = useState(0);
  const [hiddenWorkoutCardsHeight, setHiddenWorkoutCardsHeight] = useState(0);
  const [exerciseCardHeights, setExerciseCardHeights] = useState<Record<string, number>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [externalDragTop, setExternalDragTop] = useState<number | undefined>(undefined);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [showBackHeatmap, setShowBackHeatmap] = useState(false);
  const [isHeatmapExpanded, setIsHeatmapExpanded] = useState(false);
  const [renderHeatmapContent, setRenderHeatmapContent] = useState(false);
  const [showHeatmapToast, setShowHeatmapToast] = useState(false);
  const titleInputRef = useRef<TextInput | null>(null);
  const heatmapWasVisibleRef = useRef(false);
  const heatmapLayoutProgress = useRef(new Animated.Value(0)).current;
  const heatmapContentProgress = useRef(new Animated.Value(0)).current;
  const heatmapToastOpacity = useRef(new Animated.Value(0)).current;
  const heatmapToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleDragStartIndexRef = useRef(0);
  const reorderExerciseIdsRef = useRef<string[]>([]);
  const resumeAnimationId = useMemo(
    () =>
      typeof resumeAnimationKey === "string"
        ? resumeAnimationKey
        : Array.isArray(resumeAnimationKey)
          ? resumeAnimationKey.find((value) => value.length > 0) ?? ""
          : "",
    [resumeAnimationKey]
  );
  const shouldAnimateScreenIn = resumeAnimationId.length > 0;
  const screenTransition = useRef(
    new Animated.Value(shouldAnimateScreenIn ? 0 : 1)
  ).current;

  useEffect(() => {
    screenTransition.stopAnimation();

    if (!shouldAnimateScreenIn) {
      screenTransition.setValue(1);
      setWorkoutTransitioning(false);
      return;
    }

    setWorkoutTransitioning(true);
    screenTransition.setValue(0);
    const animation = Animated.timing(screenTransition, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished) {
        setWorkoutTransitioning(false);
      }
    });

    return () => animation.stop();
  }, [
    activeWorkout?.id,
    resumeAnimationId,
    screenTransition,
    setWorkoutTransitioning,
    shouldAnimateScreenIn,
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleMinimizeWorkout = () => {
    requestWorkoutMinimize("/(tabs)/today");
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!activeWorkout) {
        return false;
      }

      requestWorkoutMinimize("/(tabs)/today");
      return true;
    });

    return () => subscription.remove();
  }, [activeWorkout, requestWorkoutMinimize]);

  useEffect(() => {
    if (!isRunning && remainingSeconds === 0 && activeRestSetId) {
      setFinishedRestSetIds((current) =>
        current.includes(activeRestSetId) ? current : [...current, activeRestSetId]
      );
    }
  }, [activeRestSetId, isRunning, remainingSeconds]);

  useEffect(() => {
    setTitleDraft(activeWorkout?.templateName ?? "");
  }, [activeWorkout?.id, activeWorkout?.templateName]);

  useEffect(() => {
    return () => {
      if (heatmapToastTimeoutRef.current) {
        clearTimeout(heatmapToastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if ((activeWorkout?.exercises.length ?? 0) < 2 && isReorderMode) {
      setIsReorderMode(false);
      setReorderExerciseIds([]);
      reorderExerciseIdsRef.current = [];
      setReorderEntrySpacer(0);
      setActiveDragId(null);
      setExternalDragTop(undefined);
    }
  }, [activeWorkout?.exercises.length, isReorderMode]);

  const moveReorderExerciseToIndex = (performedExerciseId: string, toIndex: number) => {
    const currentIds = reorderExerciseIdsRef.current;
    const fromIndex = currentIds.indexOf(performedExerciseId);
    if (fromIndex === -1) {
      return;
    }

    const boundedToIndex = Math.min(Math.max(toIndex, 0), currentIds.length - 1);
    if (fromIndex === boundedToIndex) {
      return;
    }

    const nextIds = [...currentIds];
    const [movedId] = nextIds.splice(fromIndex, 1);
    nextIds.splice(boundedToIndex, 0, movedId);
    reorderExerciseIdsRef.current = nextIds;
    setReorderExerciseIds(nextIds);
  };

  const moveReorderExerciseFromTop = (performedExerciseId: string, draggedTop: number) => {
    const currentIds = reorderExerciseIdsRef.current;
    const currentIndex = currentIds.indexOf(performedExerciseId);
    if (currentIndex === -1) {
      return;
    }

    if (
      draggedTop > (currentIndex + 0.5) * REORDER_ROW_HEIGHT &&
      currentIndex < currentIds.length - 1
    ) {
      moveReorderExerciseToIndex(performedExerciseId, currentIndex + 1);
      return;
    }

    if (
      draggedTop < (currentIndex - 0.5) * REORDER_ROW_HEIGHT &&
      currentIndex > 0
    ) {
      moveReorderExerciseToIndex(performedExerciseId, currentIndex - 1);
    }
  };

  const commitReorder = () => {
    const nextOrder = reorderExerciseIdsRef.current;
    if (!activeWorkout || nextOrder.length === 0) {
      return;
    }

    nextOrder.forEach((performedExerciseId, index) => {
      if (activeWorkout.exercises[index]?.id !== performedExerciseId) {
        moveExerciseInActiveWorkout(performedExerciseId, index);
      }
    });
  };

  const exitReorderMode = () => {
    commitReorder();
    setIsReorderMode(false);
    setReorderExerciseIds([]);
    reorderExerciseIdsRef.current = [];
    setReorderEntrySpacer(0);
    setActiveDragId(null);
    setExternalDragTop(undefined);
  };

  const enterReorderMode = (performedExerciseId: string) => {
    if (!activeWorkout || activeWorkout.exercises.length < 2) {
      return;
    }

    const pressedIndex = activeWorkout.exercises.findIndex(
      (exercise) => exercise.id === performedExerciseId
    );
    const precedingCardHeight =
      pressedIndex > 0
        ? activeWorkout.exercises
            .slice(0, pressedIndex)
            .reduce(
              (total, exercise) =>
                total +
                (exerciseCardHeights[exercise.id] ?? REORDER_ROW_HEIGHT) +
                EXERCISE_CARD_GAP,
              0
            )
        : 0;

    const initialReorderIds = activeWorkout.exercises.map((exercise) => exercise.id);
    reorderExerciseIdsRef.current = initialReorderIds;
    setReorderExerciseIds(initialReorderIds);
    titleDragStartIndexRef.current = Math.max(pressedIndex, 0);
    setActiveDragId(performedExerciseId);
    setExternalDragTop(Math.max(pressedIndex, 0) * REORDER_ROW_HEIGHT);
    setReorderEntrySpacer(
      Math.max(
        0,
        hiddenWorkoutCardsHeight +
          precedingCardHeight -
          Math.max(pressedIndex, 0) * REORDER_ROW_HEIGHT
      )
    );
    setIsReorderMode(true);
  };

  const handleTitleReorderMove = (performedExerciseId: string, dy: number) => {
    if (!activeWorkout || !isReorderMode) {
      return;
    }

    const startIndex = titleDragStartIndexRef.current;
    const minTop = -REORDER_OVERSHOOT;
    const maxTop =
      (activeWorkout.exercises.length - 1) * REORDER_ROW_HEIGHT + REORDER_OVERSHOOT;
    const draggedTop = Math.min(
      Math.max(startIndex * REORDER_ROW_HEIGHT + dy, minTop),
      maxTop
    );
    setExternalDragTop(draggedTop);
    moveReorderExerciseFromTop(performedExerciseId, draggedTop);
  };

  const handleCompleteSet = (
    performedExerciseId: string,
    setId: string,
    wasCompleted: boolean,
    restSeconds?: number
  ) => {
    completeSet(performedExerciseId, setId);

    if (wasCompleted) {
      setFinishedRestSetIds((current) => current.filter((item) => item !== setId));
      if (activeRestSetId === setId) {
        stopTimer();
      }
      return;
    }

    if (!wasCompleted && restSeconds) {
      setFinishedRestSetIds((current) => current.filter((item) => item !== setId));
      startTimer(setId, restSeconds);
    }
  };

  const handleRemoveSet = (performedExerciseId: string, setId: string) => {
    removeSetFromExercise(performedExerciseId, setId);
    setFinishedRestSetIds((current) => current.filter((item) => item !== setId));
  };

  const finishWorkout = (updateTemplate = false) => {
    const finishedSessionId = finishActiveWorkout({ updateTemplate });
    if (finishedSessionId) {
      router.replace(
        `/workout/finished?sessionId=${encodeURIComponent(finishedSessionId)}` as never
      );
      return;
    }

    router.replace("/(tabs)/history");
  };

  const handleFinish = () => {
    if (isReorderMode) {
      exitReorderMode();
    }

    const { activeWorkout: currentWorkout, templates } = useAppStore.getState();
    const template = templates.find((item) => item.id === currentWorkout?.templateId);

    if (currentWorkout && template && hasTemplateExerciseChanges(currentWorkout, template)) {
      showAlert(
        "Update template?",
        `You changed the exercises or their order. Update "${template.name}" before saving this workout?`,
        [
          { text: "Keep template", style: "cancel", onPress: () => finishWorkout() },
          { text: "Update template", onPress: () => finishWorkout(true) },
        ]
      );
      return;
    }

    showAlert("Finish workout?", "This workout will be saved to your history.", [
      { text: "Keep logging", style: "cancel" },
      { text: "Finish", onPress: () => finishWorkout() },
    ]);
  };

  const handleCancel = () => {
    setIsCancelModalOpen(true);
  };

  const elapsed = activeWorkout
    ? formatDuration(activeWorkout.startedAt, new Date(now).toISOString())
    : "0:00";
  const completedSets =
    activeWorkout?.exercises
      .flatMap((exercise) => exercise.sets)
      .filter((set) => set.completed).length ?? 0;
  const sessionVolume =
    activeWorkout?.exercises.reduce(
      (total, performedExercise) => {
        const exercise =
          performedExercise.exerciseSnapshot ??
          exercises.find((item) => item.id === performedExercise.exerciseId);
        return exercise
          ? total +
              calculatePerformedExerciseVolume(activeWorkout, performedExercise, exercise)
          : total;
      },
      0
    ) ?? 0;
  const sessionMuscleVolumes: Record<string, number> = activeWorkout
    ? calculateSessionMuscleVolumes(activeWorkout, exercises)
    : {};
  const peakSessionMuscleVolume = Math.max(
    ...Object.values(sessionMuscleVolumes),
    0
  );
  const showWorkoutHeatmap = completedSets > 0 && peakSessionMuscleVolume > 0;

  useEffect(() => {
    if (showWorkoutHeatmap) {
      if (!heatmapWasVisibleRef.current) {
        setIsHeatmapExpanded(false);
        setRenderHeatmapContent(false);
        heatmapLayoutProgress.setValue(0);
        heatmapContentProgress.setValue(0);
        setShowHeatmapToast(true);
        heatmapToastOpacity.stopAnimation();
        heatmapToastOpacity.setValue(1);

        if (heatmapToastTimeoutRef.current) {
          clearTimeout(heatmapToastTimeoutRef.current);
        }

        heatmapToastTimeoutRef.current = setTimeout(() => {
          Animated.timing(heatmapToastOpacity, {
            toValue: 0,
            duration: HEATMAP_TOAST_FADE_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (finished) {
              setShowHeatmapToast(false);
            }
          });
        }, HEATMAP_TOAST_VISIBLE_MS);
      }
    } else {
      setIsHeatmapExpanded(false);
      setRenderHeatmapContent(false);
      heatmapLayoutProgress.setValue(0);
      heatmapContentProgress.setValue(0);
    }

    heatmapWasVisibleRef.current = showWorkoutHeatmap;
  }, [
    heatmapContentProgress,
    heatmapLayoutProgress,
    heatmapToastOpacity,
    showWorkoutHeatmap,
  ]);

  useEffect(() => {
    if (!showWorkoutHeatmap) {
      return;
    }

    if (isHeatmapExpanded) {
      setRenderHeatmapContent(true);
      Animated.parallel([
        Animated.timing(heatmapLayoutProgress, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(heatmapContentProgress, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(heatmapLayoutProgress, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(heatmapContentProgress, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setRenderHeatmapContent(false);
      }
    });
  }, [
    heatmapContentProgress,
    heatmapLayoutProgress,
    isHeatmapExpanded,
    showWorkoutHeatmap,
  ]);

  const frontRegionHeatMap = getWorkoutRegionHeatMap(
    frontMapRegions,
    sessionMuscleVolumes,
    peakSessionMuscleVolume
  );
  const backRegionHeatMap = getWorkoutRegionHeatMap(
    backMapRegions,
    sessionMuscleVolumes,
    peakSessionMuscleVolume
  );
  const screenTranslateY = screenTransition.interpolate({
    inputRange: [0, 1],
    outputRange: [windowHeight, 0],
  });
  const heatmapContentHeight = heatmapLayoutProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, HEATMAP_CONTENT_MAX_HEIGHT],
  });
  const heatmapContentTranslateY = heatmapContentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-HEATMAP_CONTENT_MAX_HEIGHT, 0],
  });

  if (!activeWorkout) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={darkMode ? "light" : "dark"} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No active workout</Text>
          <Pressable
            onPress={() => router.replace("/(tabs)/workout")}
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [styles.primaryLink, pressed && styles.glowPressed]}
          >
            <Text style={styles.primaryLinkText}>Go to workout</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <Animated.View
        style={[
          styles.screenContent,
          {
            transform: [{ translateY: screenTranslateY }],
          },
        ]}
      >
      <View style={styles.topBar}>
        <Pressable
          onPress={handleMinimizeWorkout}
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
        >
          <Ionicons name="chevron-down" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.timerPill}>
          <Ionicons name="time-outline" size={17} color={colors.text} />
          <Text style={styles.timerPillText}>{elapsed}</Text>
        </View>
        <Pressable
          onPress={handleFinish}
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [styles.finishButton, pressed && styles.glowPressed]}
        >
          <Text style={styles.finishText}>FINISH</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        scrollEnabled={!isReorderMode}
      >
        <View style={styles.headerBlock}>
          <Pressable
            onPress={() => titleInputRef.current?.focus()}
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [
              styles.titleInputWrap,
              pressed && styles.glowPressed,
            ]}
          >
            <TextInput
              ref={titleInputRef}
              value={titleDraft}
              onChangeText={setTitleDraft}
              onBlur={() => updateActiveWorkoutTitle(titleDraft)}
              placeholder="Workout title"
              placeholderTextColor={colors.textMuted}
              selectTextOnFocus
              selectionColor={colors.accent}
              style={styles.workoutTitle}
            />
          </Pressable>
          <Text style={styles.workoutTime}>Session in progress</Text>
        </View>

        {!isReorderMode ? (
          <View
            onLayout={(event) =>
              setHiddenWorkoutCardsHeight(event.nativeEvent.layout.height)
            }
          >
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Completed sets</Text>
                <Text style={styles.summaryValue}>{completedSets}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Volume</Text>
                <Text style={styles.summaryValue}>{sessionVolume} kg</Text>
              </View>
            </View>

            <View style={styles.notesCard}>
              <Text style={styles.notesTitle}>Workout notes</Text>
              <AppInput
                value={activeWorkout.notes ?? ""}
                onChangeText={updateActiveWorkoutNotes}
                placeholder="Energy, cues, machine setup"
                multiline
                onContentSizeChange={(event) => {
                  const contentHeight = Math.ceil(event.nativeEvent.contentSize.height);
                  setWorkoutNotesHeight(
                    contentHeight <= WORKOUT_NOTES_LINE_HEIGHT + 8
                      ? WORKOUT_NOTES_MIN_HEIGHT
                      : Math.max(WORKOUT_NOTES_MIN_HEIGHT, contentHeight)
                  );
                }}
                numberOfLines={1}
                returnKeyType="done"
                blurOnSubmit
                style={[
                  styles.notesInput,
                  workoutNotesHeight === WORKOUT_NOTES_MIN_HEIGHT
                    ? styles.notesInputSingleLine
                    : styles.notesInputExpanded,
                  { height: workoutNotesHeight },
                ]}
              />
            </View>

            {showWorkoutHeatmap ? (
              <View style={styles.heatmapShell}>
                <Pressable
                  onPress={() => setIsHeatmapExpanded((current) => !current)}
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => [
                    styles.heatmapPreview,
                    pressed && styles.glowPressed,
                  ]}
                >
                  <View style={styles.heatmapPreviewTextWrap}>
                    <Text numberOfLines={1} style={styles.heatmapPreviewTitle}>
                      Workout heatmaps
                    </Text>
                    <Text style={styles.heatmapPreviewAction}>
                      {isHeatmapExpanded ? "HIDE" : "VIEW"}
                    </Text>
                  </View>
                  <Ionicons
                    name={isHeatmapExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.accent}
                  />
                </Pressable>

                {renderHeatmapContent ? (
                  <Animated.View
                    style={[
                      styles.heatmapContentClip,
                      { height: heatmapContentHeight },
                    ]}
                  >
                    <Animated.View
                      style={[
                        styles.heatmapContent,
                        {
                          opacity: heatmapContentProgress,
                          transform: [{ translateY: heatmapContentTranslateY }],
                        },
                      ]}
                    >
                      <View style={styles.heatmapFigureWrap}>
                        <Image
                          source={showBackHeatmap ? backImage : frontImage}
                          style={styles.heatmapFigureImage}
                          resizeMode="contain"
                        />
                        {!showBackHeatmap ? (
                          <Svg
                            width={MAP_WIDTH}
                            height={MAP_HEIGHT}
                            viewBox={`0 0 ${FRONT_MAP_VIEWBOX.width} ${FRONT_MAP_VIEWBOX.height}`}
                            style={styles.heatmapOverlay}
                          >
                            <G transform={`translate(${FRONT_MAP_LAYER_TRANSLATE})`}>
                              {frontMapRegions.map((region) => {
                                const heat = frontRegionHeatMap.get(region.label);
                                return (
                                  <Path
                                    key={region.label}
                                    d={region.d}
                                    fill={heat?.fill ?? "#f13e50"}
                                    opacity={heat?.opacity ?? 0}
                                  />
                                );
                              })}
                            </G>
                          </Svg>
                        ) : (
                          <Svg
                            width={MAP_WIDTH}
                            height={MAP_HEIGHT}
                            viewBox={`0 0 ${BACK_MAP_VIEWBOX.width} ${BACK_MAP_VIEWBOX.height}`}
                            style={styles.heatmapOverlay}
                          >
                            <G transform={`translate(${BACK_MAP_LAYER_TRANSLATE})`}>
                              {backMapRegions.map((region) => {
                                const heat = backRegionHeatMap.get(region.label);
                                return (
                                  <Path
                                    key={region.label}
                                    d={region.d}
                                    fill={heat?.fill ?? "#f13e50"}
                                    opacity={heat?.opacity ?? 0}
                                  />
                                );
                              })}
                            </G>
                          </Svg>
                        )}
                      </View>

                      <Pressable
                        onPress={() => setShowBackHeatmap((current) => !current)}
                        android_ripple={{ color: colors.ripple }}
                        style={({ pressed }) => [
                          styles.heatmapSwitchButton,
                          pressed && styles.glowPressed,
                        ]}
                      >
                        <Text style={styles.heatmapSwitchText}>
                          {showBackHeatmap ? "SHOW FRONT" : "SHOW BACK"}
                        </Text>
                      </Pressable>
                    </Animated.View>
                  </Animated.View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {isReorderMode ? (
          <>
            {reorderEntrySpacer > 0 ? <View style={{ height: reorderEntrySpacer }} /> : null}
            <View
              style={[
                styles.reorderList,
                {
                  height: Math.max(
                    0,
                    reorderExerciseIds.length * REORDER_ROW_HEIGHT - 8
                  ),
                },
              ]}
            >
              {reorderExerciseIds.map((performedExerciseId, index) => {
                const performedExercise = activeWorkout.exercises.find(
                  (item) => item.id === performedExerciseId
                );
                if (!performedExercise) {
                  return null;
                }

                const exercise =
                  performedExercise.exerciseSnapshot ??
                  exercises.find((item) => item.id === performedExercise.exerciseId);

                return (
                  <ReorderExerciseRow
                    key={performedExercise.id}
                    performedExerciseId={performedExercise.id}
                    exerciseName={exercise?.name ?? "Exercise"}
                    index={index}
                    exerciseCount={activeWorkout.exercises.length}
                    activeDragId={activeDragId}
                    onMove={moveReorderExerciseFromTop}
                    onDrop={exitReorderMode}
                    onDragStart={setActiveDragId}
                    externalTop={
                      activeDragId === performedExercise.id ? externalDragTop : undefined
                    }
                  />
                );
              })}
            </View>
          </>
        ) : (
          null
        )}

        <>
          {activeWorkout.exercises.map((performedExercise) => {
              const exercise =
                performedExercise.exerciseSnapshot ??
                exercises.find((item) => item.id === performedExercise.exerciseId);
              if (!exercise) return null;

              return (
                <ExerciseCard
                  key={performedExercise.id}
                  exercise={exercise}
                  performedExercise={performedExercise}
                  hidden={isReorderMode}
                  onAddSet={() => addSetToExercise(performedExercise.id)}
                  onRemoveSet={(setId) => handleRemoveSet(performedExercise.id, setId)}
                  onRemoveExercise={() =>
                    removeExerciseFromActiveWorkout(performedExercise.id)
                  }
                  onUpdateSet={(setId, field, value) => {
                    const parsed = value === "" ? null : Number(value);
                    updateSet(performedExercise.id, setId, { [field]: parsed });
                  }}
                  onUpdateNotes={(value) => updateExerciseNotes(performedExercise.id, value)}
                  onUpdateRest={(restSeconds) =>
                    updateExerciseRest(performedExercise.id, restSeconds)
                  }
                  activeRestSetId={activeRestSetId}
                  isRestTimerRunning={isRunning}
                  remainingSeconds={remainingSeconds}
                  restTimerDurationSeconds={durationSeconds}
                  finishedRestSetIds={finishedRestSetIds}
                  onTitlePress={() =>
                    router.push({
                      pathname: "/exercises/create",
                      params: { exerciseId: exercise.id },
                    })
                  }
                  onTitleLongPress={() => enterReorderMode(performedExercise.id)}
                  onTitleReorderMove={(dy) =>
                    handleTitleReorderMove(performedExercise.id, dy)
                  }
                  onTitleReorderRelease={exitReorderMode}
                  onLayout={(height) =>
                    setExerciseCardHeights((current) =>
                      current[performedExercise.id] === height
                        ? current
                        : { ...current, [performedExercise.id]: height }
                    )
                  }
                  onCompleteSet={(setId) =>
                    handleCompleteSet(
                      performedExercise.id,
                      setId,
                      performedExercise.sets.find((setItem) => setItem.id === setId)
                        ?.completed ?? false,
                      performedExercise.restSeconds
                    )
                  }
                />
              );
            })}

            {!isReorderMode ? <View style={styles.actionStack}>
              <Pressable
                onPress={() => router.push("/workout/exercises")}
                hitSlop={10}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [styles.textAction, pressed && styles.glowPressed]}
              >
                <Text style={styles.primaryAction}>ADD EXERCISE</Text>
              </Pressable>
              <Pressable
                onPress={handleCancel}
                hitSlop={10}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [styles.textAction, pressed && styles.glowPressed]}
              >
                <Text style={styles.dangerAction}>CANCEL WORKOUT</Text>
              </Pressable>
            </View> : null}
          </>
      </ScrollView>
      {showHeatmapToast ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.heatmapToast, { opacity: heatmapToastOpacity }]}
        >
          <Text style={styles.heatmapToastText}>A heatmap has been created</Text>
        </Animated.View>
      ) : null}
      <ConfirmModal
        visible={isCancelModalOpen}
        title="Cancel workout?"
        message="This active workout will be discarded."
        cancelLabel="Keep workout"
        confirmLabel="Cancel workout"
        confirmTone="danger"
        onCancel={() => setIsCancelModalOpen(false)}
        onConfirm={() => {
          cancelActiveWorkout();
          setIsCancelModalOpen(false);
          router.replace("/(tabs)/workout");
        }}
      />
      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContent: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  iconButton: {
    width: 44,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.panelMuted,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconButtonPressed: {
    shadowColor: colors.white,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 10,
    marginRight: "auto",
    paddingHorizontal: 10,
  },
  timerPillText: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  finishButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  finishText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.9,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 120,
  },
  headerBlock: {
    marginBottom: 14,
  },
  workoutTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    paddingVertical: 0,
  },
  titleInputWrap: {
    width: "100%",
    marginHorizontal: -4,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  workoutTime: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 14,
  },
  modeBar: {
    alignItems: "flex-end",
    marginBottom: 14,
  },
  modeButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    overflow: "hidden",
  },
  modeButtonActive: {
    backgroundColor: colors.accent,
  },
  modeButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  modeButtonTextActive: {
    color: colors.background,
  },
  reorderList: {
    position: "relative",
  },
  reorderRow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 54,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 1,
  },
  reorderIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundAlt,
  },
  reorderIndexText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "800",
  },
  reorderExerciseName: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 6,
  },
  notesCard: {
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  notesTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  notesInput: {
    minHeight: WORKOUT_NOTES_MIN_HEIGHT,
    lineHeight: WORKOUT_NOTES_LINE_HEIGHT,
    includeFontPadding: false,
  },
  notesInputSingleLine: {
    paddingTop: 0,
    paddingBottom: 0,
    textAlignVertical: "center",
  },
  notesInputExpanded: {
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },
  heatmapShell: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    marginBottom: 14,
    overflow: "hidden",
  },
  heatmapPreview: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  heatmapPreviewTextWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginRight: 10,
  },
  heatmapPreviewTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  heatmapPreviewAction: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heatmapContentClip: {
    overflow: "hidden",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  heatmapContent: {
    padding: 14,
    gap: 12,
  },
  heatmapFigureWrap: {
    position: "relative",
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    alignSelf: "center",
  },
  heatmapFigureImage: {
    width: "100%",
    height: "100%",
  },
  heatmapOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  heatmapSwitchButton: {
    minHeight: 42,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    overflow: "hidden",
  },
  heatmapSwitchText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  heatmapToast: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 88,
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  heatmapToastText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  actionStack: {
    gap: 10,
    paddingTop: 16,
  },
  textAction: {
    width: "100%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  glowPressed: {
    opacity: 0.96,
    shadowColor: colors.accent,
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  primaryAction: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 1.1,
  },
  dangerAction: {
    color: colors.danger,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 1.1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  primaryLink: {
    minHeight: 44,
    minWidth: 156,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    overflow: "hidden",
  },
  primaryLinkText: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: "600",
  },
});
