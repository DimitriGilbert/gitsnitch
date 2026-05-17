import type {
  RepoTemplateContext,
  ScanProjectTemplateContext,
  ScanTemplateContext,
  TemplateRouteId,
} from "@git-snitch/core";

export type TemplateComponent<Props> = (props: Props) => unknown;

export interface RouteTemplatePropsById {
  readonly overview: RepoTemplateContext;
  readonly commits: RepoTemplateContext;
  readonly contributors: RepoTemplateContext;
  readonly charts: RepoTemplateContext;
  readonly quality: RepoTemplateContext;
  readonly hotspots: RepoTemplateContext;
  readonly scanOverview: ScanTemplateContext;
  readonly scanProject: ScanProjectTemplateContext;
}

export type RouteTemplateOverrides = {
  readonly [RouteId in TemplateRouteId]?: TemplateComponent<RouteTemplatePropsById[RouteId]>;
};

export interface TemplateModule {
  readonly templates: RouteTemplateOverrides;
}

export type { RepoTemplateContext, ScanProjectTemplateContext, ScanTemplateContext, TemplateRouteId } from "@git-snitch/core";
