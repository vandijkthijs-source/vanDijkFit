import { Gesture } from "react-native-gesture-handler";
import { ReorderScrollView } from "../../components/ui/ReorderScrollView";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { overviewCardRegistry, overviewCards } from "../../components/overview/cardRegistry";
import { reconcileOrder } from "../../features/reorder/order";
import ReorderList from "../../components/ui/ReorderList";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";
import { OverviewCardKey, useAppStore } from "../../store/useAppStore";

export default function TodayScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const overviewCardOrder = useAppStore((state) => state.overviewCardOrder);
  const hiddenOverviewCards = useAppStore((state) => state.hiddenOverviewCards);
  const setOverviewCardOrder = useAppStore((state) => state.setOverviewCardOrder);
  const showOverviewCard = useAppStore((state) => state.showOverviewCard);
  const [isOverviewEditing, setIsOverviewEditing] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollOffset = useRef(0);
  const scrollViewport = useRef({ top: 0, height: 0 });
  const reorderScroll = { gesture: scrollGesture, ref: scrollRef, offset: scrollOffset, viewport: scrollViewport, setDragging: setIsOverviewEditing };
  const visibleOverviewCards = overviewCardOrder.filter(
    (card) => !hiddenOverviewCards.includes(card)
  );
  const availableOverviewCards = overviewCards.filter((card) =>
    hiddenOverviewCards.includes(card.id)
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={darkMode ? "light" : "dark"} />

      <Modal
        animationType="fade"
        transparent
        visible={isAddCardOpen}
        onRequestClose={() => setIsAddCardOpen(false)}
      >
        <View style={styles.addCardModal}>
          <Pressable
            onPress={() => setIsAddCardOpen(false)}
            style={styles.addCardBackdrop}
          />
          <View style={styles.addCardSheet}>
            <Text style={styles.addCardTitle}>Add overview card</Text>
            {availableOverviewCards.map((card) => (
              <Pressable
                key={card.id}
                onPress={() => {
                  showOverviewCard(card.id);
                  setIsAddCardOpen(false);
                }}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.addCardOption,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.addCardOptionText}>{card.label}</Text>
                <Ionicons name="add" size={20} color={colors.accent} />
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <ReorderScrollView nativeGesture={scrollGesture}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        scrollEnabled={!isOverviewEditing}
        ref={scrollRef}
        scrollEventThrottle={16}
        onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
        onLayout={() => scrollRef.current?.getNativeScrollRef()?.measureInWindow((_x: number, top: number, _w: number, height: number) => { scrollViewport.current = { top, height }; })}
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Text style={styles.title}>vDstrong</Text>
            <View style={styles.heroActions}>
              <Pressable
                onPress={() => router.push("/exercises/manage")}
                hitSlop={10}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.heroActionButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons name="barbell-outline" size={18} color={colors.accent} />
              </Pressable>
              <Pressable
                onPress={() => router.push("/options" as never)}
                hitSlop={10}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.heroActionButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons name="settings-outline" size={19} color={colors.accent} />
              </Pressable>
            </View>
          </View>
        </View>

        <ReorderList ids={visibleOverviewCards} gap={18} scroll={reorderScroll}
          onSwipeLeft={id => useAppStore.getState().hideOverviewCard(id as OverviewCardKey)}
          label={id => overviewCardRegistry[id as OverviewCardKey].label}
          onCommit={ids => {
            const current = useAppStore.getState();
            const visible = current.overviewCardOrder.filter(id => !current.hiddenOverviewCards.includes(id));
            const queue = reconcileOrder(ids, visible) as OverviewCardKey[];
            setOverviewCardOrder(current.overviewCardOrder.map(id => current.hiddenOverviewCards.includes(id) ? id : queue.shift() ?? id));
          }}
          renderItem={id => {
            const Card = overviewCardRegistry[id as OverviewCardKey].Component;
            return <Card />;
          }} />

        {!isOverviewEditing && availableOverviewCards.length > 0 ? (
          <Pressable
            onPress={() => setIsAddCardOpen(true)}
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [
              styles.addOverviewCardButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons name="add" size={24} color={colors.accent} />
            <Text style={styles.addOverviewCardText}>ADD OVERVIEW CARD</Text>
          </Pressable>
        ) : null}
      </ReorderScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: 18,
      paddingTop: 24,
      paddingBottom: 112,
      gap: 18,
    },
    hero: {
      gap: 2,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "700",
      lineHeight: 32,
    },
    heroActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    heroActionButton: {
      minWidth: 32,
      minHeight: 32,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    addOverviewCardButton: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
      overflow: "hidden",
    },
    addOverviewCardText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0.6,
    },
    addCardModal: {
      flex: 1,
      justifyContent: "center",
      padding: 18,
    },
    addCardBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.52)",
    },
    addCardSheet: {
      width: "100%",
      maxWidth: 420,
      alignSelf: "center",
      padding: 18,
      gap: 10,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.panel,
    },
    addCardTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 2,
    },
    addCardOption: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      borderRadius: radii.md,
      backgroundColor: colors.backgroundAlt,
      overflow: "hidden",
    },
    addCardOptionText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    buttonPressed: {
      opacity: 0.96,
    },
  });
