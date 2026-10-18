import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { pickImageFromLibrary } from "../../lib/expo/image-picker";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";

type Props = {
  imageUri?: string;
  onChange: (uri: string | null) => void;
};

export default function ExercisePhotoPicker({ imageUri, onChange }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePick = async () => {
    const uri = await pickImageFromLibrary();
    if (uri) onChange(uri);
  };

  return (
    <View style={styles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="images-outline" size={28} color={colors.accent} />
          <Text style={styles.placeholderTitle}>Gallery Photo</Text>
          <Text style={styles.placeholderText}>
            Pick from Samsung Gallery or any photo provider exposed to Android.
          </Text>
        </View>
      )}

      <Pressable
        onPress={handlePick}
        android_ripple={{ color: colors.ripple }}
        style={({ pressed }) => [styles.button, pressed && styles.glowPressed]}
      >
        <Ionicons name="image-outline" size={18} color={colors.white} />
        <Text style={styles.buttonText}>
          {imageUri ? "Change Photo" : "Choose Photo"}
        </Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    gap: 12,
  },
  image: {
    width: "100%",
    height: 220,
    borderRadius: radii.lg,
  },
  placeholder: {
    height: 220,
    borderRadius: radii.lg,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 10,
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 250,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  glowPressed: {
    opacity: 0.96,
    shadowColor: colors.accent,
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
