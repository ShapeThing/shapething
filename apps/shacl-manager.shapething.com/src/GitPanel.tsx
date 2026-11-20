import { useEffect, useRef, useState } from "react";
import type { FileChange, Repository, RepositoryInfo } from "./git/repository.ts";

type Status = { info: RepositoryInfo; changes: FileChange[]; unpushed: number };

// Remembered for the browser tab only: closing it forgets the token.
const TOKEN_KEY = "shacl-manager:git-token";
const AUTHOR_KEY = "shacl-manager:git-author";

const readSession = (key: string) => {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};

const readAuthor = (): { name?: string; email?: string } => {
  try {
    return JSON.parse(localStorage.getItem(AUTHOR_KEY) ?? "{}");
  } catch {
    return {};
  }
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function GitPanel({ repository, refresh }: { repository: Repository; refresh: number }) {
  const [status, setStatus] = useState<Status>();
  const [busy, setBusy] = useState<"commit" | "push">();
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);
  const commitDialog = useRef<HTMLDialogElement>(null);
  const pushDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let current = true;
    Promise.all([repository.info(), repository.changes(), repository.unpushedCount()])
      .then(([info, changes, unpushed]) => current && setStatus({ info, changes, unpushed }))
      .catch((error: unknown) => current && setError(String(error)));
    return () => {
      current = false;
    };
  }, [repository, refresh, reload]);

  const run = async (kind: "commit" | "push", action: () => Promise<unknown>) => {
    setBusy(kind);
    setError(undefined);
    try {
      await action();
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setBusy(undefined);
      setReload((reload) => reload + 1);
    }
  };

  if (!status) {
    return error ? (
      <span className="git-panel__error" role="alert" title={error}>
        git: {error}
      </span>
    ) : (
      <span className="git-panel git-panel--loading">git…</span>
    );
  }
  const { info, changes, unpushed } = status;
  const author = { ...info.author, ...readAuthor() };

  return (
    <div className="git-panel">
      <span className="git-panel__branch" title={info.remoteUrl}>
        {info.branch ?? "detached"}
      </span>
      <button
        type="button"
        className="st-button"
        disabled={changes.length === 0 || busy !== undefined}
        onClick={() => commitDialog.current?.showModal()}
      >
        {busy === "commit" ? "Committing…" : "Commit"}
        {changes.length > 0 && <span className="git-panel__count">{changes.length}</span>}
      </button>
      <button
        type="button"
        className="st-button"
        disabled={unpushed === 0 || !info.remoteUrl || busy !== undefined}
        onClick={() => pushDialog.current?.showModal()}
      >
        {busy === "push" ? "Pushing…" : "Push"}
        {unpushed > 0 && <span className="git-panel__count">{unpushed}</span>}
      </button>
      {error && (
        <span className="git-panel__error" role="alert" title={error}>
          {error}
        </span>
      )}

      <dialog ref={commitDialog} className="git-dialog">
        <form
          method="dialog"
          onSubmit={(event) => {
            const data = new FormData(event.currentTarget);
            const name = data.get("name") as string;
            const email = data.get("email") as string;
            try {
              localStorage.setItem(AUTHOR_KEY, JSON.stringify({ name, email }));
            } catch {}
            run("commit", () => repository.commit(data.get("message") as string, { name, email }));
            event.currentTarget.reset();
          }}
        >
          <h2>Commit {plural(changes.length, "changed file")}</h2>
          <ul className="git-dialog__files">
            {changes.map(({ filepath, change }) => (
              <li key={filepath} data-change={change}>
                <span>{change}</span> {filepath}
              </li>
            ))}
          </ul>
          <label>
            Message
            <textarea name="message" className="st-input" required rows={3} />
          </label>
          <div className="git-dialog__row">
            <label>
              Name
              <input name="name" className="st-input" required defaultValue={author.name} />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                className="st-input"
                required
                defaultValue={author.email}
              />
            </label>
          </div>
          <div className="git-dialog__actions">
            <button
              type="button"
              className="st-button"
              onClick={() => commitDialog.current?.close()}
            >
              Cancel
            </button>
            <button type="submit" className="st-button st-button--primary">
              Commit
            </button>
          </div>
        </form>
      </dialog>

      <dialog ref={pushDialog} className="git-dialog">
        <form
          method="dialog"
          onSubmit={(event) => {
            const data = new FormData(event.currentTarget);
            const token = data.get("token") as string;
            const username = data.get("username") as string;
            run("push", () => repository.push({ token, username })).then((pushed) => {
              try {
                if (pushed) sessionStorage.setItem(TOKEN_KEY, token);
              } catch {}
            });
          }}
        >
          <h2>Push {plural(unpushed, "commit")}</h2>
          <p className="app-hint">
            To <code>{info.remoteUrl}</code>, branch <code>{info.branch}</code>. Pushing from the
            browser needs an access token with write access to the repository, such as a GitHub
            fine-grained token with the Contents permission. It is kept for this tab only.
          </p>
          <label>
            Access token
            <input
              name="token"
              type="password"
              className="st-input"
              required
              autoComplete="off"
              defaultValue={readSession(TOKEN_KEY)}
            />
          </label>
          <label>
            Username <span className="app-hint">(optional, some hosts need it)</span>
            <input name="username" className="st-input" autoComplete="username" />
          </label>
          <div className="git-dialog__actions">
            <button type="button" className="st-button" onClick={() => pushDialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="st-button st-button--primary">
              Push
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
