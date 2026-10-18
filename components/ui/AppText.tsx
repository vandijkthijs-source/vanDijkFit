import { Text, TextProps } from "react-native";

export default function AppText(props: TextProps) {
  return <Text {...props} style={[{ color: "#111827" }, props.style]} />;
}