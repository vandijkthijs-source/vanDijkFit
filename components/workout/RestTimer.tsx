import { StyleSheet, Text, View } from "react-native";

type Props = {
  remainingSeconds: number;
  isRunning: boolean;
};

const formatSeconds = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
};

export default function RestTimer({ remainingSeconds, isRunning }: Props) {
  if (!isRunning) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>REST TIMER</Text>
      <Text style={styles.time}>{formatSeconds(remainingSeconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
    backgroundColor: "#354251",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#405063",
  },
  label: {
    color: "#8dbdf5",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  time: {
    color: "#eef4fb",
    fontSize: 26,
    fontWeight: "700",
    marginTop: 4,
  },
});
