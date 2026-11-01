/**
 * This service worker simulates a storage compatible with SHACL renderer and storage abstraction.
 */
importScripts("localforage.min.js");

self.addEventListener("fetch", async function (event) {
  if (
    event.request.url.includes("storage-service-worker") &&
    !event.request.url.includes("wsrv.nl")
  ) {
    if (event.request.method === "POST") {
      return event.respondWith(
        (async () => {
          const data = await event.request.formData();
          const files = data.getAll("files");
          const cleanedFiles = [];
          for (const file of files) {
            const cleanedFile = event.request.url + encodeURIComponent(file.name);
            await localforage.setItem(cleanedFile, file);
            cleanedFiles.push(cleanedFile);
          }

          return new Response(JSON.stringify(cleanedFiles));
        })(),
      );
    }

    if (event.request.method === "GET") {
      return event.respondWith(
        (async () => {
          const file = await localforage.getItem(event.request.url);

          if (!file) throw "File not found inside cache";

          return new Response(file, {
            headers: {
              ContentType: file.type,
            },
          });
        })(),
      );
    }

    if (event.request.method === "DELETE") {
      return event.respondWith(
        (async () => {
          await localforage.removeItem(event.request.url);
          return new Response(JSON.stringify({ success: true }));
        })(),
      );
    }
  }
});
