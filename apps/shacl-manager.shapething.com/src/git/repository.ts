import { Buffer } from "buffer";
import git from "isomorphic-git";
import web from "isomorphic-git/http/web";
import { CORS_PROXY_URL } from "../corsProxy.ts";
import { directoryHandleFs } from "./directoryHandleFs.ts";

// isomorphic-git expects Node's Buffer as a global.
globalThis.Buffer ??= Buffer;

const dir = "/";

// Only the Turtle files are content; whatever else is in the repository is left alone.
const isContent = (filepath: string) => filepath.endsWith(".ttl");

// Git hosts send no CORS headers, so every request goes through the proxy.
const http = {
  request: ({ url, headers = {}, ...rest }: Parameters<typeof web.request>[0]) => {
    const { "user-agent": _userAgent, ...forwarded } = headers;
    return web.request({
      ...rest,
      url: `${CORS_PROXY_URL}${encodeURIComponent(url)}`,
      headers: forwarded,
    });
  },
};

// git@github.com:org/repo.git can't be pushed to from a browser, its HTTPS twin can.
export const httpsRemote = (url: string): string => {
  const scpLike = url.match(/^(?:ssh:\/\/)?[^@/]+@([^:/]+)[:/](.+)$/);
  return scpLike ? `https://${scpLike[1]}/${scpLike[2]}` : url;
};

// isomorphic-git's errors are about HTTP statuses and refs; these are shown to people who don't
// know git, so they say what happened and what to do.
const OUTDATED =
  "Someone else published changes in the meantime. Get their changes into this folder first, then publish again.";

function explainPushError(error: unknown): Error {
  const { code, data } = error as {
    code?: string;
    data?: { statusCode?: number; reason?: string };
  };
  const status = data?.statusCode;
  if (status === 401 || status === 404) {
    return new Error(
      "The access token was not accepted. Check that it is valid and may change this place.",
    );
  }
  if (status === 403) return new Error("The access token may not change this place.");
  if (code === "PushRejectedError") return new Error(OUTDATED);
  return error instanceof Error ? error : new Error(String(error));
}

export type FileChange = { filepath: string; change: "added" | "modified" | "deleted" };

export type RepositoryInfo = {
  branch?: string;
  remoteUrl?: string;
  author: { name?: string; email?: string };
};

export class Repository {
  #fs: ReturnType<typeof directoryHandleFs>;

  private constructor(root: FileSystemDirectoryHandle) {
    this.#fs = directoryHandleFs(root);
  }

  // A repository when the folder has a .git folder. A .git file (a worktree or submodule) points
  // outside of the folder, which the browser can't reach.
  static async open(root: FileSystemDirectoryHandle): Promise<Repository | undefined> {
    try {
      await root.getDirectoryHandle(".git");
      return new Repository(root);
    } catch {
      return undefined;
    }
  }

  async info(): Promise<RepositoryInfo> {
    const fs = this.#fs;
    const branch = (await git.currentBranch({ fs, dir })) ?? undefined;
    const remote = branch && (await git.getConfig({ fs, dir, path: `branch.${branch}.remote` }));
    const remoteUrl = await git.getConfig({ fs, dir, path: `remote.${remote || "origin"}.url` });
    const name = await git.getConfig({ fs, dir, path: "user.name" });
    const email = await git.getConfig({ fs, dir, path: "user.email" });
    return { branch, remoteUrl, author: { name, email } };
  }

  async changes(): Promise<FileChange[]> {
    const matrix = await git.statusMatrix({ fs: this.#fs, dir, filter: isContent });
    const changes: FileChange[] = [];
    for (const [filepath, head, workdir, stage] of matrix) {
      if (head === 1 && workdir === 1 && stage === 1) continue;
      const change = workdir === 0 ? "deleted" : head === 0 ? "added" : "modified";
      changes.push({ filepath, change });
    }
    return changes;
  }

  // Stages the changed Turtle files and commits them. Returns the commit's oid.
  async commit(message: string, author: { name: string; email: string }): Promise<string> {
    const fs = this.#fs;
    for (const { filepath, change } of await this.changes()) {
      if (change === "deleted") await git.remove({ fs, dir, filepath });
      else await git.add({ fs, dir, filepath });
    }
    return git.commit({ fs, dir, message, author });
  }

  // The local commits that are not on the remote branch yet, as far as this clone knows.
  async unpushedCount(): Promise<number> {
    const fs = this.#fs;
    const branch = await git.currentBranch({ fs, dir });
    if (!branch) return 0;
    const remote = (await git.getConfig({ fs, dir, path: `branch.${branch}.remote` })) || "origin";
    // A new repository's branch has no commits yet.
    const local = await git.resolveRef({ fs, dir, ref: branch }).catch(() => undefined);
    if (!local) return 0;
    const remoteOid = await git
      .resolveRef({ fs, dir, ref: `refs/remotes/${remote}/${branch}` })
      .catch(() => undefined);
    if (local === remoteOid) return 0;
    const log = await git.log({ fs, dir, ref: branch, depth: 100 });
    const index = log.findIndex(({ oid }) => oid === remoteOid);
    return index === -1 ? log.length : index;
  }

  async push(credentials: { username?: string; token: string }): Promise<void> {
    const fs = this.#fs;
    const { branch, remoteUrl } = await this.info();
    if (!branch) throw new Error("This folder is in a state that can't be published from here.");
    if (!remoteUrl) throw new Error("This folder has no online copy to publish to.");
    const result = await git
      .push({
        fs,
        http,
        dir,
        url: httpsRemote(remoteUrl),
        ref: branch,
        // GitHub and GitLab both take a token as the password; the username is mostly ignored.
        onAuth: () => ({
          username: credentials.username || "x-access-token",
          password: credentials.token,
        }),
      })
      .catch((error: unknown) => {
        throw explainPushError(error);
      });
    if (!result.ok)
      throw new Error(
        result.error?.includes("fast-forward") ? OUTDATED : "Publishing was refused.",
      );
    // Remember what the remote now has, so unpushedCount() is right without a fetch.
    const remote = (await git.getConfig({ fs, dir, path: `branch.${branch}.remote` })) || "origin";
    await git.writeRef({
      fs,
      dir,
      ref: `refs/remotes/${remote}/${branch}`,
      value: await git.resolveRef({ fs, dir, ref: branch }),
      force: true,
    });
  }
}
