import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  OverviewCardWrapper,
  OverviewDragGesture,
  OverviewReorderRow,
  OVERVIEW_REORDER_ROW_HEIGHT,
} from "../../components/overview/OverviewCardWrapper";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";
import { OverviewCardKey, useAppStore } from "../../store/useAppStore";

const OVERVIEW_CARD_GAP = 18;
const OVERVIEW_REORDER_OVERSHOOT = 36;
const OVERVIEW_HIDE_THRESHOLD = 72;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export default function TodayScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const overviewCardOrder = useAppStore((state) => state.overviewCardOrder);
  const hiddenOverviewCards = useAppStore((state) => state.hiddenOverviewCards);
  const setOverviewCardOrder = useAppStore((state) => state.setOverviewCardOrder);
  const hideOverviewCard = useAppStore((state) => state.hideOverviewCard);
  const showOverviewCard = useAppStore((state) => state.showOverviewCard);
  const [isOverviewEditing, setIsOverviewEditing] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [reorderCardIds, setReorderCardIds] = useState<OverviewCardKey[]>([]);
  const [reorderEntrySpacer, setReorderEntrySpacer] = useState(0);
  const [overviewCardHeights, setOverviewCardHeights] = useState<
    Partial<Record<OverviewCardKey, number>>
  >({});
  const [activeDragId, setActiveDragId] = useState<OverviewCardKey | null>(null);
  const [externalDragTop, setExternalDragTop] = useState<number | undefined>(undefined);
  const [externalSwipeX, setExternalSwipeX] = useState(0);
  const cardDragStartIndexRef = useRef(0);
  const reorderCardIdsRef = useRef<OverviewCardKey[]>([]);

  const visibleOverviewCards = overviewCardOrder.filter(
    (card) => !hiddenOverviewCards.includes(card)
  );
  const availableOverviewCards = overviewCards.filter((card) =>
    hiddenOverviewCards.includes(card.id)
  );

  const clearOverviewReorder = () => {
    setIsOverviewEditing(false);
    setReorderCardIds([]);
    reorderCardIdsRef.current = [];
    setReorderEntrySpacer(0);
    setActiveDragId(null);
    setExternalDragTop(undefined);
    setExternalSwipeX(0);
  };

  const mergeVisibleOverviewOrder = (nextVisibleOrder: OverviewCardKey[]) => {
    const nextVisibleSet = new Set(nextVisibleOrder);
    const missingVisibleCards = overviewCardOrder.filter(
      (card) => !hiddenOverviewCards.includes(card) && !nextVisibleSet.has(card)
    );
    const nextVisibleQueue = [...nextVisibleOrder, ...missingVisibleCards];

    return overviewCardOrder.map((card) =>
      hiddenOverviewCards.includes(card) ? card : nextVisibleQueue.shift() ?? card
    );
  };

  const commitOverviewReorder = () => {
    const nextOrder = reorderCardIdsRef.current;
    if (nextOrder.length === 0) {
      return;
    }

    const currentVisibleOrder = overviewCardOrder.filter(
      (card) => !hiddenOverviewCards.includes(card)
    );
    const orderChanged = nextOrder.some(
      (card, index) => currentVisibleOrder[index] !== card
    );

    if (orderChanged) {
      setOverviewCardOrder(mergeVisibleOverviewOrder(nextOrder));
    }
  };

  const exitOverviewReorderMode = () => {
    commitOverviewReorder();
    clearOverviewReorder();
  };

  const hideOverviewCardFromReorder = (card: OverviewCardKey) => {
    commitOverviewReorder();
    hideOverviewCard(card);
    clearOverviewReorder();
  };

  const moveReorderCardToIndex = (card: OverviewCardKey, toIndex: number) => {
    const currentIds = reorderCardIdsRef.current;
    const fromIndex = currentIds.indexOf(card);
    if (fromIndex === -1) {
      return;
    }

    const boundedToIndex = clamp(toIndex, 0, currentIds.length - 1);
    if (fromIndex === boundedToIndex) {
      return;
    }

    const nextIds = [...currentIds];
    const [movedId] = nextIds.splice(fromIndex, 1);
    nextIds.splice(boundedToIndex, 0, movedId);
    reorderCardIdsRef.current = nextIds;
    setReorderCardIds(nextIds);
  };

  const moveReorderCardFromTop = (card: OverviewCardKey, draggedTop: number) => {
    const currentIds = reorderCardIdsRef.current;
    const currentIndex = currentIds.indexOf(card);
    if (currentIndex === -1) {
      return;
    }

    if (
      draggedTop > (currentIndex + 0.5) * OVERVIEW_REORDER_ROW_HEIGHT &&
      currentIndex < currentIds.length - 1
    ) {
      moveReorderCardToIndex(card, currentIndex + 1);
      return;
    }

    if (
      draggedTop < (currentIndex - 0.5) * OVERVIEW_REORDER_ROW_HEIGHT &&
      currentIndex > 0
    ) {
      moveReorderCardToIndex(card, currentIndex - 1);
    }
  };

  const enterOverviewReorderMode = (card: OverviewCardKey) => {
    if (visibleOverviewCards.length === 0) {
      return;
    }

    const pressedIndex = visibleOverviewCards.indexOf(card);
    if (pressedIndex === -1) {
      return;
    }

    const precedingCardHeight =
      pressedIndex > 0
        ? visibleOverviewCards
            .slice(0, pressedIndex)
            .reduce(
              (total, item) =>
                total +
                (overviewCardHeights[item] ?? OVERVIEW_REORDER_ROW_HEIGHT) +
                OVERVIEW_CARD_GAP,
              0
            )
        : 0;
    const initialReorderIds = [...visibleOverviewCards];

    reorderCardIdsRef.current = initialReorderIds;
    setReorderCardIds(initialReorderIds);
    cardDragStartIndexRef.current = Math.max(pressedIndex, 0);
    setActiveDragId(card);
    setExternalDragTop(Math.max(pressedIndex, 0) * OVERVIEW_REORDER_ROW_HEIGHT);
    setExternalSwipeX(0);
    setReorderEntrySpacer(
      Math.max(
        0,
        precedingCardHeight - Math.max(pressedIndex, 0) * OVERVIEW_REORDER_ROW_HEIGHT
      )
    );
    setIsOverviewEditing(true);
  };

  const handleOverviewCardReorderMove = (card: OverviewCardKey, dy: number) => {
    const cardCount = reorderCardIdsRef.current.length;
    if (cardCount === 0) {
      return;
    }

    const startIndex = cardDragStartIndexRef.current;
    const minTop = -OVERVIEW_REORDER_OVERSHOOT;
    const maxTop =
      (cardCount - 1) * OVERVIEW_REORDER_ROW_HEIGHT + OVERVIEW_REORDER_OVERSHOOT;
    const draggedTop = clamp(
      startIndex * OVERVIEW_REORDER_ROW_HEIGHT + dy,
      minTop,
      maxTop
    );

    setActiveDragId(card);
    setExternalSwipeX(0);
    setExternalDragTop(draggedTop);
    moveReorderCardFromTop(card, draggedTop);
  };

  const handleOverviewCardReorderSwipe = (card: OverviewCardKey, dx: number) => {
    if (reorderCardIdsRef.current.length === 0) {
      return;
    }

    setActiveDragId(card);
    setExternalSwipeX(Math.min(0, dx));
  };

  const handleOverviewCardReorderRelease = (
    card: OverviewCardKey,
    gesture: OverviewDragGesture
  ) => {
    const shouldHide =
      gesture.dx <= -OVERVIEW_HIDE_THRESHOLD &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy);

    if (shouldHide) {
      hideOverviewCardFromReorder(card);
      return;
    }

    exitOverviewReorderMode();
  };

  useEffect(() => {
    if (isOverviewEditing && visibleOverviewCards.length === 0) {
      clearOverviewReorder();
    }
  }, [isOverviewEditing, visibleOverviewCards.length]);

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

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        scrollEnabled={!isOverviewEditing}
        onScrollBeginDrag={() => {
          if (isOverviewEditing) {
            exitOverviewReorderMode();
          }
        }}
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

        {isOverviewEditing ? (
          <>
            {reorderEntrySpacer > 0 ? (
              <View style={{ height: reorderEntrySpacer }} />
            ) : null}
            <View
              style={[
                styles.reorderList,
                {
                  height: Math.max(
                    0,
                    reorderCardIds.length * OVERVIEW_REORDER_ROW_HEIGHT - 8
                  ),
                },
              ]}
            >
              {reorderCardIds.map((card, index) => (
                <OverviewReorderRow
                  key={card}
                  card={card}
                  index={index}
                  cardCount={reorderCardIds.length}
                  activeDragId={activeDragId}
                  externalTop={activeDragId === card ? externalDragTop : undefined}
                  externalSwipeX={activeDragId === card ? externalSwipeX : undefined}
                  onMove={moveReorderCardFromTop}
                  onHide={hideOverviewCardFromReorder}
                  onDrop={exitOverviewReorderMode}
                  onDragStart={setActiveDragId}
                />
              ))}
            </View>
          </>
        ) : null}

        {visibleOverviewCards.map((card) => {
          const definition = overviewCardRegistry[card];
          const Card = definition.Component;

          return (
            <OverviewCardWrapper
              key={card}
              card={card}
              isArranging={isOverviewEditing}
              onLongPress={enterOverviewReorderMode}
              onReorderMove={handleOverviewCardReorderMove}
              onReorderSwipe={handleOverviewCardReorderSwipe}
              onReorderRelease={handleOverviewCardReorderRelease}
              onLayout={(height) =>
                setOverviewCardHeights((current) =>
                  current[card] === height ? current : { ...current, [card]: height }
                )
              }
            >
              <Card />
            </OverviewCardWrapper>
          );
        })}

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
      </ScrollView>
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
    reorderList: {
      position: "relative",
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
