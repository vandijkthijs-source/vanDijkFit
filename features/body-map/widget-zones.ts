import { MuscleGroup } from "../exercises/exercise.types";

export interface BodyHeatmapWidgetZone {
  key: string;
  muscles: MuscleGroup[];
}

export const BODY_HEATMAP_WIDGET_FRONT_ZONES: BodyHeatmapWidgetZone[] = [
  { key: "front_shoulders", muscles: ["front_delts", "side_delts"] },
  { key: "front_chest", muscles: ["chest"] },
  { key: "front_biceps", muscles: ["biceps"] },
  { key: "front_forearms", muscles: ["forearms"] },
  { key: "front_abs", muscles: ["abs"] },
  { key: "front_obliques", muscles: ["obliques"] },
  { key: "front_hips", muscles: ["abductors", "adductors"] },
  { key: "front_quads", muscles: ["quads"] },
  { key: "front_calves", muscles: ["calves"] },
];

export const BODY_HEATMAP_WIDGET_BACK_ZONES: BodyHeatmapWidgetZone[] = [
  { key: "back_shoulders", muscles: ["rear_delts", "side_delts", "traps"] },
  { key: "back_triceps", muscles: ["triceps"] },
  { key: "back_forearms", muscles: ["forearms"] },
  { key: "back_lats", muscles: ["lats", "traps"] },
  { key: "back_lower_back", muscles: ["lower_back"] },
  { key: "back_glutes", muscles: ["glutes"] },
  { key: "back_hamstrings", muscles: ["hamstrings"] },
  { key: "back_calves", muscles: ["calves"] },
];
