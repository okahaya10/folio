import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsStorage } from "../lib/storage-fs";

const root = await mkdtemp(join(tmpdir(), "folio-storage-test-"));
const storage = new FsStorage(root);

// Missing key returns null, not a throw.
assert.equal(await storage.get("tenant-a/stamp/none.png"), null);

// put/get round trip, including creating nested directories.
const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
await storage.put("tenant-a/stamp/logo.png", bytes);
const read = await storage.get("tenant-a/stamp/logo.png");
assert.ok(read);
assert.deepEqual([...read!], [...bytes]);

// Overwriting an existing key replaces its content.
await storage.put("tenant-a/stamp/logo.png", new Uint8Array([9, 9]));
assert.deepEqual([...(await storage.get("tenant-a/stamp/logo.png"))!], [9, 9]);

// delete removes it; deleting a missing key is a no-op, not a throw.
await storage.delete("tenant-a/stamp/logo.png");
assert.equal(await storage.get("tenant-a/stamp/logo.png"), null);
await storage.delete("tenant-a/stamp/logo.png");

// Two tenants' keys never collide, and deleting one doesn't affect the other.
await storage.put("tenant-a/pdf/doc.pdf", new Uint8Array([1]));
await storage.put("tenant-b/pdf/doc.pdf", new Uint8Array([2]));
await storage.delete("tenant-a/pdf/doc.pdf");
assert.equal(await storage.get("tenant-a/pdf/doc.pdf"), null);
assert.deepEqual([...(await storage.get("tenant-b/pdf/doc.pdf"))!], [2]);

// Path traversal attempts are refused rather than escaping the root.
await assert.rejects(() => storage.get("../outside.png"));
await assert.rejects(() => storage.put("../../outside.png", new Uint8Array([1])));
await assert.rejects(() => storage.get("tenant-a/../../outside.png"));

await rm(root, { recursive: true, force: true });
console.log(
  "Filesystem storage checks passed (put/get/delete round trip, missing key, tenant isolation, path traversal refused)",
);
