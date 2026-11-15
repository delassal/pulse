import { get, put } from "@vercel/blob";

/**
 * JSON persistence in the project's private Vercel Blob store, shared by the daily jobs
 * (flight crawl, travel advisory tracking). Needs BLOB_READ_WRITE_TOKEN, which Vercel
 * sets once a Blob store is connected to the project.
 */

export function isBlobStoreConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export async function readJson<T>(pathname: string): Promise<T | null> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return (await new Response(result.stream).json()) as T;
}

export async function writeJson(pathname: string, data: unknown) {
  await put(pathname, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
