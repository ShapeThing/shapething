import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { uploadFiles } from "./widget.tsx";

let requests: { url: string; formData: FormData }[] = [];

beforeEach(() => {
  requests = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, formData: init?.body as FormData });
      return response;
    }),
  );
}

test("uploadFiles() posts every file under the 'files' field and returns a NamedNode per returned path", async () => {
  stubFetch(new Response(JSON.stringify(["/uploads/a.png", "/uploads/b.png"]), { status: 200 }));
  const fileA = new File(["a"], "a.png", { type: "image/png" });
  const fileB = new File(["b"], "b.png", { type: "image/png" });

  const terms = await uploadFiles("/storage-service-worker", [fileA, fileB]);

  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toBe("/storage-service-worker");
  expect(requests[0]?.formData.getAll("files")).toEqual([fileA, fileB]);
  expect(terms.map((term) => term.value)).toEqual(["/uploads/a.png", "/uploads/b.png"]);
  expect(terms.every((term) => term.termType === "NamedNode")).toBe(true);
});

test("uploadFiles() throws when the endpoint responds with a non-ok status", async () => {
  stubFetch(new Response("nope", { status: 500 }));

  await expect(uploadFiles("/storage-service-worker", [new File(["a"], "a.png")])).rejects.toThrow(
    "500",
  );
});
