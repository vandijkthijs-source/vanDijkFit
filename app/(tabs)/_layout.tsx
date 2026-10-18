import { router, Tabs, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "../../components/haptic-tab";
import { ThemeColors, useThemeColors } from "../../constants/theme";
import { useAppStore } from "../../store/useAppStore";

const iconMap = {
  today: "sparkles-outline",
  workout: "barbell-outline",
  history: "time-outline",
  "body-map": "body-outline",
} as const;

export default function TabsLayout() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const activeWorkout = useAppStore((state) => state.activeWorkout);
  const isWorkoutMinimized = useAppStore((state) => state.isWorkoutMinimized);
  const isWorkoutTransitioning = useAppStore(
    (state) => state.isWorkoutTransitioning
  );
  const setWorkoutMinimized = useAppStore((state) => state.setWorkoutMinimized);
  const setWorkoutTransitioning = useAppStore(
    (state) => state.setWorkoutTransitioning
  );
  const requestWorkoutMinimize = useAppStore((state) => state.requestWorkoutMinimize);
  const clearWorkoutMinimizeRequest = useAppStore(
    (state) => state.clearWorkoutMinimizeRequest
  );
  const bottomInset = insets.bottom;
  const tabBarHeight = 54;
  const resumeBarHeight = 54;
  const tabBarOverlap = 2;
  const totalTabBarHeight = tabBarHeight + bottomInset + tabBarOverlap;
  const getTabHref = (name: keyof typeof iconMap) => `/(tabs)/${name}`;
  const isWorkoutRoute =
    pathname === "/workout" || pathname === "/(tabs)/workout";
  const shouldShowResumeBar =
    Boolean(activeWorkout && isWorkoutMinimized) &&
    !isWorkoutTransitioning &&
    !isWorkoutRoute;

  useEffect(() => {
    if (
      !activeWorkout ||
      !isWorkoutRoute ||
      !isWorkoutMinimized ||
      isWorkoutTransitioning
    ) {
      return;
    }

    clearWorkoutMinimizeRequest();
    setWorkoutMinimized(false);
  }, [
    activeWorkout,
    clearWorkoutMinimizeRequest,
    isWorkoutMinimized,
    isWorkoutRoute,
    isWorkoutTransitioning,
    setWorkoutMinimized,
  ]);

  const resumeActiveWorkout = () => {
    clearWorkoutMinimizeRequest();
    setWorkoutTransitioning(true);
    setWorkoutMinimized(false);
    router.replace(`/(tabs)/workout?resumeWorkout=${Date.now()}`);
  };

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSoft,
          tabBarStyle: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -tabBarOverlap,
            backgroundColor: colors.panelStrong,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            borderRadius: 0,
            height: totalTabBarHeight,
            paddingTop: 0,
            paddingBottom: bottomInset,
            paddingHorizontal: 4,
            elevation: 0,
            overflow: "hidden",
          },
          tabBarItemStyle: {
            borderRadius: 0,
            marginHorizontal: 0,
            paddingVertical: 0,
          },
          tabBarIconStyle: {
            marginBottom: 1,
          },
          sceneStyle: {
            backgroundColor: colors.background,
            paddingBottom: 0,
          },
          tabBarBackground: () => null,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={iconMap[route.name as keyof typeof iconMap]}
              size={size}
              color={color}
            />
          ),
        })}
      >
        <Tabs.Screen
          name="today"
          options={{ title: "Overview" }}
          listeners={{
            tabPress: (event) => {
              if (activeWorkout && !isWorkoutMinimized) {
                event.preventDefault();
                requestWorkoutMinimize(getTabHref("today"));
              }
            },
          }}
        />
        <Tabs.Screen
          name="workout"
          options={{ title: "Workout" }}
          listeners={{
            tabPress: (event) => {
              if (activeWorkout && isWorkoutMinimized) {
                event.preventDefault();
                resumeActiveWorkout();
              }
            },
          }}
        />
        <Tabs.Screen
          name="history"
          options={{ title: "History" }}
          listeners={{
            tabPress: (event) => {
              if (activeWorkout && !isWorkoutMinimized) {
                event.preventDefault();
                requestWorkoutMinimize(getTabHref("history"));
              }
            },
          }}
        />
        <Tabs.Screen
          name="body-map"
          options={{ title: "Body Map" }}
          listeners={{
            tabPress: (event) => {
              if (activeWorkout && !isWorkoutMinimized) {
                event.preventDefault();
                requestWorkoutMinimize(getTabHref("body-map"));
              }
            },
          }}
        />
      </Tabs>

      {shouldShowResumeBar ? (
        <View
          style={[
            styles.resumeBarContainer,
            {
              bottom: totalTabBarHeight - tabBarOverlap,
              height: resumeBarHeight,
            },
          ]}
        >
          <Pressable
            onPress={resumeActiveWorkout}
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [styles.resumeBar, pressed && styles.resumeBarPressed]}
          >
            <View style={styles.resumeCopy}>
              <Text style={styles.resumeLabel}>ACTIVE WORKOUT</Text>
              <Text style={styles.resumeTitle}>
                {activeWorkout?.templateName?.trim() || "Open Workout"}
              </Text>
            </View>
            <Ionicons name="chevron-up" size={22} color={colors.accent} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.panelStrong,
  },
  resumeBarContainer: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  resumeBar: {
    flex: 1,
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resumeCopy: {
    flex: 1,
    paddingRight: 12,
  },
  resumeLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  resumeTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 3,
  },
  resumeBarPressed: {
    opacity: 0.96,
  },
});
