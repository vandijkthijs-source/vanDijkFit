import { createContext, forwardRef, useContext } from "react";
import {
  Pressable,
  PressableProps,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

export const ReorderTouchContext = createContext<{
  block: () => void;
  release: () => void;
  isDragging: () => boolean;
} | null>(null);

/** Actual controls reject the pending drag without blocking normal scrolling. */
export const ReorderPressable = forwardRef<View, PressableProps>(function ReorderPressable(props, ref) {
  const touch = useContext(ReorderTouchContext);
  return <Pressable {...props} ref={ref}
    onTouchStart={event => { touch?.block(); props.onTouchStart?.(event); }}
    onTouchEnd={event => { touch?.release(); props.onTouchEnd?.(event); }}
    onTouchCancel={event => { touch?.release(); props.onTouchCancel?.(event); }}
    onPointerDown={event => { touch?.block(); props.onPointerDown?.(event); }}
    onPointerUp={event => { touch?.release(); props.onPointerUp?.(event); }}
    onPointerCancel={event => { touch?.release(); props.onPointerCancel?.(event); }}
  />;
});

/** A row's primary tap action remains usable as a long-press drag surface. */
export const ReorderRowPressable = forwardRef<View, PressableProps>(function ReorderRowPressable(props, ref) {
  const touch = useContext(ReorderTouchContext);
  return <Pressable {...props} ref={ref} onPress={event => {
    if (!touch?.isDragging()) props.onPress?.(event);
  }} />;
});

export const ReorderTextInput = forwardRef<TextInput, TextInputProps>(function ReorderTextInput(props, ref) {
  const touch = useContext(ReorderTouchContext);
  return <TextInput {...props} ref={ref}
    onTouchStart={event => { touch?.block(); props.onTouchStart?.(event); }}
    onTouchEnd={event => { touch?.release(); props.onTouchEnd?.(event); }}
    onTouchCancel={event => { touch?.release(); props.onTouchCancel?.(event); }}
    onPointerDown={event => { touch?.block(); props.onPointerDown?.(event); }}
    onPointerUp={event => { touch?.release(); props.onPointerUp?.(event); }}
    onPointerCancel={event => { touch?.release(); props.onPointerCancel?.(event); }}
  />;
});
