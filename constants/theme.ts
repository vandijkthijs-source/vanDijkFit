import { useAppStore } from "../store/useAppStore";

export const darkColors = {
  background: "#20262e",
  backgroundAlt: "#262e37",
  panel: "#2c3540",
  panelMuted: "#364150",
  panelStrong: "#1b222a",
  border: "#3b4654",
  text: "#f5f7fb",
  textMuted: "#aeb9c8",
  textSoft: "#7f8c9c",
  accent: "#4da4ff",
  accentSoft: "#243d56",
  success: "#77d19b",
  danger: "#ff6f7d",
  warning: "#ffc76c",
  input: "#404b58",
  white: "#ffffff",
  ripple: "rgba(255,255,255,0.18)",
};

export type ThemeColors = typeof darkColors;

export const lightColors: ThemeColors = {
  background: "#F7F8FA",
  backgroundAlt: "#EEF3F7",
  panel: "#FFFFFF",
  panelMuted: "#E8EEF5",
  panelStrong: "#FFFFFF",
  border: "#E1E6EE",
  text: "#1D2433",
  textMuted: "#687386",
  textSoft: "#9AA3AF",
  accent: "#1F8FFF",
  accentSoft: "#E5F1FF",
  success: "#20A86B",
  danger: "#E8314A",
  warning: "#F59E0B",
  input: "#F1F5F9",
  white: "#ffffff",
  ripple: "rgba(31,143,255,0.14)",
};

export const colors = darkColors;

export const useThemeColors = () =>
  useAppStore((state) => (state.darkMode ? darkColors : lightColors));

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999,
};

export const Colors = {
  light: {
    text: lightColors.text,
    background: lightColors.background,
    tint: colors.accent,
    icon: lightColors.textSoft,
    tabIconDefault: lightColors.textSoft,
    tabIconSelected: colors.accent,
  },
  dark: {
    text: colors.text,
    background: colors.background,
    tint: colors.accent,
    icon: colors.textSoft,
    tabIconDefault: colors.textSoft,
    tabIconSelected: colors.accent,
  },
};

export const Fonts = {
  rounded: undefined,
  mono: undefined,
};
