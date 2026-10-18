import { router, Stack, useGlobalSearchParams, usePathname } from "expo-router";
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as NavigationBar from "expo-navigation-bar";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { ThemeColors, useThemeColors } from "../constants/theme";
import { useAppStore } from "../store/useAppStore";
import { syncBodyHeatmapWidget } from "../lib/widget/bodyHeatmapWidget";
import { syncCreatineWidget } from "../lib/widget/creatineWidget";
import { syncCreatineReminderNotification } from "../lib/notifications/creatineReminder";
import { useRestTimerAlerts } from "../hooks/useRestTimerAlerts";
import { useWorkoutBackup } from "../hooks/useWorkoutBackup";

function RootLayoutContent() {
  useWorkoutBackup();
  useRestTimerAlerts();

  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { minimizeWorkout } = useGlobalSearchParams<{ minimizeWorkout?: string }>();
  const { height: windowHeight } = useWindowDimensions();
  const tabBarHeight = 54;
  const resumeBarHeight = 54;
  const foldedBarBottom = tabBarHeight + insets.bottom;
  const foldedBarTop = Math.max(
    0,
    windowHeight - foldedBarBottom - resumeBarHeight
  );
  const activeWorkout = useAppStore((state) => state.activeWorkout);
  const isWorkoutMinimized = useAppStore((state) => state.isWorkoutMinimized);
  const pendingWorkoutMinimizeRoute = useAppStore(
    (state) => state.pendingWorkoutMinimizeRoute
  );
  const setWorkoutMinimized = useAppStore((state) => state.setWorkoutMinimized);
  const setWorkoutTransitioning = useAppStore(
    (state) => state.setWorkoutTransitioning
  );
  const clearWorkoutMinimizeRequest = useAppStore(
    (state) => state.clearWorkoutMinimizeRequest
  );
  const [isMinimizeOverlayVisible, setIsMinimizeOverlayVisible] = useState(false);
  const minimizeOverlayProgress = useRef(new Animated.Value(0)).current;
  const minimizeAnimationRef = useRef<ReturnType<typeof Animated.timing> | null>(null);
  const minimizeAnimationFrameRef = useRef<number | null>(null);
  const isMinimizeAnimatingRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    void NavigationBar.setBackgroundColorAsync(colors.panelStrong);
    void NavigationBar.setBorderColorAsync(colors.panelStrong);
    void NavigationBar.setButtonStyleAsync(darkMode ? "light" : "dark");
  }, [colors.panelStrong, darkMode]);

  useEffect(() => {
    let lastCreatineReminderSyncKey = "";

    const syncCurrentState = () => {
      const state = useAppStore.getState();
      void syncBodyHeatmapWidget(state.workoutHistory, state.exercises);
      void syncCreatineWidget(state.creatineLogs);
    };
    const syncCreatineReminder = (force = false) => {
      const state = useAppStore.getState();
      const syncKey = JSON.stringify({
        enabled: state.creatineReminderEnabled,
        hour: state.creatineReminderHour,
        minute: state.creatineReminderMinute,
        logs: state.creatineLogs,
      });

      if (!force && syncKey === lastCreatineReminderSyncKey) {
        return;
      }

      lastCreatineReminderSyncKey = syncKey;

      if (!state.creatineReminderEnabled) {
        return;
      }

      void syncCreatineReminderNotification({
        enabled: state.creatineReminderEnabled,
        hour: state.creatineReminderHour,
        minute: state.creatineReminderMinute,
        notificationId: state.creatineReminderNotificationId,
        creatineLogs: state.creatineLogs,
      }).then((notificationId) => {
        useAppStore.getState().setCreatineReminderNotificationId(notificationId);
        if (!notificationId || notificationId.length === 0) {
          useAppStore.getState().setCreatineReminderEnabled(false);
        }
      });
    };

    syncCurrentState();
    syncCreatineReminder(true);

    const unsubscribe = useAppStore.subscribe(() => {
      syncCurrentState();
      syncCreatineReminder();
    });
    const unsubscribeHydration = useAppStore.persist.onFinishHydration(() => {
      syncCurrentState();
      syncCreatineReminder(true);
    });

    return () => {
      unsubscribe();
      unsubscribeHydration();
    };
  }, []);

  useEffect(() => {
    const isMinimizeSourceRoute =
      pathname === "/workout" ||
      pathname === "/(tabs)/workout" ||
      pathname === "/exercises/manage" ||
      pathname.endsWith("/exercises/manage");

    if (
      !activeWorkout ||
      !pendingWorkoutMinimizeRoute ||
      isWorkoutMinimized ||
      !isMinimizeSourceRoute
    ) {
      return;
    }

    if (isMinimizeAnimatingRef.current) {
      return;
    }

    const targetRoute = pendingWorkoutMinimizeRoute;
    isMinimizeAnimatingRef.current = true;
    setIsMinimizeOverlayVisible(true);
    minimizeAnimationRef.current?.stop();
    if (minimizeAnimationFrameRef.current !== null) {
      cancelAnimationFrame(minimizeAnimationFrameRef.current);
      minimizeAnimationFrameRef.current = null;
    }
    minimizeOverlayProgress.setValue(0);
    setWorkoutTransitioning(true);
    setWorkoutMinimized(true);
    clearWorkoutMinimizeRequest();

    router.replace(targetRoute as never);

    minimizeAnimationFrameRef.current = requestAnimationFrame(() => {
      minimizeAnimationFrameRef.current = null;
      const animation = Animated.timing(minimizeOverlayProgress, {
        toValue: 1,
        duration: 340,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      });

      minimizeAnimationRef.current = animation;
      animation.start(({ finished }) => {
        minimizeAnimationRef.current = null;
        isMinimizeAnimatingRef.current = false;

        if (!finished) {
          return;
        }

        setIsMinimizeOverlayVisible(false);
        setWorkoutTransitioning(false);
      });
    });
  }, [
    activeWorkout,
    clearWorkoutMinimizeRequest,
    isWorkoutMinimized,
    minimizeOverlayProgress,
    pathname,
    pendingWorkoutMinimizeRoute,
    setWorkoutMinimized,
    setWorkoutTransitioning,
  ]);

  useEffect(() => {
    if (activeWorkout) {
      return;
    }

    minimizeAnimationRef.current?.stop();
    minimizeAnimationRef.current = null;
    if (minimizeAnimationFrameRef.current !== null) {
      cancelAnimationFrame(minimizeAnimationFrameRef.current);
      minimizeAnimationFrameRef.current = null;
    }
    isMinimizeAnimatingRef.current = false;
    setIsMinimizeOverlayVisible(false);
    setWorkoutTransitioning(false);
  }, [activeWorkout, setWorkoutTransitioning]);

  useEffect(() => {
    if (!activeWorkout || minimizeWorkout !== "1") {
      return;
    }

    const isWorkoutRoute = pathname === "/workout" || pathname === "/(tabs)/workout";
    if (isWorkoutRoute || isWorkoutMinimized) {
      return;
    }

    clearWorkoutMinimizeRequest();
    setWorkoutMinimized(true);
  }, [
    activeWorkout,
    clearWorkoutMinimizeRequest,
    isWorkoutMinimized,
    minimizeWorkout,
    pathname,
    setWorkoutMinimized,
  ]);

  const minimizeOverlayTranslateY = minimizeOverlayProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, foldedBarTop],
  });
  const minimizeOverlayHeight = minimizeOverlayProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [windowHeight, resumeBarHeight],
  });
  const minimizeOverlayRadius = minimizeOverlayProgress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0, 0, 8],
  });
  const minimizeFullContentOpacity = minimizeOverlayProgress.interpolate({
    inputRange: [0, 0.44, 0.78],
    outputRange: [1, 0.86, 0],
    extrapolate: "clamp",
  });
  const minimizeFoldedContentOpacity = minimizeOverlayProgress.interpolate({
    inputRange: [0, 0.56, 0.82, 1],
    outputRange: [0, 0, 0.92, 1],
    extrapolate: "clamp",
  });
  const minimizeFoldedContentTranslateY = minimizeOverlayProgress.interpolate({
    inputRange: [0, 0.58, 1],
    outputRange: [14, 14, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container} onTouchStart={Keyboard.dismiss}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="exercises/manage"
          options={{ animation: "fade" }}
        />
        <Stack.Screen
          name="exercises/[exerciseId]"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen name="workout/finished" options={{ animation: "fade" }} />
        <Stack.Screen name="history/[sessionId]" options={{ animation: "fade" }} />
        <Stack.Screen name="options" options={{ animation: "fade" }} />
      </Stack>
      {insets.bottom > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.bottomFill, { height: insets.bottom + 2 }]}
        />
      ) : null}
      {isMinimizeOverlayVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.minimizeMorphFrame,
            {
              height: minimizeOverlayHeight,
              borderTopLeftRadius: minimizeOverlayRadius,
              borderTopRightRadius: minimizeOverlayRadius,
              transform: [{ translateY: minimizeOverlayTranslateY }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.minimizeFullContent,
              {
                height: windowHeight,
                opacity: minimizeFullContentOpacity,
              },
            ]}
          >
            <View style={styles.minimizeTopBar}>
              <View style={styles.minimizeIconButton} />
              <View style={styles.minimizeTimerPill} />
              <View style={styles.minimizeFinishButton} />
            </View>
            <View style={styles.minimizeContent}>
              <View style={styles.minimizeTitleBlock}>
                <Text numberOfLines={1} style={styles.minimizeTitle}>
                  {activeWorkout?.templateName?.trim() || "Open Workout"}
                </Text>
                <Text style={styles.minimizeSubtitle}>Session in progress</Text>
              </View>
              <View style={styles.minimizeSummaryRow}>
                <View style={styles.minimizeSummaryCard} />
                <View style={styles.minimizeSummaryCard} />
              </View>
              <View style={styles.minimizeNotesCard} />
            </View>
          </Animated.View>
          <Animated.View
            style={[
              styles.minimizeFoldedBar,
              {
                height: resumeBarHeight,
                opacity: minimizeFoldedContentOpacity,
                transform: [{ translateY: minimizeFoldedContentTranslateY }],
              },
            ]}
          >
            <View style={styles.minimizeFoldedCopy}>
              <Text style={styles.minimizeFoldedLabel}>ACTIVE WORKOUT</Text>
              <Text numberOfLines={1} style={styles.minimizeFoldedTitle}>
                {activeWorkout?.templateName?.trim() || "Open Workout"}
              </Text>
            </View>
            <Ionicons name="chevron-up" size={22} color={colors.accent} />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <RootLayoutContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bottomFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.panelStrong,
  },
  minimizeMorphFrame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  minimizeFullContent: {
    backgroundColor: colors.background,
  },
  minimizeTopBar: {
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
  minimizeIconButton: {
    width: 44,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.panel,
  },
  minimizeTimerPill: {
    width: 90,
    height: 38,
    borderRadius: 999,
    backgroundColor: colors.panel,
  },
  minimizeFinishButton: {
    width: 82,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
  },
  minimizeContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  minimizeTitleBlock: {
    marginBottom: 18,
  },
  minimizeTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  minimizeSubtitle: {
    marginTop: 6,
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  minimizeSummaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  minimizeSummaryCard: {
    flex: 1,
    height: 92,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  minimizeNotesCard: {
    height: 132,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  minimizeFoldedBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  minimizeFoldedCopy: {
    flex: 1,
    paddingRight: 12,
  },
  minimizeFoldedLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  minimizeFoldedTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 3,
  },
});
