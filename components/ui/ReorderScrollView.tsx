import { forwardRef } from "react";
import { Platform, ScrollView, ScrollViewProps } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

/** The scroll recognizer waits until a pending row drag has failed. */
export const ReorderScrollView = forwardRef<ScrollView, ScrollViewProps & {
  nativeGesture: ReturnType<typeof Gesture.Native>;
}>(function ReorderScrollView({ nativeGesture, ...props }, ref) {
  const scroll = <ScrollView {...props} ref={ref} />;
  return Platform.OS === "web" ? scroll : <GestureDetector gesture={nativeGesture}>{scroll}</GestureDetector>;
});
