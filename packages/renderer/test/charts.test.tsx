import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CommitActivityChart,
  ContributorPieChart,
  deriveActivityHeatmapData,
  deriveAdditionsVsDeletionsData,
  deriveCommitSizeDistributionData,
  deriveContributionCalendarData,
  deriveContributorPieData,
  deriveProjectsComparisonData,
  deriveTimeOfDayData,
  deriveVelocityData,
  deriveWeeklyActivityData,
} from "../src/charts";
import { repoReportFixture, scanReportFixture } from "./report-fixtures";

describe("chart data derivation", () => {
  it("derives churn and activity from typed report commits", () => {
    expect(deriveAdditionsVsDeletionsData(repoReportFixture.commits)).toEqual([
      { period: "2024-01", additions: 12, deletions: 1 },
    ]);
    expect(deriveCommitSizeDistributionData(repoReportFixture.commits)).toEqual([
      { label: "1-10", commits: 0 },
      { label: "11-50", commits: 1 },
      { label: "51-200", commits: 0 },
      { label: "201+", commits: 0 },
    ]);
    expect(deriveWeeklyActivityData(repoReportFixture.commits).find((point) => point.day === "Tue")?.commits).toBe(1);
    expect(deriveTimeOfDayData(repoReportFixture.commits).find((point) => point.hour === "03:00")?.commits).toBe(1);
  });

  it("derives scan and density data without reading globals", () => {
    expect(deriveContributorPieData(repoReportFixture.contributors)).toEqual([{ name: "Ada Lovelace", commits: 1 }]);
    expect(deriveContributionCalendarData(repoReportFixture.commits)).toEqual([{ date: "2024-01-02", commits: 1 }]);
    expect(deriveVelocityData(repoReportFixture)).toEqual([{ period: "2024-01", commits: 1, average: 1 }]);
    expect(deriveProjectsComparisonData(scanReportFixture.projects)).toEqual([
      { project: "fixture-repo", commits: 1, contributors: 1, filesChanged: 1 },
    ]);
    expect(deriveActivityHeatmapData(repoReportFixture.commits).filter((cell) => cell.commits > 0)).toEqual([
      { day: "Tue", hour: "03:00", commits: 1 },
    ]);
  });
});

describe("chart empty states", () => {
  it("renders explicit empty state for missing activity", () => {
    const html = renderToString(<CommitActivityChart data={[]} />);

    expect(html).toContain("No commit activity to chart");
    expect(html).toContain("This report has no dated commits, so there is no cadence data yet.");
  });

  it("renders explicit empty state for zero-valued contributor slices", () => {
    const html = renderToString(<ContributorPieChart data={[{ name: "Ada Lovelace", commits: 0 }]} />);

    expect(html).toContain("No contributor share to chart");
  });
});
