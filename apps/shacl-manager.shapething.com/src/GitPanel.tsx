import { useEffect, useRef, useState } from "react";
import {
  httpsRemote,
  type FileChange,
  type Repository,
  type RepositoryInfo,
} from "./git/repository.ts";

// Publishing, in words without git's: the changed files are saved as a version (a commit) and, when
// the folder has an online copy (a remote), sent there (a push). A version that could not be sent
// is sent with the next publish.

type Status = { info: RepositoryInfo; changes: FileChange[]; unpublished: number };

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

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

const changeLabels: Record<FileChange["change"], string> = {
  added: "new",
  modified: "changed",
  deleted: "removed",
};

// A description that is fine to keep as is, so publishing can be one click.
const defaultDescription = (changes: FileChange[]) => {
  const names = changes.map(({ filepath }) => filepath.split("/").pop());
  return `Update ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}`;
};

// Where the online copy is, as people know it: github.com/org/repo.
const onlineLocation = (remoteUrl: string) =>
  httpsRemote(remoteUrl)
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "");

export function GitPanel({ repository, refresh }: { repository: Repository; refresh: number }) {
  const [status, setStatus] = useState<Status>();
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string>();
  const [loadError, setLoadError] = useState<string>();
  const [reload, setReload] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let current = true;
    Promise.all([repository.info(), repository.changes(), repository.unpushedCount()])
      .then(([info, changes, unpublished]) => current && setStatus({ info, changes, unpublished }))
      .catch((error: unknown) => current && setLoadError(message(error)));
    return () => {
      current = false;
    };
  }, [repository, refresh, reload]);

  if (!status) {
    return loadError ? (
      <span className="git-panel__error" role="alert" title={loadError}>
        Publishing is not available: {loadError}
      </span>
    ) : null;
  }

  const { info, changes, unpublished } = status;
  const author = { ...info.author, ...readAuthor() };
  const token = readSession(TOKEN_KEY);
  const online = info.remoteUrl ? onlineLocation(info.remoteUrl) : undefined;
  const hasChanges = changes.length > 0;
  const waiting = online ? unpublished : 0;
  const pending = changes.length + waiting;
  // Without an online copy, publishing keeps the version in the folder only.
  const action = online ? "Publish" : "Save version";

  const publish = async (data: FormData) => {
    setError(undefined);
    setPublishing(true);
    try {
      if (hasChanges) {
        const name = data.get("name") as string;
        const email = data.get("email") as string;
        try {
          localStorage.setItem(AUTHOR_KEY, JSON.stringify({ name, email }));
        } catch {}
        await repository.commit(data.get("description") as string, { name, email });
      }
      if (online) {
        const publishToken = data.get("token") as string;
        try {
          await repository.push({ token: publishToken, username: data.get("username") as string });
        } catch (error) {
          throw new Error(
            hasChanges
              ? `Your changes are kept, but could not be published yet: ${message(error)}`
              : message(error),
          );
        }
        try {
          sessionStorage.setItem(TOKEN_KEY, publishToken);
        } catch {}
      }
      dialog.current?.close();
    } catch (error) {
      setError(message(error));
    } finally {
      setPublishing(false);
      setReload((reload) => reload + 1);
    }
  };

  return (
    <div className="git-panel">
      <button
        type="button"
        className="st-button"
        disabled={pending === 0}
        title={pending === 0 ? "Everything is published" : undefined}
        onClick={() => {
          setError(undefined);
          dialog.current?.showModal();
        }}
      >
        {action}
        {pending > 0 && <span className="git-panel__count">{pending}</span>}
      </button>

      <dialog ref={dialog} className="git-dialog">
        {/* Keyed by what there is to publish, so the defaults follow it. */}
        <form
          key={`${changes.length} ${waiting}`}
          onSubmit={(event) => {
            event.preventDefault();
            publish(new FormData(event.currentTarget));
          }}
        >
          <h2>
            {action}
            {hasChanges && ` ${plural(changes.length, "changed file")}`}
          </h2>

          {hasChanges ? (
            <>
              <ul className="git-dialog__files">
                {changes.map(({ filepath, change }) => (
                  <li key={filepath} data-change={change}>
                    <span>{changeLabels[change]}</span> {filepath}
                  </li>
                ))}
              </ul>
              <label>
                What did you change?
                <textarea
                  name="description"
                  className="st-input"
                  required
                  rows={2}
                  defaultValue={defaultDescription(changes)}
                />
              </label>
              <details className="git-dialog__more" open={!author.name || !author.email}>
                <summary>
                  By{" "}
                  {author.name && (
                    <span className="app-hint">
                      {author.name} &lt;{author.email}&gt;
                    </span>
                  )}
                </summary>
                <div className="git-dialog__row">
                  <label>
                    Your name
                    <input name="name" className="st-input" required defaultValue={author.name} />
                  </label>
                  <label>
                    Your email
                    <input
                      name="email"
                      type="email"
                      className="st-input"
                      required
                      defaultValue={author.email}
                    />
                  </label>
                </div>
              </details>
            </>
          ) : (
            <p>
              {plural(waiting, "earlier change")} {waiting === 1 ? "is" : "are"} waiting to be
              published.
            </p>
          )}

          {online && (
            <details className="git-dialog__more" open={!token}>
              <summary>
                To <span className="app-hint">{online}</span>
              </summary>
              <p className="app-hint">
                Publishing needs an access token that may change {online}, such as a GitHub
                fine-grained token with the Contents permission. It is forgotten when you close this
                tab.
              </p>
              <label>
                Access token
                <input
                  name="token"
                  type="password"
                  className="st-input"
                  required
                  autoComplete="off"
                  defaultValue={token}
                />
              </label>
              <label>
                Username <span className="app-hint">(only when your host asks for one)</span>
                <input name="username" className="st-input" autoComplete="username" />
              </label>
            </details>
          )}

          {error && (
            <p className="app-error" role="alert">
              {error}
            </p>
          )}

          <div className="git-dialog__actions">
            <button type="button" className="st-button" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="st-button st-button--primary" disabled={publishing}>
              {publishing ? "Publishing…" : action}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
