import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { radii } from "../../constants/theme";
import { repDbImages } from "../../data/repdb/images";
import { Exercise } from "../../features/exercises/exercise.types";
import { getRepDbExercise } from "../../features/exercises/repdb-catalog";

type ImageExercise = Pick<Exercise, "id" | "name" | "imageUri">;

export default function ExerciseImages({ exercise }: { exercise: ImageExercise }) {
  const sourceExercise = getRepDbExercise(exercise.id);
  const images = exercise.imageUri
    ? [{ source: exercise.imageUri, label: "Photo" }]
    : sourceExercise ? repDbImages[sourceExercise.id] ?? [] : [];

  if (images.length === 0) return null;

  return (
    <View style={styles.gallery}>
      <View style={styles.illustrations}>
        {images.map((image) => (
          <View key={image.label} style={styles.frame}>
            <Image
              source={image.source}
              style={styles.illustration}
              contentFit="contain"
              accessibilityLabel={`${exercise.name}: ${image.label}`}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gallery: { marginBottom: 18 },
  illustrations: { flexDirection: "row", gap: 10, paddingBottom: 6 },
  frame: { flex: 1, minWidth: 0, maxWidth: 144 },
  illustration: { width: "100%", aspectRatio: 1, borderRadius: radii.md },
});
