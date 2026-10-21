import { put, del } from '@vercel/blob';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

// Thin wrapper over Vercel Blob. STORAGE_DRIVER=local (test harness only) writes to
// public/__test_uploads/ instead, so test runs never touch the production Blob store.
const LOCAL_PREFIX = '/__test_uploads/';
const isLocal = () => process.env.STORAGE_DRIVER === 'local';
const localDir = () => path.join(process.cwd(), 'public', '__test_uploads');

export async function putFile(filename: string, file: File): Promise<string> {
  if (isLocal()) {
    await mkdir(localDir(), { recursive: true });
    await writeFile(path.join(localDir(), path.basename(filename)), Buffer.from(await file.arrayBuffer()));
    return `${LOCAL_PREFIX}${path.basename(filename)}`;
  }
  const { url } = await put(filename, file, { access: 'public' });
  return url;
}

export async function delFiles(urls: string[]): Promise<void> {
  if (isLocal()) {
    await Promise.all(
      urls
        .filter(u => u.startsWith(LOCAL_PREFIX))
        .map(u => unlink(path.join(localDir(), path.basename(u))).catch(() => {})),
    );
    return;
  }
  await del(urls);
}
