import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { FileStorage } from "./storage";

// Local-disk FileStorage for the Sakura VPS (replaces R2). Keys are
// always server-generated (tenant id + uuid, e.g.
// "<tenant>/stamp/<uuid>.png") but resolvePath still refuses to escape
// `root`, since a bug elsewhere putting a raw user-controlled key
// through here should fail loudly rather than write outside storage.
export class FsStorage implements FileStorage {
  private root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private resolvePath(key: string) {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error(`Refusing to access storage key outside root: ${key}`);
    }
    return full;
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.resolvePath(key)));
    } catch (e: any) {
      if (e?.code === "ENOENT") return null;
      throw e;
    }
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const path = this.resolvePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async delete(key: string): Promise<void> {
    try {
      await rm(this.resolvePath(key));
    } catch (e: any) {
      if (e?.code !== "ENOENT") throw e;
    }
  }
}
