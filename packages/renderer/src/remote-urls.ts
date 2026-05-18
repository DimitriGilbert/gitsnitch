export type GitProvider = "github" | "gitlab" | "bitbucket" | "unknown";

export function detectProvider(remoteUrl: string | undefined): GitProvider {
  if (remoteUrl === undefined) {
    return "unknown";
  }

  const host = extractHost(remoteUrl);
  if (host === undefined) {
    return "unknown";
  }

  if (host === "github.com" || host.endsWith(".github.com")) {
    return "github";
  }
  if (host === "gitlab.com" || host.endsWith(".gitlab.com")) {
    return "gitlab";
  }
  if (host === "bitbucket.org" || host.endsWith(".bitbucket.org")) {
    return "bitbucket";
  }

  return "unknown";
}

export function buildCommitUrl(remoteUrl: string | undefined, hash: string): string | undefined {
  if (remoteUrl === undefined) {
    return undefined;
  }

  const provider = detectProvider(remoteUrl);
  const base = remoteUrl.replace(/\/+$/, "");

  switch (provider) {
    case "github":
      return `${base}/commit/${hash}`;
    case "gitlab":
      return `${base}/-/commit/${hash}`;
    case "bitbucket":
      return `${base}/commits/${hash}`;
    default:
      return `${base}/commit/${hash}`;
  }
}

export function buildFileUrl(remoteUrl: string | undefined, branch: string | undefined, filePath: string): string | undefined {
  if (remoteUrl === undefined || branch === undefined) {
    return undefined;
  }

  const provider = detectProvider(remoteUrl);
  const base = remoteUrl.replace(/\/+$/, "");

  switch (provider) {
    case "github":
      return `${base}/blob/${branch}/${filePath}`;
    case "gitlab":
      return `${base}/-/blob/${branch}/${filePath}`;
    case "bitbucket":
      return `${base}/src/${branch}/${filePath}`;
    default:
      return `${base}/blob/${branch}/${filePath}`;
  }
}

function extractHost(remoteUrl: string): string | undefined {
  try {
    const parsed = new URL(remoteUrl);
    return parsed.hostname;
  } catch {
    const scpLike = /^git@([^:]+):/.exec(remoteUrl);
    return scpLike?.[1];
  }
}
