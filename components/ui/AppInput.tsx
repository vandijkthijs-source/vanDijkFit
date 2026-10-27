import { ReorderTextInput } from "./ReorderControls";
import { forwardRef, useMemo } from "react";
import { StyleSheet, TextInput, TextInputProps } from "react-native";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";

const AppInput = forwardRef<TextInput, TextInputProps>(function AppInput(props, ref) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ReorderTextInput onTouchStart={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
      ref={ref}
      placeholderTextColor={props.placeholderTextColor ?? colors.textSoft}
      {...props}
      style={[styles.input, props.style]}
    />
  );
});

export default AppInput;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.input,
    fontSize: 16,
    color: colors.text,
  },
});
