import { useRef, useState } from "react";
import { Localized } from "@fluent/react";
import type { NamedNode } from "@rdfjs/types";
import { factory } from "@/helpers/factory.ts";
import { Close, Loading, Upload } from "@/helpers/icons.tsx";
import { st } from "@/helpers/namespaces.ts";
import { useDataGraphObjects } from "@/outputs/render/hooks/useDataGraphObjects.tsx";
import type { WidgetProps } from "@/widgets/types.ts";
import "./style.css";

/**
 * Ported from shacl-renderer's own FileUploadEditor: st:uploadUrl on the property shape names an
 * endpoint that accepts a multipart POST (field name "files") and answers with a JSON array of
 * strings - the uploaded files' resulting URLs/paths, one per file - which become this property's
 * new values. Exported (rather than inlined into the component below) so it can be unit-tested
 * against a mocked fetch without rendering anything, the same way GeoEditor's syncFromEditor is
 * tested apart from its own DOM/map setup.
 */
export async function uploadFiles(uploadUrl: string, files: Iterable<File>): Promise<NamedNode[]> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);
  const response = await fetch(uploadUrl, { method: "POST", body: formData });
  if (!response.ok) {
    throw new Error(`st:FileUploadEditor upload failed with status ${response.status}`);
  }
  const paths = (await response.json()) as string[];
  return paths.map((path) => factory.namedNode(path));
}

function fileName(iri: string): string {
  return decodeURI(iri.split(/\/|#/g).pop() ?? iri);
}

export default function FileUploadEditor({ shape, labelledBy }: WidgetProps) {
  const uploadUrl = shape.get(st("uploadUrl"))[0]?.value;
  const values = useDataGraphObjects(shape);
  const [isUploading, setIsUploading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!uploadUrl || !files || files.length === 0) return;
    setIsUploading(true);
    setFailed(false);
    try {
      for (const term of await uploadFiles(uploadUrl, files)) shape.addObject(term);
    } catch (cause) {
      console.error(cause);
      setFailed(true);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="st-file-upload-editor">
      {values.length > 0 && (
        <ul className="st-file-upload-editor__list">
          {values.map((value) => (
            <li key={value.value} className="st-file-upload-editor__item">
              <img className="st-file-upload-editor__thumbnail" src={value.value} alt="" />
              <a
                className="st-file-upload-editor__name"
                href={value.value}
                target="_blank"
                rel="noopener noreferrer"
              >
                {fileName(value.value)}
              </a>
              <Localized id="property-remove-value" attrs={{ "aria-label": true }}>
                <button
                  type="button"
                  className="st-file-upload-editor__remove"
                  aria-label="Remove value"
                  onClick={() => shape.removeObject(value)}
                >
                  <Close />
                </button>
              </Localized>
            </li>
          ))}
        </ul>
      )}
      {uploadUrl ? (
        <label
          className="st-file-upload-editor__dropzone"
          aria-labelledby={labelledBy}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
          {isUploading ? (
            <Loading />
          ) : (
            <>
              <Upload />
              <Localized id="fileupload-description">
                <span>Drag some files here or click to select files</span>
              </Localized>
            </>
          )}
        </label>
      ) : (
        <Localized id="fileupload-missing-upload-url">
          <p className="st-file-upload-editor__error" role="alert">
            Missing st:uploadUrl on the property shape
          </p>
        </Localized>
      )}
      {failed && (
        <Localized id="fileupload-error">
          <p className="st-file-upload-editor__error" role="alert">
            Upload failed
          </p>
        </Localized>
      )}
    </div>
  );
}
