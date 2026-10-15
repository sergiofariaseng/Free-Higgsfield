import { readSignedData, signData } from "./signed-data";
export interface VideoMetadata { duration: number; }
interface Proof extends VideoMetadata { url: string; expires: number; }

/** Read the movie header from a bounded uploaded ISO BMFF/MP4 buffer.
 * Unsupported/fragmented files produce no duration, never a made-up value. */
export function mp4Metadata(bytes: ArrayBuffer): VideoMetadata | null {
  const view = new DataView(bytes);
  function boxes(start: number, end: number, nested = false): VideoMetadata | null {
    for (let offset = start; offset + 8 <= end;) {
      let size = view.getUint32(offset); let header = 8;
      const type = String.fromCharCode(...new Uint8Array(bytes, offset + 4, 4));
      if (size === 1) {
        if (offset + 16 > end) return null;
        const extended = view.getBigUint64(offset + 8);
        if (extended > BigInt(Number.MAX_SAFE_INTEGER)) return null;
        size = Number(extended); header = 16;
      } else if (size === 0) size = end - offset;
      if (size < header || offset + size > end) return null;
      const data = offset + header;
      if (type === "moov" && !nested) {
        const found = boxes(data, offset + size, true);
        if (found) return found;
      }
      if (type === "mvhd" && nested) {
        if (data + 20 > offset + size) return null;
        const version = view.getUint8(data);
        if (version !== 0 && version !== 1) return null;
        if (version === 1 && data + 32 > offset + size) return null;
        const scale = view.getUint32(data + (version ? 20 : 12));
        const ticks = version ? Number(view.getBigUint64(data + 24)) : view.getUint32(data + 16);
        const duration = ticks / scale;
        return scale > 0 && Number.isFinite(duration) && duration > 0 && duration < 86400 ? { duration } : null;
      }
      offset += size;
    }
    return null;
  }
  return boxes(0, bytes.byteLength);
}
export function videoProof(url: string, metadata: VideoMetadata): string {
  return signData("video-metadata", { ...metadata, url, expires: Date.now() + 24 * 3600_000 });
}
export function verifiedVideoMetadata(url: string, proof: unknown): VideoMetadata | null {
  const data = readSignedData<Proof>("video-metadata", proof);
  return data && data.url === url && data.expires > Date.now() && Number.isFinite(data.duration) && data.duration > 0 ? { duration: data.duration } : null;
}
