import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { radii, ThemeColors, useThemeColors } from "../../constants/theme";
import { useAppStore } from "../../store/useAppStore";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { showAlert } from "../../lib/ui/alert";

export default function WorkoutStartScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const darkMode = useAppStore((state) => state.darkMode);
  const startOpenWorkout = useAppStore((state) => state.startOpenWorkout);
  const templates = useAppStore((state) => state.templates);
  const startWorkoutFromTemplate = useAppStore((state) => state.startWorkoutFromTemplate);
  const removeTemplate = useAppStore((state) => state.removeTemplate);
  const [selectedTemplate, setSelectedTemplate] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleStartEmpty = () => {
    startOpenWorkout();
  };

  const handleStartTemplate = (templateId: string, templateName: string) => {
    setSelectedTemplate({ id: templateId, name: templateName });
  };

  const handleRemoveTemplate = (templateId: string, templateName: string) => {
    showAlert(
      "Remove template?",
      `Delete "${templateName}" from your templates?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeTemplate(templateId),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>WORKOUT</Text>
          <Text style={styles.title}>Start a logging session.</Text>
        </View>

        <Pressable
          onPress={handleStartEmpty}
          android_ripple={{ color: colors.ripple }}
          style={({ pressed }) => [
            styles.primaryStartCard,
            pressed && styles.glowPressed,
          ]}
        >
          <View style={styles.primaryStartCopy}>
            <Text style={styles.primaryStartLabel}>START EMPTY WORKOUT</Text>
            <Text style={styles.primaryStartTitle}>Open a blank session</Text>
            <Text style={styles.primaryStartMeta}>
              Best for flexible training and quick logging while you build the workout live.
            </Text>
          </View>
          <View style={styles.primaryStartIcon}>
            <Ionicons name="barbell-outline" size={24} color={colors.white} />
          </View>
        </Pressable>

        <View style={styles.templatesSection}>
          <Text style={styles.sectionLabel}>TEMPLATES</Text>
          {templates.length > 0 ? (
            templates.map((template) => (
              <Swipeable
                key={template.id}
                overshootRight={false}
                rightThreshold={28}
                renderRightActions={() => (
                  <View style={styles.deleteAction}>
                    <Ionicons name="trash-outline" size={18} color={colors.white} />
                    <Text style={styles.deleteActionText}>Delete</Text>
                  </View>
                )}
                onSwipeableOpen={(direction) => {
                  if (direction === "right") {
                    handleRemoveTemplate(template.id, template.name);
                  }
                }}
              >
                <Pressable
                  onPress={() => handleStartTemplate(template.id, template.name)}
                  android_ripple={{ color: colors.ripple }}
                  style={({ pressed }) => [
                    styles.templateCard,
                    pressed && styles.glowPressed,
                  ]}
                >
                  <View style={styles.templateCopy}>
                    <Text style={styles.templateTitle}>{template.name}</Text>
                    <Text style={styles.templateMeta}>
                      {template.exercises.length} exercises
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.accent} />
                </Pressable>
              </Swipeable>
            ))
          ) : (
            <Text style={styles.emptyTemplatesText}>
              Save a workout from History as a template and it will show up here.
            </Text>
          )}
        </View>
      </ScrollView>
      <ConfirmModal
        visible={selectedTemplate !== null}
        title="Start template workout?"
        message={
          selectedTemplate
            ? `Are you sure you want to start "${selectedTemplate.name}"?`
            : ""
        }
        cancelLabel="Cancel"
        confirmLabel="Start"
        primaryActionFirst
        confirmFlex={2}
        cancelFlex={1}
        onCancel={() => setSelectedTemplate(null)}
        onConfirm={() => {
          if (!selectedTemplate) {
            return;
          }

          startWorkoutFromTemplate(selectedTemplate.id);
          setSelectedTemplate(null);
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 112,
    gap: 18,
  },
  hero: {
    gap: 8,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.7,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
  },
  primaryStartCard: {
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  primaryStartCopy: {
    flex: 1,
  },
  primaryStartLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  primaryStartTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  primaryStartMeta: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  primaryStartIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  templatesSection: {
    gap: 10,
  },
  sectionLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  templateCard: {
    backgroundColor: colors.panel,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  deleteAction: {
    width: 108,
    borderRadius: radii.lg,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  deleteActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  templateCopy: {
    flex: 1,
  },
  templateTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  templateMeta: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 14,
  },
  emptyTemplatesText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
  },
  glowPressed: {
    opacity: 0.96,
    shadowColor: colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
});
