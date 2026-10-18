import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import { OVERVIEW_CARD_LABELS, OverviewCardKey } from "../../features/overview/overview-cards";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";

export const OVERVIEW_REORDER_ROW_HEIGHT = 68;

const LONG_PRESS_MS = 360;
const MOVE_CANCEL_DISTANCE = 8;
const SWIPE_HIDE_THRESHOLD = 72;
const SWIPE_HIDE_DISTANCE = 120;
const REORDER_OVERSHOOT = 36;

export type OverviewDragGesture = {
  dx: number;
  dy: number;
  vx: number;
  vy: number;
};

type OverviewCardSurfaceProps = ViewProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function OverviewCardSurface({
  children,
  style,
  ...props
}: OverviewCardSurfaceProps) {
  const colors = useThemeColors();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View {...props} style={[themedStyles.cardSurface, style]}>
      {children}
    </View>
  );
}

type OverviewCardWrapperProps = {
  card: OverviewCardKey;
  children: ReactNode;
  isArranging: boolean;
  onLongPress: (card: OverviewCardKey) => void;
  onReorderMove: (card: OverviewCardKey, dy: number) => void;
  onReorderSwipe: (card: OverviewCardKey, dx: number) => void;
  onReorderRelease: (card: OverviewCardKey, gesture: OverviewDragGesture) => void;
  onLayout?: (height: number) => void;
};

export function OverviewCardWrapper({
  card,
  children,
  isArranging,
  onLongPress,
  onReorderMove,
  onReorderSwipe,
  onReorderRelease,
  onLayout,
}: OverviewCardWrapperProps) {
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReorderingRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const latestGestureRef = useRef<OverviewDragGesture>({
    dx: 0,
    dy: 0,
    vx: 0,
    vy: 0,
  });
  const onLongPressRef = useRef(onLongPress);
  const onReorderMoveRef = useRef(onReorderMove);
  const onReorderSwipeRef = useRef(onReorderSwipe);
  const onReorderReleaseRef = useRef(onReorderRelease);

  useEffect(() => {
    onLongPressRef.current = onLongPress;
    onReorderMoveRef.current = onReorderMove;
    onReorderSwipeRef.current = onReorderSwipe;
    onReorderReleaseRef.current = onReorderRelease;
  }, [onLongPress, onReorderMove, onReorderRelease, onReorderSwipe]);

  const clearLongPressTimeout = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const moveActiveCard = (gesture: OverviewDragGesture) => {
    latestGestureRef.current = gesture;

    if (
      Math.abs(gesture.dx) > 10 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) &&
      gesture.dx < 0
    ) {
      onReorderSwipeRef.current(card, gesture.dx);
      return;
    }

    onReorderSwipeRef.current(card, 0);
    onReorderMoveRef.current(card, gesture.dy);
  };

  const releaseActiveCard = (gesture = latestGestureRef.current) => {
    clearLongPressTimeout();

    if (!isReorderingRef.current) {
      return;
    }

    isReorderingRef.current = false;
    onReorderReleaseRef.current(card, gesture);
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    if (isArranging) {
      return;
    }

    const { pageX, pageY } = event.nativeEvent;
    touchStartRef.current = { x: pageX, y: pageY };
    latestGestureRef.current = { dx: 0, dy: 0, vx: 0, vy: 0 };
    isReorderingRef.current = false;
    clearLongPressTimeout();
    longPressTimeoutRef.current = setTimeout(() => {
      isReorderingRef.current = true;
      onLongPressRef.current(card);
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    const touchStart = touchStartRef.current;
    if (!touchStart || (isArranging && !isReorderingRef.current)) {
      return;
    }

    const dx = event.nativeEvent.pageX - touchStart.x;
    const dy = event.nativeEvent.pageY - touchStart.y;

    if (!isReorderingRef.current) {
      if (Math.abs(dx) > MOVE_CANCEL_DISTANCE || Math.abs(dy) > MOVE_CANCEL_DISTANCE) {
        clearLongPressTimeout();
      }
      return;
    }

    moveActiveCard({ dx, dy, vx: 0, vy: 0 });
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    clearLongPressTimeout();
    releaseActiveCard();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => isReorderingRef.current,
        onMoveShouldSetPanResponderCapture: () => isReorderingRef.current,
        onShouldBlockNativeResponder: () => isReorderingRef.current,
        onPanResponderMove: (_, gestureState) => {
          if (!isReorderingRef.current) {
            return;
          }

          moveActiveCard({
            dx: gestureState.dx,
            dy: gestureState.dy,
            vx: gestureState.vx,
            vy: gestureState.vy,
          });
        },
        onPanResponderRelease: (_, gestureState) => {
          releaseActiveCard({
            dx: gestureState.dx,
            dy: gestureState.dy,
            vx: gestureState.vx,
            vy: gestureState.vy,
          });
        },
        onPanResponderTerminate: (_, gestureState) => {
          releaseActiveCard({
            dx: gestureState.dx,
            dy: gestureState.dy,
            vx: gestureState.vx,
            vy: gestureState.vy,
          });
        },
      }),
    [card]
  );

  useEffect(() => clearLongPressTimeout, []);

  return (
    <View
      {...panResponder.panHandlers}
      onLayout={(event: LayoutChangeEvent) => onLayout?.(event.nativeEvent.layout.height)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      pointerEvents="auto"
      style={[isArranging && styles.sourceCardHidden]}
    >
      {children}
    </View>
  );
}

type OverviewReorderRowProps = {
  card: OverviewCardKey;
  index: number;
  cardCount: number;
  activeDragId: OverviewCardKey | null;
  externalTop?: number;
  externalSwipeX?: number;
  onMove: (card: OverviewCardKey, draggedTop: number) => void;
  onHide: (card: OverviewCardKey) => void;
  onDrop: () => void;
  onDragStart: (card: OverviewCardKey) => void;
};

export function OverviewReorderRow({
  card,
  index,
  cardCount,
  activeDragId,
  externalTop,
  externalSwipeX,
  onMove,
  onHide,
  onDrop,
  onDragStart,
}: OverviewReorderRowProps) {
  const colors = useThemeColors();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);
  const top = useRef(new Animated.Value(index * OVERVIEW_REORDER_ROW_HEIGHT)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(index);
  const cardCountRef = useRef(cardCount);
  const onMoveRef = useRef(onMove);
  const onHideRef = useRef(onHide);
  const onDropRef = useRef(onDrop);
  const onDragStartRef = useRef(onDragStart);
  const startIndexRef = useRef(index);
  const gestureModeRef = useRef<"drag" | "swipe" | null>(null);
  const hasHiddenRef = useRef(false);
  const isDragging = activeDragId === card;

  useEffect(() => {
    indexRef.current = index;
    cardCountRef.current = cardCount;
    onMoveRef.current = onMove;
    onHideRef.current = onHide;
    onDropRef.current = onDrop;
    onDragStartRef.current = onDragStart;
  }, [cardCount, index, onDragStart, onDrop, onHide, onMove]);

  useEffect(() => {
    if (isDragging) {
      return;
    }

    Animated.timing(top, {
      toValue: index * OVERVIEW_REORDER_ROW_HEIGHT,
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

  useEffect(() => {
    if (externalSwipeX === undefined) {
      return;
    }

    translateX.setValue(Math.min(0, externalSwipeX));
  }, [externalSwipeX, translateX]);

  const hideCard = () => {
    hasHiddenRef.current = true;
    Animated.timing(translateX, {
      toValue: -SWIPE_HIDE_DISTANCE,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onHideRef.current(card);
      }
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > MOVE_CANCEL_DISTANCE ||
          Math.abs(gestureState.dy) > MOVE_CANCEL_DISTANCE,
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > MOVE_CANCEL_DISTANCE ||
          Math.abs(gestureState.dy) > MOVE_CANCEL_DISTANCE,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          hasHiddenRef.current = false;
          gestureModeRef.current = null;
          startIndexRef.current = indexRef.current;
          top.stopAnimation();
          translateX.stopAnimation();
          top.setValue(indexRef.current * OVERVIEW_REORDER_ROW_HEIGHT);
          translateX.setValue(0);
          onDragStartRef.current(card);
        },
        onPanResponderMove: (_, gestureState) => {
          if (!gestureModeRef.current) {
            if (
              gestureState.dx < 0 &&
              Math.abs(gestureState.dx) > 10 &&
              Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
            ) {
              gestureModeRef.current = "swipe";
            } else if (
              Math.abs(gestureState.dy) > MOVE_CANCEL_DISTANCE &&
              Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
            ) {
              gestureModeRef.current = "drag";
            } else {
              return;
            }
          }

          if (gestureModeRef.current === "swipe") {
            translateX.setValue(Math.min(0, gestureState.dx));
            return;
          }

          const startIndex = startIndexRef.current;
          const minTop = -REORDER_OVERSHOOT;
          const maxTop =
            (cardCountRef.current - 1) * OVERVIEW_REORDER_ROW_HEIGHT +
            REORDER_OVERSHOOT;
          const draggedTop = Math.min(
            Math.max(startIndex * OVERVIEW_REORDER_ROW_HEIGHT + gestureState.dy, minTop),
            maxTop
          );
          top.setValue(draggedTop);
          onMoveRef.current(card, draggedTop);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureModeRef.current === "swipe") {
            if (gestureState.dx <= -SWIPE_HIDE_THRESHOLD) {
              hideCard();
              return;
            }

            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
            return;
          }

          onDropRef.current();
        },
        onPanResponderTerminate: () => {
          if (hasHiddenRef.current) {
            return;
          }

          if (gestureModeRef.current === "swipe") {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
            return;
          }

          onDropRef.current();
        },
      }),
    [card, top, translateX]
  );

  return (
    <Animated.View
      style={[
        themedStyles.reorderRowWrap,
        {
          top,
          zIndex: isDragging ? 4 : 1,
          elevation: isDragging ? 8 : 1,
        },
      ]}
    >
      <View pointerEvents="none" style={themedStyles.removeAction}>
        <Ionicons name="eye-off-outline" size={18} color={colors.white} />
        <Text style={themedStyles.removeActionText}>HIDE</Text>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          themedStyles.reorderRow,
          { transform: [{ translateX }] },
        ]}
      >
        <View style={themedStyles.reorderIndex}>
          <Text style={themedStyles.reorderIndexText}>{index + 1}</Text>
        </View>
        <Text numberOfLines={1} style={themedStyles.reorderLabel}>
          {OVERVIEW_CARD_LABELS[card]}
        </Text>
        <Ionicons name="reorder-three-outline" size={26} color={colors.textMuted} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sourceCardHidden: {
    opacity: 0,
  },
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    cardSurface: {
      backgroundColor: colors.panel,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reorderRowWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      height: OVERVIEW_REORDER_ROW_HEIGHT - 8,
      borderRadius: radii.md,
      overflow: "hidden",
    },
    removeAction: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: 108,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    removeActionText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.6,
    },
    reorderRow: {
      height: "100%",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.backgroundAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
    },
    reorderIndex: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
    },
    reorderIndexText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "800",
    },
    reorderLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
    },
  });
