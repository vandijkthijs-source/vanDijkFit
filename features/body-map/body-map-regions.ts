export type BodyMapRegion = {
  muscle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
  rotate?: string;
};

export const FRONT_BODY_REGIONS: BodyMapRegion[] = [
  { muscle: "upper_chest", x: 23, y: 14, width: 21, height: 9, borderRadius: 10 },
  { muscle: "upper_chest", x: 56, y: 14, width: 21, height: 9, borderRadius: 10 },
  { muscle: "chest", x: 22, y: 21, width: 22, height: 10, borderRadius: 10 },
  { muscle: "chest", x: 56, y: 21, width: 22, height: 10, borderRadius: 10 },
  { muscle: "front_delts", x: 13, y: 13, width: 15, height: 11, borderRadius: 14 },
  { muscle: "front_delts", x: 72, y: 13, width: 15, height: 11, borderRadius: 14 },
  { muscle: "side_delts", x: 10, y: 18, width: 13, height: 12, borderRadius: 14 },
  { muscle: "side_delts", x: 77, y: 18, width: 13, height: 12, borderRadius: 14 },
  { muscle: "biceps", x: 8, y: 27, width: 10, height: 14, borderRadius: 12, rotate: "12deg" },
  { muscle: "biceps", x: 82, y: 27, width: 10, height: 14, borderRadius: 12, rotate: "-12deg" },
  { muscle: "forearms", x: 5, y: 39, width: 10, height: 17, borderRadius: 12, rotate: "8deg" },
  { muscle: "forearms", x: 85, y: 39, width: 10, height: 17, borderRadius: 12, rotate: "-8deg" },
  { muscle: "abs", x: 39, y: 27, width: 22, height: 20, borderRadius: 10 },
  { muscle: "quads", x: 28, y: 52, width: 17, height: 24, borderRadius: 12, rotate: "3deg" },
  { muscle: "quads", x: 56, y: 52, width: 17, height: 24, borderRadius: 12, rotate: "-3deg" },
  { muscle: "calves", x: 30, y: 77, width: 13, height: 17, borderRadius: 12 },
  { muscle: "calves", x: 58, y: 77, width: 13, height: 17, borderRadius: 12 },
];

export const BACK_BODY_REGIONS: BodyMapRegion[] = [
  { muscle: "traps", x: 34, y: 12, width: 32, height: 10, borderRadius: 10 },
  { muscle: "rear_delts", x: 13, y: 15, width: 15, height: 12, borderRadius: 14 },
  { muscle: "rear_delts", x: 72, y: 15, width: 15, height: 12, borderRadius: 14 },
  { muscle: "triceps", x: 10, y: 26, width: 11, height: 17, borderRadius: 12, rotate: "10deg" },
  { muscle: "triceps", x: 79, y: 26, width: 11, height: 17, borderRadius: 12, rotate: "-10deg" },
  { muscle: "forearms", x: 7, y: 42, width: 10, height: 17, borderRadius: 12, rotate: "8deg" },
  { muscle: "forearms", x: 84, y: 42, width: 10, height: 17, borderRadius: 12, rotate: "-8deg" },
  { muscle: "upper_back", x: 26, y: 22, width: 48, height: 14, borderRadius: 12 },
  { muscle: "lats", x: 22, y: 30, width: 20, height: 21, borderRadius: 14, rotate: "6deg" },
  { muscle: "lats", x: 58, y: 30, width: 20, height: 21, borderRadius: 14, rotate: "-6deg" },
  { muscle: "glutes", x: 28, y: 48, width: 18, height: 12, borderRadius: 14 },
  { muscle: "glutes", x: 54, y: 48, width: 18, height: 12, borderRadius: 14 },
  { muscle: "hamstrings", x: 29, y: 60, width: 15, height: 24, borderRadius: 12, rotate: "2deg" },
  { muscle: "hamstrings", x: 56, y: 60, width: 15, height: 24, borderRadius: 12, rotate: "-2deg" },
  { muscle: "calves", x: 31, y: 82, width: 12, height: 14, borderRadius: 12 },
  { muscle: "calves", x: 58, y: 82, width: 12, height: 14, borderRadius: 12 },
];
