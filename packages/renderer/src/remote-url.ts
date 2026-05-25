export function normalizeGitRemote(remoteUrl: string): string | undefined {
  const scpMatch = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/.exec(remoteUrl);
  if (scpMatch?.[1] !== undefined && scpMatch[2] !== undefined) {
    return `https://github.com/${scpMatch[1]}/${scpMatch[2]}`;
  }

  const sshMatch = /^ssh:\/\/git@github\.com\/([^/]+)\/(.+?)(?:\.git)?$/.exec(remoteUrl);
  if (sshMatch?.[1] !== undefined && sshMatch[2] !== undefined) {
    return `https://github.com/${sshMatch[1]}/${sshMatch[2]}`;
  }

  if (remoteUrl.startsWith("http://") || remoteUrl.startsWith("https://")) {
    return remoteUrl.replace(/\.git$/, "");
  }

  return undefined;
}
