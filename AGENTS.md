# AGENTS.md

Guidance for coding agents working in this repository.

## Project Overview

This is a React Native / Expo app named `vDstrong`, built with Expo Router, TypeScript, Zustand, and Android native widgets.

The main user-facing areas are:

- Today overview: `app/(tabs)/today.tsx`
- Active workout: `app/workout/active.tsx`
- Workout start flow: `app/workout/start.tsx`
- Body map: `app/(tabs)/body-map.tsx`
- History: `app/(tabs)/history.tsx` and `app/history/[sessionId].tsx`
- Exercise library/details: `app/exercises/`
- Options/settings: `app/options.tsx`

## Important Architecture

- Global app state lives in `store/useAppStore.ts`.
- Domain calculations live under `features/`; reuse them instead of duplicating business logic in UI components.
- Shared visual constants live in `constants/theme.ts`.
- UI helpers live in `components/ui/`.
- Workout-specific UI lives in `components/workout/`.
- Overview card code lives in `components/overview/`.

## Overview Cards

Overview cards are modular.

- Stable card IDs and labels: `features/overview/overview-cards.ts`
- Registry: `components/overview/cardRegistry.tsx`
- Card surface: `components/overview/OverviewCardWrapper.tsx`
- Shared full-card arrange gestures: `components/ui/ReorderList.tsx`
- Pure ordering and measured slot calculations: `features/reorder/order.ts`
- Individual card components: `components/overview/cards/`

To add a new overview card:

1. Add the stable card ID and label in `features/overview/overview-cards.ts`.
2. Create the card component in `components/overview/cards/`.
3. Register it in `components/overview/cardRegistry.tsx`.
4. Keep card-specific UI and interactions inside the card component.
5. Keep ordering/visibility preferences in the Zustand store.

Do not put card internals directly into `app/(tabs)/today.tsx`; that screen should coordinate rendering and arranging only.

## Gesture Rules

The overview card arrange behavior should follow the active workout exercise behavior closely.

- Long press starts arrange mode.
- The same touch gesture should continue into dragging.
- Reorder state should be temporary while dragging and committed only on release.
- Swipe left should remove/hide using a custom `PanResponder` and `Animated.Value`, matching the workout row style.
- Avoid `react-native-gesture-handler/Swipeable` for overview arrange rows unless the active workout implementation is changed too.
- Do not let the parent `ScrollView` close arrange mode while an active drag is happening.

Use these files as the reference pattern:

- `components/ui/ReorderList.tsx`
- `features/reorder/order.ts`
- `app/workout/active.tsx`

## Android Widgets

Android native widget code lives under:

- `android/app/src/main/java/com/anonymous/vanDijkFit/`
- `android/app/src/main/res/layout/`
- `android/app/src/main/res/xml/`
- `lib/widget/`
- `features/body-map/widget-data.ts`

The creatine widget sizing is controlled by `android/app/src/main/res/xml/creatine_widget_info.xml`.

## Commands

Common commands:

- Type check: `npx tsc --noEmit`
- Lint: `npm run lint`
- Start Expo: `npm run start`
- Android dev run: `npm run android`
- Android release build: `cd android && .\gradlew.bat assembleRelease`

Do not run long Android/Gradle builds unless the user explicitly asks. For ordinary code changes, prefer TypeScript checks or focused static inspection.

## Editing Guidance

- Keep changes narrowly scoped to the user request.
- Do not rewrite unrelated files.
- Prefer existing app patterns over adding new abstractions.
- Avoid introducing new libraries unless clearly necessary.
- Preserve saved user preferences and persisted store shape when refactoring.
- For React Native UI, keep controls compact, touch-friendly, and consistent with the existing theme.
