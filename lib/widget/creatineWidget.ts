import { NativeModules, Platform } from "react-native";
import { calculateCreatineSaturation } from "../../features/creatine/creatine-saturation";

type CreatineWidgetModuleShape = {
  setWidgetData(payloadJson: string): Promise<boolean>;
};

const CreatineWidgetModule = NativeModules.CreatineWidget as
  | CreatineWidgetModuleShape
  | undefined;

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const syncCreatineWidget = async (creatineLogs: Record<string, number>) => {
  if (Platform.OS !== "android" || !CreatineWidgetModule?.setWidgetData) {
    return;
  }

  const todayKey = getLocalDateKey();
  const gramsToday = creatineLogs[todayKey] ?? 0;
  const saturation = calculateCreatineSaturation(creatineLogs, todayKey);
  const payload = {
    saturation,
    gramsToday,
    logs: creatineLogs,
    status: gramsToday > 0 ? `${gramsToday}g today` : "Not logged",
  };

  await CreatineWidgetModule.setWidgetData(JSON.stringify(payload));
};
