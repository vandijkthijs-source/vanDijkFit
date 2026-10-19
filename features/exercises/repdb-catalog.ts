import catalog from "../../data/repdb/catalog.json";
import { existingRepDbMatches, repDbSynonyms } from "../../data/repdb/matches";
import { EquipmentType, Exercise, MuscleGroup } from "./exercise.types";

export const REPDB_CREDIT = "Exercise data by RepDB (repdb.co)";
export const REPDB_URL = "https://repdb.co";

const muscleMap: Record<string, MuscleGroup> = {
  pectoralis_major: "chest",
  anterior_deltoid: "front_delts",
  lateral_deltoid: "side_delts",
  posterior_deltoid: "rear_delts",
  biceps_brachii: "biceps",
  brachialis: "biceps",
  brachioradialis: "forearms",
  triceps_brachii: "triceps",
  forearm_flexors: "forearms",
  forearm_extensors: "forearms",
  forearms: "forearms",
  latissimus_dorsi: "lats",
  trapezius: "traps",
  rhomboids: "upper_back",
  erector_spinae: "lower_back",
  quadratus_lumborum: "lower_back",
  rectus_abdominis: "abs",
  transverse_abdominis: "abs",
  obliques: "obliques",
  gluteus_maximus: "glutes",
  gluteus_medius: "abductors",
  abductors: "abductors",
  adductors: "adductors",
  quadriceps: "quads",
  hamstrings: "hamstrings",
  gastrocnemius: "calves",
  soleus: "calves",
  hip_flexors: "hip_flexors",
  tibialis_anterior: "tibialis",
  serratus_anterior: "serratus",
  supraspinatus: "rotator_cuff",
};

const equipmentMap: Record<string, EquipmentType> = {
  barbell: "barbell",
  ez_bar: "barbell",
  trap_bar: "barbell",
  dumbbell: "dumbbell",
  kettlebell: "kettlebell",
  cable: "cable",
  smith_machine: "smith",
  resistance_band: "band",
  loop_band: "band",
  bodyweight: "bodyweight",
  pull_up_bar: "bodyweight",
  dip_station: "bodyweight",
  flat_bench: "bodyweight",
  plyo_box: "bodyweight",
  rings: "other",
  suspension_trainer: "other",
  plates: "other",
  stability_ball: "other",
  battle_rope: "other",
  sled: "other",
  ab_wheel: "other",
  bicycle: "other",
  jump_rope: "other",
  medicine_ball: "other",
  slam_ball: "other",
  climbing_rope: "other",
  wall_ball: "other",
  wrist_roller: "other",
  air_bike: "machine",
  dip_machine: "machine",
  assisted_pullup_machine: "machine",
  leg_press: "machine",
  leg_curl: "machine",
  lat_pulldown_machine: "machine",
  hack_squat: "machine",
  treadmill: "machine",
  leg_extension: "machine",
  standing_calf_raise_machine: "machine",
  shoulder_press_machine: "machine",
  plate_loaded_lateral_raise_machine: "machine",
  chest_press_machine: "machine",
  seated_row_machine: "machine",
  elliptical: "machine",
  hip_abduction_machine: "machine",
  hip_adduction_machine: "machine",
  back_extension_machine: "machine",
  bicep_curl_machine: "machine",
  chest_fly_machine: "machine",
  preacher_curl_machine: "machine",
  reverse_fly_machine: "machine",
  ab_crunch_machine: "machine",
  tricep_extension_machine: "machine",
  glute_ham_developer: "machine",
  pec_deck: "machine",
  donkey_calf_raise_machine: "machine",
  hip_thrust_machine: "machine",
  plate_loaded_dip_machine: "machine",
  shrug_machine: "machine",
  rower: "machine",
  seated_calf_raise_machine: "machine",
  ski_erg: "machine",
  stair_climber: "machine",
  stationary_bike: "machine",
};

const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]));

export const getRepDbExercise = (exerciseId: string) => {
  const sourceId = existingRepDbMatches[exerciseId] ??
    (exerciseId.startsWith("repdb-") ? exerciseId.slice(6) : undefined);
  return sourceId ? catalogById.get(sourceId) : undefined;
};

const mapMuscles = (muscles: string[]) =>
  [...new Set(muscles.map((muscle) => {
    const mapped = muscleMap[muscle];
    if (!mapped) throw new Error(`Unmapped RepDB muscle: ${muscle}`);
    return mapped;
  }))];

export const createAdditionalRepDbExercises = (existingExercises: Exercise[]): Exercise[] => {
  const matchedIds = new Set(existingExercises.flatMap((exercise) => {
    const match = existingRepDbMatches[exercise.id];
    return match ? [match] : [];
  }));

  return catalog
    .filter((exercise) => !matchedIds.has(exercise.id) &&
      !matchedIds.has(repDbSynonyms[exercise.id]))
    .map((exercise): Exercise => {
      const equipment = equipmentMap[exercise.equipment];
      if (!equipment) throw new Error(`Unmapped RepDB equipment: ${exercise.equipment}`);
      const primary = mapMuscles(exercise.primaryMuscles);
      const secondary = mapMuscles(exercise.secondaryMuscles)
        .filter((muscle) => !primary.includes(muscle));
      // RepDB supplies muscle roles, not numeric contributions. These are app
      // defaults: split 70% across primary groups and 30% across secondary groups.
      // Merge anatomical aliases BEFORE splitting, so e.g. two calf muscles
      // don't count as two independent app muscle groups.
      const primaryShare = secondary.length > 0 ? 0.7 : 1;
      const muscleContributions = Object.fromEntries([
        ...primary.map((muscle) => [muscle, primaryShare / primary.length]),
        ...secondary.map((muscle) => [muscle, 0.3 / secondary.length]),
      ]);

      return {
        id: `repdb-${exercise.id}`,
        name: exercise.name,
        primaryMuscle: primary[0],
        secondaryMuscles: [...primary.slice(1), ...secondary],
        equipment,
        defaultRestSeconds: exercise.category === "stretching" ? 30 :
          exercise.mechanic === "compound" ? 120 : 60,
        muscleContributions,
      };
    });
};
