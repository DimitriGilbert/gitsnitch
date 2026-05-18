export type GitProvider = "github" | "gitlab" | "bitbucket" | "unknown";

const SCP_REMOTE = /^git@([^:]+):(.+?)$/;

export function normalizeRemoteToWebUrl(remoteUrl: string): string {
  const trimmed = remoteUrl.replace(/\/+$/, "");

  const scpMatch = SCP_REMOTE.exec(trimmed);
  if (scpMatch && scpMatch[1] !== undefined && scpMatch[2] !== undefined) {
    return `https://${scpMatch[1]}/${scpMatch[2].replace(/\.git$/, "")}`;
  }

  if (trimmed.startsWith("ssh://")) {
    try {
      const parsed = new URL(trimmed);
      const path = parsed.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
      return `https://${parsed.hostname}/${path}`;
    } catch {
      return trimmed.replace(/\.git$/, "");
    }
  }

  return trimmed.replace(/\.git$/, "");
}

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
  const base = normalizeRemoteToWebUrl(remoteUrl);

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
  const base = normalizeRemoteToWebUrl(remoteUrl);

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
    const scpMatch = SCP_REMOTE.exec(remoteUrl);
    return scpMatch?.[1];
  }
}
