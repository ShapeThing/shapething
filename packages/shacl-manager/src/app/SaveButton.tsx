import { use } from "react";
import { SaveContext } from "../data-model/dataModelContext.ts";
import { useRefreshing } from "../data-model/storeCache.ts";

export function SaveButton() {
  const { pending, saving, updating, save, discard } = use(SaveContext);
  const refreshing = useRefreshing();

  return (
    <div className="st-manager__save-area">
      <span className="st-manager__status" aria-live="polite">
        {(updating || refreshing) && "Updating…"}
      </span>
      {save && discard && pending > 0 && (
        <button
          type="button"
          className="st-button st-manager__cancel"
          disabled={saving}
          onClick={() => {
            const count = pending === 1 ? "1 change" : `${pending} changes`;
            if (confirm(`Discard ${count}? This cannot be undone.`)) discard();
          }}
        >
          Cancel
        </button>
      )}
      {save && (
        <button
          type="button"
          className="st-button st-manager__save"
          disabled={pending === 0 || saving}
          onClick={save}
        >
          {saving ? "Saving…" : "Save changes"}
          {pending > 0 && <span className="st-manager__tab-count">{pending}</span>}
        </button>
      )}
    </div>
  );
}
