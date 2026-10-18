import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Exercise } from "../../features/exercises/exercise.types";
import { WorkoutSession } from "../../features/workouts/workout.types";
import {
  buildCoachReportData,
  CoachReportData,
  CoachReportExerciseRow,
  CoachReportSessionRow,
} from "../../features/reports/coach-report";

type ShareCoachReportPdfInput = {
  sessions: WorkoutSession[];
  exercises: Exercise[];
};

type CoachReportPdfFile = {
  uri: string;
  fileName: string;
};

const escapeHtml = (value: string | number | undefined | null) =>
  `${value ?? ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatNumber = (value: number) => Math.round(value).toLocaleString();

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours <= 0) {
    return `${remainingMinutes}m`;
  }

  return remainingMinutes === 0
    ? `${hours}h`
    : `${hours}h ${remainingMinutes}m`;
};

const renderMetric = (label: string, value: string, detail?: string) => `
  <div class="metric">
    <div class="metric-label">${escapeHtml(label)}</div>
    <div class="metric-value">${escapeHtml(value)}</div>
    ${detail ? `<div class="metric-detail">${escapeHtml(detail)}</div>` : ""}
  </div>
`;

const renderWeeklyAttendanceRows = (data: CoachReportData) => {
  if (data.weeklyAttendance.length === 0) {
    return `<tr><td colspan="4" class="empty-row">No workouts selected.</td></tr>`;
  }

  return data.weeklyAttendance
    .map(
      (week) => `
        <tr>
          <td>${escapeHtml(week.label)}</td>
          <td>
            <div class="bar-cell">
              <span>${week.workoutCount}</span>
              <div class="bar-track">
                <div class="bar-fill" style="width: ${Math.max(
                  week.ratio * 100,
                  8
                )}%"></div>
              </div>
            </div>
          </td>
          <td>${week.completedSets}</td>
          <td>${formatNumber(week.volume)} kg</td>
        </tr>
      `
    )
    .join("");
};

const renderMuscleHitRows = (data: CoachReportData) => {
  if (data.muscleHits.length === 0) {
    return `<tr><td colspan="3" class="empty-row">No completed muscle volume found for the selected workouts.</td></tr>`;
  }

  return data.muscleHits
    .slice(0, 14)
    .map(
      (muscle) => `
        <tr>
          <td>${escapeHtml(muscle.label)}</td>
          <td>
            <div class="bar-cell">
              <span>${muscle.workoutCount}/${data.summary.workoutCount}</span>
              <div class="bar-track">
                <div class="bar-fill" style="width: ${Math.max(
                  muscle.ratio * 100,
                  8
                )}%"></div>
              </div>
            </div>
          </td>
          <td>${formatNumber(muscle.volume)} kg</td>
        </tr>
      `
    )
    .join("");
};

const renderSetRows = (exercise: CoachReportExerciseRow) => {
  if (exercise.sets.length === 0) {
    return `<tr><td colspan="3" class="empty-row">No completed sets logged.</td></tr>`;
  }

  return exercise.sets
    .map(
      (set) => `
        <tr>
          <td>${set.setNumber}</td>
          <td>${escapeHtml(set.weightLabel)}</td>
          <td>${escapeHtml(set.repsLabel)}</td>
        </tr>
      `
    )
    .join("");
};

const renderExercise = (exercise: CoachReportExerciseRow) => `
  <div class="exercise">
    <div class="exercise-head">
      <div>
        <div class="exercise-title">${escapeHtml(exercise.name)}</div>
        <div class="exercise-meta">${escapeHtml(exercise.meta)}</div>
      </div>
      <div class="exercise-summary">
        <strong>${formatNumber(exercise.volume)} kg</strong>
        <span>${exercise.completedSets}/${exercise.totalSets} sets</span>
      </div>
    </div>
    <table class="sets-table">
      <thead>
        <tr>
          <th>Set</th>
          <th>Weight</th>
          <th>Reps</th>
        </tr>
      </thead>
      <tbody>${renderSetRows(exercise)}</tbody>
    </table>
    ${
      exercise.notes
        ? `<div class="note"><strong>Exercise note:</strong> ${escapeHtml(exercise.notes)}</div>`
        : ""
    }
  </div>
`;

const renderSession = (session: CoachReportSessionRow) => `
  <section class="session">
    <div class="session-head">
      <div>
        <div class="session-date">${escapeHtml(session.dateLabel)}</div>
        <h3>${escapeHtml(session.title)}</h3>
        <div class="session-time">${escapeHtml(session.timeRangeLabel)}</div>
      </div>
      <div class="session-stats">
        <div><strong>${escapeHtml(session.durationLabel)}</strong><span>Duration</span></div>
        <div><strong>${formatNumber(session.volume)} kg</strong><span>Volume</span></div>
        <div><strong>${session.completedSets}/${session.totalSets}</strong><span>Sets</span></div>
      </div>
    </div>
    ${
      session.notes
        ? `<div class="note session-note"><strong>Workout note:</strong> ${escapeHtml(
            session.notes
          )}</div>`
        : ""
    }
    ${session.exercises.map(renderExercise).join("")}
  </section>
`;

const buildCoachReportHtml = (data: CoachReportData) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page {
        size: A4;
        margin: 18mm 15mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: #202633;
        background: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        font-size: 11.5px;
        line-height: 1.45;
      }

      h1, h2, h3, p {
        margin: 0;
      }

      .report-header {
        padding-bottom: 14px;
        border-bottom: 2px solid #202633;
        margin-bottom: 16px;
      }

      .header-row {
        display: flex;
        justify-content: space-between;
        gap: 28px;
      }

      .brand {
        color: #202633;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1.2px;
        text-transform: uppercase;
      }

      h1 {
        margin-top: 5px;
        font-size: 27px;
        line-height: 1.1;
      }

      .header-meta {
        min-width: 190px;
        color: #667085;
        font-size: 10.5px;
        text-align: right;
      }

      .header-meta strong {
        color: #202633;
      }

      .section {
        margin-top: 18px;
      }

      .section-title {
        margin-bottom: 8px;
        color: #202633;
        font-size: 14px;
        font-weight: 800;
      }

      .metric-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        border: 1px solid #d9dee7;
      }

      .metric {
        min-height: 66px;
        padding: 10px;
        border-right: 1px solid #e6eaf0;
        background: #ffffff;
      }

      .metric:last-child {
        border-right: 0;
      }

      .metric-label {
        color: #667085;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.6px;
        text-transform: uppercase;
      }

      .metric-value {
        margin-top: 6px;
        color: #202633;
        font-size: 17px;
        font-weight: 800;
      }

      .metric-detail {
        margin-top: 1px;
        color: #667085;
        font-size: 10px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th {
        padding: 7px 8px;
        color: #667085;
        background: #f5f6f8;
        border-top: 1px solid #d9dee7;
        border-bottom: 1px solid #d9dee7;
        font-size: 9px;
        letter-spacing: 0.55px;
        text-align: left;
        text-transform: uppercase;
      }

      td {
        padding: 7px 8px;
        border-bottom: 1px solid #e8ebf0;
        vertical-align: top;
      }

      .bar-cell {
        display: grid;
        grid-template-columns: 44px 1fr;
        gap: 8px;
        align-items: center;
      }

      .bar-cell span {
        color: #202633;
        font-weight: 800;
      }

      .bar-track {
        height: 7px;
        background: #edf0f4;
        overflow: hidden;
      }

      .bar-fill {
        height: 100%;
        background: #202633;
      }

      .session {
        page-break-inside: avoid;
        break-inside: avoid;
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1.5px solid #202633;
      }

      .session-head {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        padding-bottom: 10px;
      }

      .session-date {
        color: #667085;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.7px;
        text-transform: uppercase;
      }

      .session h3 {
        margin-top: 3px;
        color: #202633;
        font-size: 16px;
      }

      .session-time {
        color: #667085;
        margin-top: 2px;
      }

      .session-stats {
        display: grid;
        grid-template-columns: repeat(3, 80px);
        gap: 8px;
        text-align: right;
      }

      .session-stats strong {
        display: block;
        color: #202633;
        font-size: 11px;
      }

      .session-stats span {
        color: #667085;
        font-size: 9px;
        letter-spacing: 0.4px;
        text-transform: uppercase;
      }

      .exercise {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #e8ebf0;
      }

      .exercise-head {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 7px;
      }

      .exercise-title {
        color: #202633;
        font-weight: 800;
      }

      .exercise-meta,
      .exercise-summary span,
      .muted {
        color: #667085;
      }

      .exercise-summary {
        min-width: 90px;
        text-align: right;
      }

      .exercise-summary strong,
      .exercise-summary span {
        display: block;
      }

      .sets-table th:first-child,
      .sets-table td:first-child {
        width: 64px;
      }

      .empty-row {
        color: #667085;
        font-style: italic;
      }

      .note {
        margin-top: 8px;
        padding: 7px 9px;
        border-left: 2px solid #202633;
        color: #344054;
        background: #f7f8fa;
      }

      .coach-notes {
        min-height: 100px;
        border: 1px dashed #b8c0cc;
        background: #ffffff;
      }
    </style>
  </head>
  <body>
    <header class="report-header">
      <div class="header-row">
        <div>
          <div class="brand">vDstrong</div>
          <h1>Coach Report</h1>
        </div>
        <div class="header-meta">
          <strong>Training range</strong><br />
          ${escapeHtml(data.dateRangeLabel)}<br /><br />
          <strong>Generated</strong><br />
          ${escapeHtml(data.generatedAtLabel)}
        </div>
      </div>
    </header>

    <section class="section">
      <div class="section-title">Overview</div>
      <div class="metric-grid">
        ${renderMetric("Workouts", `${data.summary.workoutCount}`)}
        ${renderMetric("Volume", `${formatNumber(data.summary.totalVolume)} kg`)}
        ${renderMetric("Sets", `${data.summary.completedSets}/${data.summary.totalSets}`, "completed")}
        ${renderMetric("Exercises", `${data.summary.exerciseCount}`)}
        ${renderMetric("Avg. duration", formatMinutes(data.summary.averageDurationMinutes))}
      </div>
    </section>

    <section class="section">
      <div class="section-title">Weekly Attendance</div>
      <table>
        <thead>
          <tr>
            <th>Week</th>
            <th>Workouts</th>
            <th>Completed sets</th>
            <th>Volume</th>
          </tr>
        </thead>
        <tbody>${renderWeeklyAttendanceRows(data)}</tbody>
      </table>
    </section>

    <section class="section">
      <div class="section-title">Muscles Hit</div>
      <table>
        <thead>
          <tr>
            <th>Muscle</th>
            <th>Workouts hit</th>
            <th>Volume</th>
          </tr>
        </thead>
        <tbody>${renderMuscleHitRows(data)}</tbody>
      </table>
    </section>

    <section class="section">
      <div class="section-title">Selected Workouts</div>
      ${data.sessions.map(renderSession).join("")}
    </section>

    <section class="section">
      <div class="section-title">Coach Notes</div>
      <div class="coach-notes"></div>
    </section>
  </body>
</html>
`;

const createReportFileIdentity = () => {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    `${now.getMonth() + 1}`.padStart(2, "0"),
    `${now.getDate()}`.padStart(2, "0"),
    `${now.getHours()}`.padStart(2, "0"),
    `${now.getMinutes()}`.padStart(2, "0"),
    `${now.getSeconds()}`.padStart(2, "0"),
  ];
  const fileName = `vdstrong-coach-report-${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}${parts[4]}${parts[5]}.pdf`;

  return {
    fileName,
  };
};

const createCoachReportPdfFile = async ({
  sessions,
  exercises,
}: ShareCoachReportPdfInput): Promise<CoachReportPdfFile> => {
  const data = buildCoachReportData(sessions, exercises);
  const html = buildCoachReportHtml(data);
  const fileIdentity = createReportFileIdentity();
  const printResult = await Print.printToFileAsync({ html });
  const outputDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  const outputUri = outputDirectory
    ? `${outputDirectory}${fileIdentity.fileName}`
    : printResult.uri;

  if (outputUri !== printResult.uri) {
    await FileSystem.copyAsync({ from: printResult.uri, to: outputUri });
  }

  return {
    uri: outputUri,
    ...fileIdentity,
  };
};

export const shareCoachReportPdf = async (input: ShareCoachReportPdfInput) => {
  const reportFile = await createCoachReportPdfFile(input);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(reportFile.uri, {
      dialogTitle: "Share coach report",
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
    });
  }

  return reportFile.uri;
};
