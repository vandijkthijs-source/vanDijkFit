import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

const EXERCISE_IMAGE_DIRECTORY = "exercise-images";

const getImageExtension = (asset: ImagePicker.ImagePickerAsset) => {
  const fileExtension = asset.fileName
    ?.split(".")
    .pop()
    ?.replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

  if (fileExtension) {
    return fileExtension;
  }

  if (asset.mimeType === "image/png") return "png";
  if (asset.mimeType === "image/webp") return "webp";
  if (asset.mimeType === "image/gif") return "gif";
  return "jpg";
};

const saveExerciseImage = async (asset: ImagePicker.ImagePickerAsset) => {
  if (!FileSystem.documentDirectory) {
    return asset.uri;
  }

  const imageDirectory = `${FileSystem.documentDirectory}${EXERCISE_IMAGE_DIRECTORY}/`;
  const imageUri = `${imageDirectory}exercise-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}.${getImageExtension(asset)}`;

  try {
    await FileSystem.makeDirectoryAsync(imageDirectory, { intermediates: true });
    await FileSystem.copyAsync({ from: asset.uri, to: imageUri });
    return imageUri;
  } catch {
    return asset.uri;
  }
};

export const pickImageFromLibrary = async (): Promise<string | null> => {
  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    const asset = result.assets[0];
    return asset ? await saveExerciseImage(asset) : null;
  } catch (error) {
    console.log("Image picker error:", error);
    return null;
  }
};
