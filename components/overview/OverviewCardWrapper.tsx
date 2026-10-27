import { ReactNode, useMemo } from "react";
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { radii, useThemeColors } from "../../constants/theme";

type Props = ViewProps & { children: ReactNode; style?: StyleProp<ViewStyle> };
export function OverviewCardSurface({ children, style, ...props }: Props) {
  const colors = useThemeColors();
  const surface = useMemo(() => StyleSheet.create({ card: {
    backgroundColor: colors.panel, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.border,
  }}), [colors]);
  return <View {...props} style={[surface.card, style]}>{children}</View>;
}
