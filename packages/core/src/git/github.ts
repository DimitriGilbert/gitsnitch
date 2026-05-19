import type { AsyncCommandRunner } from "./types.js";

export interface GitHubRepoMeta {
  readonly description?: string;
  readonly stars?: number;
  readonly forks?: number;
  readonly license?: string;
  readonly topics?: readonly string[];
  readonly visibility?: "public" | "private";
  readonly homepageUrl?: string;
  readonly openIssues?: number;
  readonly openPullRequests?: number;
}

interface GhRepoViewJson {
  readonly description?: string;
  readonly stargazerCount?: number;
  readonly forkCount?: number;
  readonly licenseInfo?: {
    readonly spdxId?: string;
    readonly name?: string;
  };
  readonly repositoryTopics?: readonly {
    readonly name: string;
  }[];
  readonly isPrivate?: boolean;
  readonly homepageUrl?: string;
  readonly issues?: readonly unknown[];
  readonly pullRequests?: readonly unknown[];
}

export function detectGitHubRepo(
  remoteUrl: string | undefined,
): { readonly owner: string; readonly repo: string } | undefined {
  if (remoteUrl === undefined) {
    return undefined;
  }

  const trimmed = remoteUrl.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  // SSH format: git@github.com:owner/repo.git
  const scpMatch = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/.exec(trimmed);
  if (scpMatch?.[1] !== undefined && scpMatch[2] !== undefined) {
    return { owner: scpMatch[1], repo: scpMatch[2] };
  }

  // HTTPS format: https://github.com/owner/repo.git or https://github.com/owner/repo
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "github.com" || parsed.hostname.endsWith(".github.com")) {
      const pathSegments = parsed.pathname
        .replace(/^\/+/, "")
        .replace(/\.git$/, "")
        .split("/");
      const owner = pathSegments[0];
      const repo = pathSegments[1];
      if (owner !== undefined && owner.length > 0 && repo !== undefined && repo.length > 0) {
        return { owner, repo };
      }
    }
  } catch {
    // Not a valid URL
  }

  return undefined;
}

export async function fetchGitHubRepoMeta(
  remoteUrl: string,
  runner: AsyncCommandRunner,
): Promise<GitHubRepoMeta | undefined> {
  try {
    const detected = detectGitHubRepo(remoteUrl);
    if (detected === undefined) {
      return undefined;
    }

    const slug = `${detected.owner}/${detected.repo}`;

    const result = await runner(
      "gh",
      [
        "repo",
        "view",
        slug,
        "--json",
        "description,stargazerCount,forkCount,licenseInfo,repositoryTopics,isPrivate,homepageUrl,issues,pullRequests",
      ],
      { cwd: process.cwd() },
    );

    const data: GhRepoViewJson = JSON.parse(result.stdout);

    return {
      ...(data.description !== undefined && data.description.length > 0
        ? { description: data.description }
        : {}),
      ...(typeof data.stargazerCount === "number" ? { stars: data.stargazerCount } : {}),
      ...(typeof data.forkCount === "number" ? { forks: data.forkCount } : {}),
      ...(data.licenseInfo !== undefined
        ? { license: data.licenseInfo.spdxId ?? data.licenseInfo.name }
        : {}),
      ...(Array.isArray(data.repositoryTopics) && data.repositoryTopics.length > 0
        ? { topics: data.repositoryTopics.map((topic) => topic.name) }
        : {}),
      ...(typeof data.isPrivate === "boolean"
        ? { visibility: data.isPrivate ? ("private" as const) : ("public" as const) }
        : {}),
      ...(data.homepageUrl !== undefined && data.homepageUrl.length > 0
        ? { homepageUrl: data.homepageUrl }
        : {}),
      ...(Array.isArray(data.issues) ? { openIssues: data.issues.length } : {}),
      ...(Array.isArray(data.pullRequests) ? { openPullRequests: data.pullRequests.length } : {}),
    };
  } catch (error: unknown) {
    console.warn(`Failed to fetch GitHub metadata for ${remoteUrl}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}
