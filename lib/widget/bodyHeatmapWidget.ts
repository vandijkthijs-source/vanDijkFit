import { NativeModules, Platform } from "react-native";
import { buildBodyHeatmapWidgetPayload } from "../../features/body-map/widget-data";
import { Exercise } from "../../features/exercises/exercise.types";
import { WorkoutSession } from "../../features/workouts/workout.types";

type BodyHeatmapWidgetModuleShape = {
  setWidgetData(payloadJson: string): Promise<boolean>;
};

const BodyHeatmapWidgetModule = NativeModules.BodyHeatmapWidget as
  | BodyHeatmapWidgetModuleShape
  | undefined;

export const syncBodyHeatmapWidget = async (
  history: WorkoutSession[],
  exercises: Exercise[]
) => {
  if (Platform.OS !== "android" || !BodyHeatmapWidgetModule?.setWidgetData) {
    return;
  }

  const payload = buildBodyHeatmapWidgetPayload(history, exercises);
  await BodyHeatmapWidgetModule.setWidgetData(JSON.stringify(payload));
};
