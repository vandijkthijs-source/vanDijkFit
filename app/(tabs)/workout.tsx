import WorkoutStartScreen from "../workout/start";
import ActiveWorkoutScreen from "../workout/active";
import { useLocalSearchParams } from "expo-router";
import { useAppStore } from "../../store/useAppStore";

export default function WorkoutTabScreen() {
  const { resumeWorkout } = useLocalSearchParams<{ resumeWorkout?: string }>();
  const activeWorkout = useAppStore((state) => state.activeWorkout);

  if (activeWorkout) {
    return <ActiveWorkoutScreen resumeAnimationKey={resumeWorkout} />;
  }

  return <WorkoutStartScreen />;
}
