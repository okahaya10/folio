// Storage abstraction that lib/server.ts's `bucket()` currently returns
// as a raw R2Bucket. Any backend (local filesystem here, S3-compatible
// later) implements this shape so app/api/document/route.ts and
// app/api/stamp/route.ts don't need to change when the backend does.
export interface FileStorage {
  get(key: string): Promise<Uint8Array | null>;
  put(
    key: string,
    bytes: Uint8Array,
    options?: { contentType?: string },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}
