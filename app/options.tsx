import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radii, ThemeColors, useThemeColors } from "../constants/theme";
import { useAppStore } from "../store/useAppStore";
import { showAlert } from "../lib/ui/alert";
import {
  canUseCreatineReminders,
  syncCreatineReminderNotification,
} from "../lib/notifications/creatineReminder";
import {
  BackupImportSelection,
  BackupSettings,
  canRestoreLocalBackups,
  canUseLocalBackups,
  chooseBackupDirectory,
  createBackupNow,
  getBackupSettings,
  restoreBackup,
  selectBackupFile,
} from "../lib/backup/localBackup";

const hourOptions = Array.from({ length: 24 }, (_, index) => index);
const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const formatTimePart = (value: number) => value.toString().padStart(2, "0");

export default function OptionsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const setDarkMode = useAppStore((state) => state.setDarkMode);
  const creatineReminderEnabled = useAppStore(
    (state) => state.creatineReminderEnabled
  );
  const creatineReminderHour = useAppStore((state) => state.creatineReminderHour);
  const creatineReminderMinute = useAppStore(
    (state) => state.creatineReminderMinute
  );
  const creatineReminderNotificationId = useAppStore(
    (state) => state.creatineReminderNotificationId
  );
  const creatineLogs = useAppStore((state) => state.creatineLogs);
  const setCreatineReminderEnabled = useAppStore(
    (state) => state.setCreatineReminderEnabled
  );
  const setCreatineReminderTime = useAppStore(
    (state) => state.setCreatineReminderTime
  );
  const setCreatineReminderNotificationId = useAppStore(
    (state) => state.setCreatineReminderNotificationId
  );
  const [isSyncingReminder, setIsSyncingReminder] = useState(false);
  const [openTimePicker, setOpenTimePicker] = useState<"hour" | "minute" | null>(
    null
  );
  const [draftReminderHour, setDraftReminderHour] = useState(creatineReminderHour);
  const [draftReminderMinute, setDraftReminderMinute] = useState(
    creatineReminderMinute
  );
  const [backupSettings, setBackupSettings] = useState<BackupSettings | null>(null);
  const [isBackupBusy, setIsBackupBusy] = useState(false);

  useEffect(() => {
    setDraftReminderHour(creatineReminderHour);
    setDraftReminderMinute(creatineReminderMinute);
  }, [creatineReminderHour, creatineReminderMinute]);

  useEffect(() => {
    let isMounted = true;

    void getBackupSettings().then((settings) => {
      if (isMounted) {
        setBackupSettings(settings);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const reminderTimeLabel = useMemo(
    () =>
      `${formatTimePart(draftReminderHour)}:${formatTimePart(
        draftReminderMinute
      )}`,
    [draftReminderHour, draftReminderMinute]
  );
  const isEditingReminderTime =
    openTimePicker !== null ||
    draftReminderHour !== creatineReminderHour ||
    draftReminderMinute !== creatineReminderMinute;
  const backupsAvailable = canUseLocalBackups();
  const restoreAvailable = canRestoreLocalBackups();
  const backupStatusLabel = !backupsAvailable
    ? "Creating backups is Android only"
    : backupSettings?.lastBackupFileName
      ? backupSettings.lastBackupFileName
      : backupSettings?.directoryUri
        ? "Ready"
        : "No folder selected";

  const applyReminderSettings = async (
    enabled: boolean,
    hour = creatineReminderHour,
    minute = creatineReminderMinute
  ) => {
    setIsSyncingReminder(true);

    try {
      if (enabled && !canUseCreatineReminders()) {
        setCreatineReminderEnabled(false);
        setCreatineReminderNotificationId(null);
        showAlert(
          "Development build needed",
          "Daily reminders need native notification support, which Expo Go does not include for this SDK. Use a development build to enable them."
        );
        return;
      }

      const notificationId = await syncCreatineReminderNotification({
        enabled,
        hour,
        minute,
        notificationId: creatineReminderNotificationId,
        creatineLogs,
      });

      setCreatineReminderEnabled(enabled && Boolean(notificationId?.length));
      setCreatineReminderNotificationId(notificationId);

      if (enabled && !notificationId) {
        showAlert(
          "Notifications off",
          "Allow notifications in your device settings to use creatine reminders."
        );
      }
    } finally {
      setIsSyncingReminder(false);
    }
  };

  const saveReminderTime = async () => {
    setCreatineReminderTime(draftReminderHour, draftReminderMinute);

    if (creatineReminderEnabled) {
      await applyReminderSettings(true, draftReminderHour, draftReminderMinute);
    }

    router.replace("/(tabs)/today");
  };

  const handleChooseBackupDirectory = async () => {
    setIsBackupBusy(true);

    try {
      const settings = await chooseBackupDirectory();
      setBackupSettings(settings);
    } catch (error) {
      showAlert(
        "Backups unavailable",
        error instanceof Error ? error.message : "Could not choose a folder."
      );
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleBackupNow = async () => {
    setIsBackupBusy(true);

    try {
      const result = await createBackupNow("manual");
      setBackupSettings(result.settings);

      showAlert(
        result.created ? "Backup created" : "Backup not created",
        result.fileName ?? result.message
      );
    } finally {
      setIsBackupBusy(false);
    }
  };

  const applySelectedBackup = async (selection: BackupImportSelection) => {
    setIsBackupBusy(true);

    try {
      const result = await restoreBackup(selection);
      setBackupSettings(result.settings);

      const restoredActiveWorkout = useAppStore.getState().activeWorkout;
      router.replace(
        restoredActiveWorkout ? "/(tabs)/workout" : "/(tabs)/today"
      );
      showAlert(
        "Backup restored",
        result.restoredImageCount > 0
          ? `All app data and ${result.restoredImageCount} exercise photo${result.restoredImageCount === 1 ? "" : "s"} were restored.`
          : "All app data from the backup was restored."
      );
    } catch (error) {
      showAlert(
        "Restore failed",
        error instanceof Error ? error.message : "Could not restore this backup."
      );
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleSelectBackup = async () => {
    setIsBackupBusy(true);

    try {
      const selection = await selectBackupFile();
      if (!selection) {
        return;
      }

      const { summary } = selection;
      const backupDate = selection.createdAt
        ? new Date(selection.createdAt).toLocaleString()
        : "Unknown date";
      const warningCopy = selection.warnings.length
        ? `\n\nWarning: ${selection.warnings.join(" ")}`
        : "";

      showAlert(
        "Replace all app data?",
        `${selection.fileName}\n${backupDate}\n\n${summary.workoutCount} workouts, ${summary.exerciseCount} exercises (${summary.customExerciseCount} custom), ${summary.templateCount} templates, ${summary.creatineDayCount} creatine days and ${summary.photoCount} embedded photos.\n\nThis replaces the current app data. Back up the current data first if you may need it.${warningCopy}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            style: "destructive",
            onPress: () => {
              void applySelectedBackup(selection);
            },
          },
        ]
      );
    } catch (error) {
      showAlert(
        "Cannot load backup",
        error instanceof Error ? error.message : "Could not read this backup file."
      );
    } finally {
      setIsBackupBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Options</Text>
        <View style={styles.iconButton} />
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={openTimePicker !== null}
        onRequestClose={() => setOpenTimePicker(null)}
      >
        <View style={styles.pickerModal}>
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => setOpenTimePicker(null)}
          />
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>
              {openTimePicker === "hour" ? "Hour" : "Minute"}
            </Text>
            <ScrollView
              style={styles.pickerScroll}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="always"
            >
              {(openTimePicker === "hour" ? hourOptions : minuteOptions).map(
                (value) => {
                  const selected =
                    openTimePicker === "hour"
                      ? value === draftReminderHour
                      : value === draftReminderMinute;

                  return (
                    <Pressable
                      key={value}
                      onPress={() => {
                        if (openTimePicker === "hour") {
                          setDraftReminderHour(value);
                        } else {
                          setDraftReminderMinute(value);
                        }
                        setOpenTimePicker(null);
                      }}
                      android_ripple={{ color: colors.ripple }}
                      style={({ pressed }) => [
                        styles.pickerOption,
                        selected && styles.pickerOptionSelected,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          selected && styles.pickerOptionTextSelected,
                        ]}
                      >
                        {formatTimePart(value)}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.panel}>
          <View style={styles.settingTopRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Dark mode</Text>
              <Text style={styles.settingSubtitle}>Use a darker app theme.</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{
                false: colors.panelMuted,
                true: colors.accentSoft,
              }}
              thumbColor={darkMode ? colors.accent : colors.textSoft}
            />
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.settingTopRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Creatine reminder</Text>
              <Text style={styles.settingSubtitle}>
                Ask me daily if I have taken creatine.
              </Text>
            </View>
            <Switch
              value={creatineReminderEnabled}
              disabled={isSyncingReminder}
              onValueChange={(enabled) => {
                void applyReminderSettings(enabled);
              }}
              trackColor={{
                false: colors.panelMuted,
                true: colors.accentSoft,
              }}
              thumbColor={
                creatineReminderEnabled ? colors.accent : colors.textSoft
              }
            />
          </View>

          <View style={styles.timeSummary}>
            <Ionicons name="notifications-outline" size={18} color={colors.accent} />
            <Text style={styles.timeSummaryText}>{reminderTimeLabel}</Text>
          </View>

          <View style={styles.timePicker}>
            <Pressable
              onPress={() => setOpenTimePicker("hour")}
              android_ripple={{ color: colors.ripple }}
              style={({ pressed }) => [
                styles.timeChip,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.timeChipLabel}>Hour</Text>
              <Text style={styles.timeChipValue}>
                {formatTimePart(draftReminderHour)}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.accent} />
            </Pressable>

            <Text style={styles.timeSeparator}>:</Text>

            <Pressable
              onPress={() => setOpenTimePicker("minute")}
              android_ripple={{ color: colors.ripple }}
              style={({ pressed }) => [
                styles.timeChip,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.timeChipLabel}>Minute</Text>
              <Text style={styles.timeChipValue}>
                {formatTimePart(draftReminderMinute)}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.accent} />
            </Pressable>
          </View>

          {isEditingReminderTime ? (
            <Pressable
              onPress={() => {
                void saveReminderTime();
              }}
              disabled={isSyncingReminder}
              android_ripple={{ color: colors.ripple }}
              style={({ pressed }) => [
                styles.saveTimeButton,
                pressed && !isSyncingReminder && styles.buttonPressed,
              ]}
            >
              <Ionicons name="checkmark" size={24} color={colors.panelStrong} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.panel}>
          <View style={styles.settingTopRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Local backups</Text>
              <Text style={styles.settingSubtitle}>
                Save or restore workouts, exercises, settings, creatine data and photos
                from one JSON file.
              </Text>
            </View>
            <Ionicons
              name={Platform.OS === "android" ? "folder-outline" : "phone-portrait-outline"}
              size={24}
              color={colors.accent}
            />
          </View>

          <View style={styles.backupSummary}>
            <Ionicons name="save-outline" size={18} color={colors.accent} />
            <Text numberOfLines={2} style={styles.backupSummaryText}>
              {backupStatusLabel}
            </Text>
          </View>

          {backupSettings?.lastError ? (
            <Text style={styles.backupError}>{backupSettings.lastError}</Text>
          ) : null}

          <View style={styles.backupActions}>
            <Pressable
              onPress={() => {
                void handleChooseBackupDirectory();
              }}
              disabled={!backupsAvailable || isBackupBusy}
              android_ripple={{ color: colors.ripple }}
              style={({ pressed }) => [
                styles.backupButton,
                (!backupsAvailable || isBackupBusy) && styles.buttonDisabled,
                pressed && backupsAvailable && !isBackupBusy && styles.buttonPressed,
              ]}
            >
              <Ionicons name="folder-open-outline" size={20} color={colors.accent} />
              <Text style={styles.backupButtonText}>Choose folder</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                void handleBackupNow();
              }}
              disabled={!backupsAvailable || isBackupBusy}
              android_ripple={{ color: colors.ripple }}
              style={({ pressed }) => [
                styles.backupButton,
                (!backupsAvailable || isBackupBusy) && styles.buttonDisabled,
                pressed && backupsAvailable && !isBackupBusy && styles.buttonPressed,
              ]}
            >
              <Ionicons name="download-outline" size={20} color={colors.accent} />
              <Text style={styles.backupButtonText}>Back up now</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => {
              void handleSelectBackup();
            }}
            disabled={!restoreAvailable || isBackupBusy}
            android_ripple={{ color: colors.ripple }}
            style={({ pressed }) => [
              styles.backupButton,
              styles.restoreButton,
              (!restoreAvailable || isBackupBusy) && styles.buttonDisabled,
              pressed && restoreAvailable && !isBackupBusy && styles.buttonPressed,
            ]}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.accent} />
            <Text style={styles.backupButtonText}>Restore from file</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  container: {
    padding: 18,
    paddingBottom: 40,
    gap: 14,
  },
  panel: {
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 18,
  },
  settingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  settingCopy: {
    flex: 1,
    gap: 5,
  },
  settingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  settingSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  timeSummary: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.panelStrong,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timeSummaryText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  backupSummary: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.panelStrong,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backupSummaryText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  backupError: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  backupActions: {
    flexDirection: "row",
    gap: 10,
  },
  backupButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.panelStrong,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
  },
  backupButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "800",
  },
  restoreButton: {
    flex: 0,
    width: "100%",
  },
  buttonDisabled: {
    opacity: 0.46,
  },
  saveTimeButton: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  timePicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeChip: {
    flex: 1,
    minHeight: 76,
    borderRadius: radii.md,
    backgroundColor: colors.panelStrong,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    overflow: "hidden",
  },
  timeChipLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  timeChipValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  timeSeparator: {
    color: colors.textMuted,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 12,
  },
  pickerModal: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  pickerCard: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 280,
    maxHeight: 360,
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  pickerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  pickerScroll: {
    maxHeight: 292,
  },
  pickerOption: {
    minHeight: 46,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  pickerOptionSelected: {
    backgroundColor: "rgba(77, 164, 255, 0.16)",
  },
  pickerOptionText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  pickerOptionTextSelected: {
    color: colors.accent,
  },
  buttonPressed: {
    opacity: 0.96,
  },
});
