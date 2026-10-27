import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { createReorderPan } from "../../features/reorder/native-gesture";
import { ReorderTouchContext } from "./ReorderControls";
import { useIsFocused } from "@react-navigation/native";
import { ReactNode, RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, BackHandler, GestureResponderEvent, PanResponder, Platform, PointerEvent, ScrollView, View } from 'react-native';
import { foldedDragLayout, insertionOrder, moveId, reconcileOrder, slots } from '../../features/reorder/order';
export type ReorderScroll = {
  gesture: ReturnType<typeof Gesture.Native>;
  ref: RefObject<ScrollView | null>;
  offset: RefObject<number>;
  viewport: RefObject<{
    top: number;
    height: number;
  }>;
  setDragging: (dragging: boolean) => void;
};
type Props = {
  ids: string[];
  label: (id: string) => string;
  renderItem: (id: string, isDragging: boolean, isReordering: boolean) => ReactNode;
  onCommit: (ids: string[]) => void;
  scroll: ReorderScroll;
  gap: number;
  onSwipeLeft?: (id: string) => void;
  disabled?: boolean;
  foldDuringDrag?: boolean;
};

/** Rows keep their React keys and mounted contents throughout the gesture. */
export default function ReorderList(props: Props) {
  const focused = useIsFocused();
  const orderKey = props.ids.join("|");
  const stopRef = useRef<(commit: boolean) => void>(() => {});
  const touch = useRef({
    x: 0,
    y: 0
  });
  const latest = useRef(props);
  latest.current = props;
  const heights = useRef<Record<string, number>>({});
  const values = useRef<Record<string, Animated.Value>>({});
  const [foldLayout, setFoldLayout] = useState({ paddingTop: 0, minHeight: 0 });
  const listTop = useRef(0);
  const restoreScroll = useRef<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const reduced = useRef(false);
  const state = useRef<{
    id: string;
    ids: string[];
    sourceKey: string;
    sourceIds: string[];
    expandedHeights: Record<string, number>;
    measuring: boolean;
    measured: Set<string>;
    paddingTop: number;
    folded: boolean;
    origin: Record<string, number>;
    startY: number;
    finger: number;
    startFinger: number;
    startScroll: number;
    top: number;
  } | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const landing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFrame = useRef(0);
  const frame = useRef<number | null>(null);
  const finishing = useRef(false);
  const clearTimer = () => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
  };
  const value = (id: string) => values.current[id] ?? (values.current[id] = new Animated.Value(0));
  const animate = (id: string, y: number) => {
    value(id).stopAnimation();
    Animated.timing(value(id), {
      toValue: y,
      duration: reduced.current ? 0 : 160,
      useNativeDriver: true
    }).start();
  };
  const paint = () => {
    const s = state.current;
    if (!s || finishing.current || s.measuring) return;
    s.top = s.startY + s.finger - s.startFinger + latest.current.scroll.offset.current - s.startScroll;
    const next = insertionOrder(s.ids, s.id, s.top - s.paddingTop, heights.current);
    if (next.some((id, i) => id !== s.ids[i])) {
      s.ids = next;
      const positions = slots(next, heights.current);
      next.forEach(id => {
        if (id !== s.id) animate(id, positions[id] + s.paddingTop - s.origin[id]);
      });
      AccessibilityInfo.announceForAccessibility(`${latest.current.label(s.id)}, ${next.indexOf(s.id) + 1} of ${next.length}`);
    }
    value(s.id).setValue(s.top - s.origin[s.id]);
  };
  const stop = (commit: boolean) => {
    if (finishing.current) return;
    clearTimer();
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const s = state.current;
    if (!s || finishing.current) return;
    finishing.current = true;
    const target = commit ? slots(s.ids, heights.current) : s.origin;
    if (!s.measuring) s.ids.forEach(id => animate(id, target[id] + (commit ? s.paddingTop : 0) - s.origin[id]));
    // Commit after landing, once, using current store data rather than captured objects.
    landing.current = setTimeout(() => {
      const next = reconcileOrder(s.ids, latest.current.ids);
      if (s.folded) {
        const finalIds = commit ? next : latest.current.ids;
        const expanded = slots(finalIds, s.expandedHeights);
        const compact = commit ? (slots(s.ids, heights.current)[s.id] + s.paddingTop) : s.origin[s.id];
        if (expanded[s.id] !== undefined) {
          restoreScroll.current = s.measuring ? s.startScroll : Math.max(0,
            latest.current.scroll.offset.current + expanded[s.id] - compact);
        }
      }
      state.current = null;
      finishing.current = false;
      landing.current = null;
      setFoldLayout({ paddingTop: 0, minHeight: 0 });
      if (commit && next.some((id, index) => id !== latest.current.ids[index])) latest.current.onCommit(next);
      Object.values(values.current).forEach(v => {
        v.stopAnimation();
        v.setValue(0);
      });
      latest.current.scroll.setDragging(false);
      setActiveId(null);
    }, reduced.current || s.measuring ? 0 : 170);
  };
  stopRef.current = stop;
  const tick = (time: number) => {
    const elapsed = lastFrame.current ? Math.min(32, time - lastFrame.current) : 16;
    lastFrame.current = time;
    const s = state.current;
    if (!s || finishing.current) return;
    const {
      viewport,
      offset,
      ref
    } = latest.current.scroll;
    const {
      top,
      height
    } = viewport.current;
    const zone = Math.min(80, height / 4);
    const local = s.finger - top;
    const speed = s.measuring ? 0 : local < zone ? -Math.min(1, (zone - local) / zone) : local > height - zone ? Math.min(1, (local - height + zone) / zone) : 0;
    if (speed && height > 0) {
      const compactBottom = listTop.current + s.paddingTop + s.ids.reduce((total, id) => total + heights.current[id], 0);
      const maxOffset = s.folded ? Math.max(offset.current, compactBottom - height + zone) : Infinity;
      ref.current?.scrollTo({
        y: Math.max(0, Math.min(maxOffset, offset.current + speed * Math.abs(speed) * elapsed * 0.75)),
        animated: false,
      });
    }
    paint();
    frame.current = requestAnimationFrame(tick);
  };
  const begin = (id: string, y: number) => {
    if (latest.current.disabled || state.current || latest.current.ids.some(key => !heights.current[key])) return false;
    const ids = [...latest.current.ids];
    const origin = slots(ids, heights.current);
    state.current = {
      id,
      ids,
      sourceKey: ids.join("|"),
      sourceIds: ids,
      expandedHeights: { ...heights.current },
      measuring: !!latest.current.foldDuringDrag,
      measured: new Set(),
      paddingTop: 0,
      folded: !!latest.current.foldDuringDrag,
      origin,
      startY: origin[id],
      top: origin[id],
      startFinger: y,
      finger: y,
      startScroll: latest.current.scroll.offset.current
    };
    if (latest.current.foldDuringDrag) {
      // Preserve the old scroll range until the compact row measurements arrive.
      setFoldLayout({ paddingTop: 0, minHeight: ids.reduce((sum, key) => sum + heights.current[key], 0) + latest.current.scroll.viewport.current.height });
    }
    lastFrame.current = 0;
    latest.current.scroll.setDragging(true);
    setActiveId(id);
    frame.current = requestAnimationFrame(tick);
    AccessibilityInfo.announceForAccessibility(`${latest.current.label(id)} picked up. Move up or down; Escape cancels.`);
    return true;
  };
  useLayoutEffect(() => {
    if (activeId === null && restoreScroll.current !== null) {
      const offset = restoreScroll.current;
      restoreScroll.current = null;
      latest.current.scroll.offset.current = offset;
      latest.current.scroll.ref.current?.scrollTo({ y: offset, animated: false });
    }
  }, [activeId, orderKey]);
  useLayoutEffect(() => {
    if (!state.current) Object.values(values.current).forEach(v => v.setValue(0));
  }, [orderKey]);
  useEffect(() => {
    const animatedValues = values.current;
    AccessibilityInfo.isReduceMotionEnabled().then(v => {
      reduced.current = v;
    });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', v => {
      reduced.current = v;
    });
    const app = AppState.addEventListener('change', status => {
      if (status !== 'active') stopRef.current(false);
    });
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!state.current) return false;
      stopRef.current(false);
      return true;
    });
    return () => {
      clearTimer();
      if (landing.current) clearTimeout(landing.current);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      Object.values(animatedValues).forEach(v => v.stopAnimation());
      state.current = null;
      latest.current.scroll.setDragging(false);
      motion.remove();
      app.remove();
      back.remove();
    };
  }, []);
  useEffect(() => {
    if (latest.current.disabled || state.current && orderKey !== state.current.sourceKey) stopRef.current(false);
  }, [props.disabled, orderKey]);
  useEffect(() => {
    if (!focused) stopRef.current(false);
  }, [focused]);
  const action = (id: string, delta: number) => {
    if (latest.current.disabled || state.current) return;
    const ids = latest.current.ids;
    const index = ids.indexOf(id);
    latest.current.onCommit(moveId(ids, id, index + delta));
    AccessibilityInfo.announceForAccessibility(`${latest.current.label(id)}, ${Math.max(1, Math.min(ids.length, index + delta + 1))} of ${ids.length}`);
  };
  const measureRow = (id: string, height: number) => {
    const previous = heights.current[id];
    const drag = state.current;
    heights.current[id] = height;
    if (drag?.measuring && !finishing.current) {
      if (Math.abs(height - drag.expandedHeights[id]) > 1) drag.measured.add(id);
      if (drag.measured.size === drag.sourceIds.length) {
        const layout = foldedDragLayout(drag.sourceIds, heights.current, drag.id,
          drag.startY + drag.finger - drag.startFinger, drag.startScroll);
        drag.origin = layout.origin;
        drag.paddingTop = layout.paddingTop;
        drag.startY = layout.origin[drag.id];
        drag.top = drag.startY;
        drag.startFinger = drag.finger;
        drag.startScroll = layout.scrollOffset;
        drag.measuring = false;
        drag.sourceIds.forEach(key => { value(key).stopAnimation(); value(key).setValue(0); });
        setFoldLayout({ paddingTop: layout.paddingTop, minHeight: 0 });
        latest.current.scroll.offset.current = layout.scrollOffset;
        latest.current.scroll.ref.current?.scrollTo({ y: layout.scrollOffset, animated: false });
      }
      return;
    }
    if (previous && Math.abs(previous - height) > 1 && drag && !finishing.current) stop(false);
  };
  return <View onLayout={event => { listTop.current = event.nativeEvent.layout.y; }} style={{
    paddingTop: foldLayout.paddingTop,
    minHeight: foldLayout.minHeight,
    paddingBottom: activeId !== null && props.foldDuringDrag ? props.scroll.viewport.current.height : 0,
  }}>{props.ids.map(id => <ReorderItem key={id} id={id} active={activeId === id} disabled={!!props.disabled} scrollGesture={props.scroll.gesture} onPickUp={y => begin(id, y)} onNativeMove={y => { if (state.current?.id === id) { state.current.finger = y; paint(); } }} label={props.label(id)} translateY={value(id)} gap={props.gap} onHeight={height => measureRow(id, height)} onStart={event => {
      if ((event.nativeEvent.touches?.length ?? 1) > 1) {
        stop(false);
        return;
      }
      if (props.disabled || props.ids.length < 2 || state.current) return;
      clearTimer();
      const {
        pageY,
        pageX
      } = event.nativeEvent;
      touch.current = {
        x: pageX,
        y: pageY
      };
      pending.current = setTimeout(() => {
        pending.current = null;
        begin(id, pageY);
      }, 350);
    }} onMove={event => {
      const e = event.nativeEvent;
      if ((e.touches?.length ?? 1) > 1) {
        stop(false);
        return;
      }
      if (state.current?.id === id) {
        if (Platform.OS === 'web') event.preventDefault();
        state.current.finger = e.pageY;
        paint();
      } else if (!state.current && Math.hypot(e.pageX - touch.current.x, e.pageY - touch.current.y) > 8) clearTimer();
    }} onEnd={() => {
      if (finishing.current) return;
      clearTimer();
      if (state.current?.id === id) stop(true);
    }} onCancel={() => stop(false)} isActive={() => state.current?.id === id} onSwipeLeft={props.onSwipeLeft ? () => props.onSwipeLeft?.(id) : undefined} onAction={delta => action(id, delta)}>{props.renderItem(id, activeId === id, activeId !== null)}</ReorderItem>)}</View>;
}
type ItemProps = {
  id: string;
  active: boolean;
  disabled: boolean;
  scrollGesture: ReturnType<typeof Gesture.Native>;
  onPickUp: (y: number) => boolean;
  onNativeMove: (y: number) => void;
  label: string;
  translateY: Animated.Value;
  gap: number;
  children: ReactNode;
  onHeight: (height: number) => void;
  onStart: (e: GestureResponderEvent) => void;
  onMove: (e: GestureResponderEvent) => void;
  onEnd: () => void;
  onCancel: () => void;
  isActive: () => boolean;
  onAction: (delta: number) => void;
  onSwipeLeft?: () => void;
};
function ReorderItem(props: ItemProps) {
  const [blocked, setBlocked] = useState(false);
  const pointer = useRef<{ element: { setPointerCapture?: (id: number) => void }; id: number } | null>(null);
  const eligible = useRef(false);
  const swiping = useRef(false);
  const swipeX = useRef(new Animated.Value(0)).current;
  const start = (e: GestureResponderEvent) => {
    eligible.current = true;
    latest.current.onStart(e);
  };
  const end = () => {
    eligible.current = false;
    latest.current.onEnd();
  };
  const cancel = () => {
    eligible.current = false;
    swiping.current = false;
    swipeX.setValue(0);
    latest.current.onCancel();
  };
  const latest = useRef(props);
  latest.current = props;
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, g) => (Platform.OS === "web" && latest.current.isActive()) || eligible.current && !latest.current.disabled && !!latest.current.onSwipeLeft && g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy),
    onMoveShouldSetPanResponder: () => Platform.OS === "web" && latest.current.isActive(),
    onPanResponderGrant: () => {
      if (!latest.current.isActive()) {
        swiping.current = true;
        latest.current.onCancel();
      }
    },
    onPanResponderMove: (e, g) => {
      if (swiping.current) swipeX.setValue(Math.min(0, g.dx));else latest.current.onMove(e);
    },
    onPanResponderRelease: (_, g) => {
      eligible.current = false;
      if (swiping.current) {
        swiping.current = false;
        swipeX.setValue(0);
        if (g.dx < -72) latest.current.onSwipeLeft?.();
      } else latest.current.onEnd();
    },
    onPanResponderTerminate: cancel,
    onPanResponderTerminationRequest: () => !latest.current.isActive()
  })).current;
  const pan = useMemo(() => createReorderPan({
    enabled: !props.disabled && !blocked,
    scrollGesture: props.scrollGesture,
    pickUp: y => latest.current.onPickUp(y),
    move: y => latest.current.onNativeMove(y),
    drop: () => latest.current.onEnd(),
    cancel: () => latest.current.onCancel(),
  }), [props.disabled, props.scrollGesture, blocked]);
  const touchContext = useMemo(() => ({
    block: () => {
      eligible.current = false;
      latest.current.onCancel();
      setBlocked(true);
    },
    release: () => setBlocked(false),
    isDragging: () => latest.current.isActive(),
  }), []);
  useEffect(() => {
    if (Platform.OS === "web" && props.active && pointer.current) {
      pointer.current.element.setPointerCapture?.(pointer.current.id);
    }
  }, [props.active]);
  const nativeTouches = {
    // Keep the existing horizontal hide gesture, independently of native drag.
    onTouchStart: () => { eligible.current = true; },
    onTouchEnd: () => { eligible.current = false; },
    onTouchCancel: () => { eligible.current = false; },
  };
  type MousePointer = PointerEvent;
  const webKeys = Platform.OS === 'web' ? {
    onPointerDown: (e: MousePointer) => {
      if (e.nativeEvent.pointerType === 'mouse') {
        pointer.current = { element: e.currentTarget as unknown as { setPointerCapture?: (id: number) => void }, id: e.nativeEvent.pointerId };
        start(e as unknown as GestureResponderEvent);
      }
    },
    onPointerMove: (e: MousePointer) => {
      if (e.nativeEvent.pointerType === 'mouse') props.onMove(e as unknown as GestureResponderEvent);
    },
    onPointerUp: (e: MousePointer) => {
      if (e.nativeEvent.pointerType === 'mouse') end();
    },
    onPointerCancel: cancel,
    onKeyDown: (e: {
      key: string;
      altKey: boolean;
      target: unknown;
      currentTarget: unknown;
      preventDefault: () => void;
    }) => {
      if (e.key === 'Escape') {
        props.onCancel();
        e.preventDefault();
      }
      if (e.target === e.currentTarget && e.altKey && ['ArrowUp', 'ArrowDown'].includes(e.key)) {
        props.onAction(e.key === 'ArrowUp' ? -1 : 1);
        e.preventDefault();
      }
    }
  } : {};
  const row = <Animated.View testID={`reorder-${props.id}`} {...webKeys} {...responder.panHandlers} onLayout={e => props.onHeight(e.nativeEvent.layout.height)} {...(Platform.OS === "web" ? { onTouchStart: start, onTouchMove: props.onMove, onTouchEnd: end, onTouchCancel: cancel } : nativeTouches)} tabIndex={props.disabled ? -1 : 0} style={{
    paddingBottom: props.gap,
    transform: [{
      translateY: props.translateY
    }, {
      translateX: swipeX
    }],
    zIndex: props.active ? 100 : 0,
    elevation: props.active ? 8 : 0,
    shadowColor: '#000',
    shadowOpacity: props.active ? 0.2 : 0,
    shadowRadius: 8
  }}>
    {!props.disabled && <View accessible accessibilityLabel={`Move ${props.label}`} accessibilityHint="Use move up or move down actions." accessibilityActions={props.disabled ? [] : [{
      name: 'moveUp',
      label: 'Eén plaats omhoog'
    }, {
      name: 'moveDown',
      label: 'Eén plaats omlaag'
    }, ...(props.onSwipeLeft ? [{
      name: 'hide',
      label: 'Hide card'
    }] : [])]} onAccessibilityAction={e => {
      if (e.nativeEvent.actionName === 'hide') props.onSwipeLeft?.();else props.onAction(e.nativeEvent.actionName === 'moveUp' ? -1 : 1);
    }} style={{
      position: 'absolute',
      width: 1,
      height: 1
    }} />}
    <ReorderTouchContext.Provider value={touchContext}>{props.children}</ReorderTouchContext.Provider>
  </Animated.View>;
  return Platform.OS === "web" ? row : <GestureDetector gesture={pan}>{row}</GestureDetector>;
}
