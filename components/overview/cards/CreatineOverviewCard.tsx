import { ReorderRowPressable, ReorderPressable as Pressable } from "../../ui/ReorderControls";
import { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { calculateCreatineSaturation, CREATINE_PORTION_OPTIONS } from "../../../features/creatine/creatine-saturation";
import { radii, ThemeColors, useThemeColors } from "../../../constants/theme";
import { useAppStore } from "../../../store/useAppStore";
import InfoModal from "../../ui/InfoModal";
import { OverviewCardSurface } from "../OverviewCardWrapper";
import { getLocalDateKey, getOffsetDateKey } from "../overviewUtils";

const creatineBackfillDayOffsets = Array.from({ length: 14 }, (_, index) => index + 1);

const formatBackfillDayLabel = (offsetDays: number) => {
  if (offsetDays === 1) {
    return "Yesterday";
  }

  const date = new Date();
  date.setDate(date.getDate() - offsetDays);

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
};

export default function CreatineOverviewCard() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const creatineLogs = useAppStore((state) => state.creatineLogs);
  const setCreatineLog = useAppStore((state) => state.setCreatineLog);
  const [isBackfillOpen, setIsBackfillOpen] = useState(false);
  const [selectedBackfillDayOffset, setSelectedBackfillDayOffset] = useState(1);
  const [selectedBackfillGrams, setSelectedBackfillGrams] = useState<number | null>(
    null
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const todayDateKey = getLocalDateKey();
  const creatineGramsToday = creatineLogs[todayDateKey] ?? 0;
  const creatineSaturation = useMemo(
    () => calculateCreatineSaturation(creatineLogs, todayDateKey),
    [creatineLogs, todayDateKey]
  );
  const creatineStatus =
    creatineGramsToday > 0
      ? `${creatineGramsToday}g logged today`
      : "No portion logged today";
  const selectedBackfillDateKey = getOffsetDateKey(selectedBackfillDayOffset);
  const existingBackfillGrams = creatineLogs[selectedBackfillDateKey] ?? 0;

  const openBackfill = () => {
    const initialDayOffset = 1;
    const initialDateKey = getOffsetDateKey(initialDayOffset);

    setSelectedBackfillDayOffset(initialDayOffset);
    setSelectedBackfillGrams(creatineLogs[initialDateKey] ?? null);
    setIsBackfillOpen(true);
  };

  const selectBackfillDay = (offsetDays: number) => {
    const dateKey = getOffsetDateKey(offsetDays);

    setSelectedBackfillDayOffset(offsetDays);
    setSelectedBackfillGrams(creatineLogs[dateKey] ?? null);
  };

  return (
    <>
      <OverviewCardSurface style={styles.card}>
        <ReorderRowPressable
          onPress={openBackfill}
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [
            styles.backfillOpenArea,
            pressed && styles.buttonPressed,
          ]}
        >
          <View style={styles.topRow}>
            <View style={styles.copy}>
              <Text style={styles.label}>Creatine</Text>
              <Text style={styles.status}>{creatineStatus}</Text>
            </View>
            <View style={styles.metricRow}>
              <Pressable onTouchStart={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
                onPress={(event) => {
                  event.stopPropagation();
                  setHelpOpen(true);
                }}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.helpButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.helpText}>?</Text>
              </Pressable>
              <View style={styles.saturationBadge}>
                <Text style={styles.saturationValue}>{creatineSaturation}%</Text>
                <Text style={styles.saturationLabel}>loaded</Text>
              </View>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${creatineSaturation}%` },
              ]}
            />
          </View>
        </ReorderRowPressable>

        <View style={styles.portionRow}>
          {CREATINE_PORTION_OPTIONS.map((grams) => {
            const selected = grams === creatineGramsToday;
            const isLoadingDose = grams === 20;

            return (
              <Pressable onTouchStart={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
                key={grams}
                onPress={() => setCreatineLog(todayDateKey, selected ? null : grams)}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.portionButton,
                  selected && styles.portionButtonSelected,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.portionText,
                    selected && styles.portionTextSelected,
                  ]}
                >
                  {grams}g
                </Text>
                <Text
                  style={[
                    styles.portionSubtext,
                    selected && styles.portionTextSelected,
                  ]}
                >
                  {isLoadingDose ? "Loading" : "Dose"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </OverviewCardSurface>

      <Modal
        animationType="fade"
        transparent
        visible={isBackfillOpen}
        onRequestClose={() => setIsBackfillOpen(false)}
      >
        <View style={styles.backfillModal}>
          <Pressable onTouchStart={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
            onPress={() => setIsBackfillOpen(false)}
            style={styles.backfillBackdrop}
          />
          <View style={styles.backfillCard}>
            <Text style={styles.backfillTitle}>Add previous creatine</Text>
            <Text style={styles.backfillSubtitle}>
              {existingBackfillGrams > 0
                ? `${existingBackfillGrams}g already logged for this day`
                : "Choose the day and portion size."}
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.backfillDays}
              keyboardShouldPersistTaps="always"
            >
              {creatineBackfillDayOffsets.map((offsetDays) => {
                const selected = offsetDays === selectedBackfillDayOffset;

                return (
                  <Pressable onTouchStart={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
                    key={offsetDays}
                    onPress={() => selectBackfillDay(offsetDays)}
                    android_ripple={{ color: colors.ripple }}
                    style={({ pressed }) => [
                      styles.backfillDayButton,
                      selected && styles.backfillOptionSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.backfillDayText,
                        selected && styles.backfillOptionTextSelected,
                      ]}
                    >
                      {formatBackfillDayLabel(offsetDays)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.backfillDoseRow}>
              {CREATINE_PORTION_OPTIONS.map((grams) => {
                const selected = grams === selectedBackfillGrams;

                return (
                  <Pressable onTouchStart={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
                    key={grams}
                    onPress={() => setSelectedBackfillGrams(grams)}
                    android_ripple={{ color: colors.ripple }}
                    style={({ pressed }) => [
                      styles.backfillDoseButton,
                      selected && styles.backfillOptionSelected,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.backfillDoseText,
                        selected && styles.backfillOptionTextSelected,
                      ]}
                    >
                      {grams}g
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.backfillActions}>
              {existingBackfillGrams > 0 ? (
                <Pressable onTouchStart={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
                  onPress={() => {
                    setCreatineLog(selectedBackfillDateKey, null);
                    setIsBackfillOpen(false);
                  }}
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => [
                    styles.backfillGhostButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.backfillGhostText}>Remove</Text>
                </Pressable>
              ) : null}
              <Pressable onTouchStart={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}
                onPress={() => {
                  if (selectedBackfillGrams !== null) {
                    setCreatineLog(selectedBackfillDateKey, selectedBackfillGrams);
                    setIsBackfillOpen(false);
                  }
                }}
                disabled={selectedBackfillGrams === null}
                android_ripple={{ color: colors.ripple }}
                style={({ pressed }) => [
                  styles.backfillSaveButton,
                  selectedBackfillGrams === null && styles.backfillSaveButtonDisabled,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.backfillSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <InfoModal
        visible={helpOpen}
        title="Creatine load"
        message="The bar estimates creatine saturation from your daily logs. A 5g dose adds 4%, 10g adds 8%, 15g adds 12%, and 20g or more adds 15%. Each missed day lowers it by 3%, so a full bar falls to near empty in about 4 to 5 weeks. Values are capped between 0% and 100%. Based on Antonio et al. (2021)."
        onClose={() => setHelpOpen(false)}
      />
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      padding: 16,
      gap: 14,
    },
    backfillOpenArea: {
      gap: 14,
      borderRadius: radii.md,
      overflow: "hidden",
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
    },
    copy: {
      flex: 1,
      gap: 4,
    },
    metricRow: {
      alignItems: "flex-end",
      gap: 6,
    },
    label: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "800",
    },
    status: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    saturationBadge: {
      minWidth: 74,
      minHeight: 54,
      borderRadius: radii.md,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    saturationValue: {
      color: colors.accent,
      fontSize: 20,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
    },
    saturationLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.panelStrong,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    portionRow: {
      flexDirection: "row",
      gap: 8,
    },
    portionButton: {
      flex: 1,
      minHeight: 54,
      borderRadius: radii.md,
      backgroundColor: colors.backgroundAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    portionButtonSelected: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    portionText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    portionSubtext: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      marginTop: 2,
    },
    portionTextSelected: {
      color: colors.accent,
    },
    backfillModal: {
      flex: 1,
      justifyContent: "center",
      padding: 18,
    },
    backfillBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.52)",
    },
    backfillCard: {
      width: "100%",
      maxWidth: 420,
      alignSelf: "center",
      backgroundColor: colors.panel,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      gap: 14,
    },
    backfillTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "800",
    },
    backfillSubtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    backfillDays: {
      gap: 8,
      paddingRight: 4,
    },
    backfillDayButton: {
      minHeight: 42,
      minWidth: 94,
      borderRadius: radii.md,
      backgroundColor: colors.backgroundAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10,
      overflow: "hidden",
    },
    backfillDayText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    backfillDoseRow: {
      flexDirection: "row",
      gap: 8,
    },
    backfillDoseButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: radii.md,
      backgroundColor: colors.backgroundAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    backfillDoseText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
    },
    backfillOptionSelected: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    backfillOptionTextSelected: {
      color: colors.accent,
    },
    backfillActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
    },
    backfillGhostButton: {
      minHeight: 42,
      paddingHorizontal: 14,
      borderRadius: radii.md,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    backfillGhostText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "800",
    },
    backfillSaveButton: {
      minHeight: 42,
      paddingHorizontal: 18,
      borderRadius: radii.md,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    backfillSaveButtonDisabled: {
      opacity: 0.42,
    },
    backfillSaveText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: "900",
    },
    helpButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.backgroundAlt,
      overflow: "hidden",
    },
    helpText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
    },
    buttonPressed: {
      opacity: 0.96,
    },
  });
