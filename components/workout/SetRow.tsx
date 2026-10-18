import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeColors, useThemeColors } from "../../constants/theme";

type Props = {
  setNumber: number;
  previous?: {
    weight: number | null;
    reps: number | null;
  };
  weight: number | null;
  reps: number | null;
  completed: boolean;
  onChangeWeight: (value: string) => void;
  onChangeReps: (value: string) => void;
  onComplete: () => void;
};

type NumberFieldProps = {
  value: number | null;
  placeholder?: string;
  completed: boolean;
  inputBackgroundColor: Animated.AnimatedInterpolation<string | number>;
  inputBorderColor: Animated.AnimatedInterpolation<string | number>;
  completionBackgroundColor: Animated.AnimatedInterpolation<string | number>;
  completionBorderColor: Animated.AnimatedInterpolation<string | number>;
  onChangeValue: (value: string) => void;
};

const formatPrevious = (previous?: { weight: number | null; reps: number | null }) => {
  if (!previous) return "-";
  if (previous.weight == null && previous.reps == null) return "-";
  const weightLabel = previous.weight == null ? "-" : `${previous.weight}kg`;
  const repsLabel = previous.reps == null ? "-" : `${previous.reps}`;
  return `${weightLabel} x${repsLabel}`;
};

function NumberField({
  value,
  placeholder = "0",
  completed,
  inputBackgroundColor,
  inputBorderColor,
  completionBackgroundColor,
  completionBorderColor,
  onChangeValue,
}: NumberFieldProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [draftValue, setDraftValue] = useState(value?.toString() ?? "");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraftValue(value?.toString() ?? "");
    }
  }, [isEditing, value]);

  useEffect(() => {
    if (completed) {
      setIsEditing(false);
    }
  }, [completed]);

  const handleChange = (nextValue: string) => {
    if (completed) {
      return;
    }

    const cleanValue = nextValue.replace(/[^\d.]/g, "");
    setDraftValue(cleanValue);
    onChangeValue(cleanValue);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (draftValue === "") {
      onChangeValue("");
    }
  };

  return (
    <Animated.View
      style={[
        styles.inputWrap,
        isEditing && !completed && styles.inputWrapActive,
        {
          backgroundColor: completed ? completionBackgroundColor : inputBackgroundColor,
          borderColor: completed ? completionBorderColor : inputBorderColor,
        },
      ]}
    >
      <TextInput
        value={draftValue}
        onChangeText={handleChange}
        onFocus={() => {
          if (!completed) {
            setIsEditing(true);
          }
        }}
        onBlur={handleBlur}
        editable={!completed}
        keyboardType="number-pad"
        selectTextOnFocus
        contextMenuHidden
        selectionColor={colors.accent}
        placeholder={placeholder}
        placeholderTextColor="#9aa7b8"
        style={[styles.inputText, isEditing && styles.inputTextActive]}
      />
    </Animated.View>
  );
}

export default function SetRow({
  setNumber,
  previous,
  weight,
  reps,
  completed,
  onChangeWeight,
  onChangeReps,
  onComplete,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const completeProgress = useRef(new Animated.Value(completed ? 1 : 0)).current;
  const invalidProgress = useRef(new Animated.Value(0)).current;
  const invalidTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isValidSet = reps != null && reps > 0 && (weight == null || weight >= 0);

  useEffect(() => {
    Animated.timing(completeProgress, {
      toValue: completed ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [completeProgress, completed]);

  useEffect(() => {
    const timeoutRef = invalidTimeoutRef;

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const triggerInvalidFeedback = () => {
    if (invalidTimeoutRef.current) {
      clearTimeout(invalidTimeoutRef.current);
    }

    Animated.sequence([
      Animated.timing(invalidProgress, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(invalidProgress, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleComplete = () => {
    Keyboard.dismiss();

    if (!isValidSet) {
      triggerInvalidFeedback();
      return;
    }

    onComplete();
  };

  const inputBackgroundColor = invalidProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.input, "#6a2f3a"],
  });

  const inputBorderColor = invalidProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.input, colors.danger],
  });

  const completionBackgroundColor = completeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.input, "#2f7d58"],
  });

  const completionBorderColor = completeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.input, colors.success],
  });

  const checkBackgroundColor = Animated.add(
    completeProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    invalidProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0],
    })
  ).interpolate({
    inputRange: [0, 1],
    outputRange: [colors.input, "#2f7d58"],
  });

  const checkBorderColor = invalidProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.input, colors.danger],
  });

  return (
    <View style={styles.row}>
      <Text style={styles.setNumber}>{setNumber}</Text>

      <View style={styles.previousWrap}>
        <Text style={styles.previousText} numberOfLines={1}>
          {formatPrevious(previous)}
        </Text>
      </View>

      <NumberField
        value={weight}
        completed={completed}
        inputBackgroundColor={inputBackgroundColor}
        inputBorderColor={inputBorderColor}
        completionBackgroundColor={completionBackgroundColor}
        completionBorderColor={completionBorderColor}
        onChangeValue={onChangeWeight}
      />

      <NumberField
        value={reps}
        completed={completed}
        inputBackgroundColor={inputBackgroundColor}
        inputBorderColor={inputBorderColor}
        completionBackgroundColor={completionBackgroundColor}
        completionBorderColor={completionBorderColor}
        onChangeValue={onChangeReps}
      />

      <Animated.View
        style={[
          styles.checkWrap,
          {
            backgroundColor: completed ? checkBackgroundColor : inputBackgroundColor,
            borderColor: completed ? completionBorderColor : checkBorderColor,
          },
        ]}
      >
        <Pressable
          onPress={handleComplete}
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [styles.checkButton, pressed && styles.glowPressed]}
        >
          <Ionicons
            name="checkmark"
            size={22}
            color={completed ? "#eaf2fe" : "#8f9caf"}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  setNumber: {
    width: 32,
    color: colors.text,
    fontSize: 16,
    textAlign: "center",
  },
  previousText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    width: "100%",
  },
  previousWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  inputWrap: {
    width: 72,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    marginLeft: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrapActive: {
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    shadowColor: colors.accent,
    shadowOpacity: 0.52,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  inputText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 8,
    width: "100%",
    fontVariant: ["tabular-nums"],
    paddingVertical: 0,
  },
  inputTextActive: {
    color: colors.white,
    fontWeight: "700",
  },
  checkWrap: {
    width: 46,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    overflow: "visible",
    marginLeft: 6,
    backgroundColor: colors.input,
  },
  checkButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 1,
    borderRadius: 11,
    overflow: "hidden",
  },
  glowPressed: {
    opacity: 0.96,
    shadowColor: colors.accent,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});
