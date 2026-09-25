type ZipSource = {
  objectKey: string;
  archiveName: string;
  createdAt: string;
};

type MediaBucket = {
  get(key: string): Promise<{ body: ReadableStream<Uint8Array> } | null>;
};

type CentralEntry = {
  name: Uint8Array;
  crc: number;
  size: number;
  offset: bigint;
  time: number;
  date: number;
};

const encoder = new TextEncoder();
const UINT32_MAX = 0xffffffffn;
const crcTable = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  crcTable[index] = value >>> 0;
}

function writeUint64(view: DataView, offset: number, value: bigint) {
  view.setUint32(offset, Number(value & UINT32_MAX), true);
  view.setUint32(offset + 4, Number((value >> 32n) & UINT32_MAX), true);
}

function crc32Update(state: number, bytes: Uint8Array) {
  let value = state;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return value >>> 0;
}

function dosDateTime(value: string) {
  const parsed = new Date(value);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

function localHeader(name: Uint8Array, time: number, date: number) {
  const bytes = new Uint8Array(30 + name.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0808, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, time, true);
  view.setUint16(12, date, true);
  view.setUint16(26, name.length, true);
  bytes.set(name, 30);
  return bytes;
}

function dataDescriptor(crc: number, size: number) {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc, true);
  view.setUint32(8, size, true);
  view.setUint32(12, size, true);
  return bytes;
}

function centralHeader(entry: CentralEntry) {
  const needsZip64Offset = entry.offset > UINT32_MAX;
  const extraLength = needsZip64Offset ? 12 : 0;
  const bytes = new Uint8Array(46 + entry.name.length + extraLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, needsZip64Offset ? 45 : 20, true);
  view.setUint16(6, needsZip64Offset ? 45 : 20, true);
  view.setUint16(8, 0x0808, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, entry.time, true);
  view.setUint16(14, entry.date, true);
  view.setUint32(16, entry.crc, true);
  view.setUint32(20, entry.size, true);
  view.setUint32(24, entry.size, true);
  view.setUint16(28, entry.name.length, true);
  view.setUint16(30, extraLength, true);
  view.setUint32(42, needsZip64Offset ? 0xffffffff : Number(entry.offset), true);
  bytes.set(entry.name, 46);
  if (needsZip64Offset) {
    const extraOffset = 46 + entry.name.length;
    view.setUint16(extraOffset, 0x0001, true);
    view.setUint16(extraOffset + 2, 8, true);
    writeUint64(view, extraOffset + 4, entry.offset);
  }
  return bytes;
}

function zip64Ending(entryCount: number, centralSize: bigint, centralOffset: bigint, zip64Offset: bigint) {
  const record = new Uint8Array(56);
  const recordView = new DataView(record.buffer);
  recordView.setUint32(0, 0x06064b50, true);
  writeUint64(recordView, 4, 44n);
  recordView.setUint16(12, 45, true);
  recordView.setUint16(14, 45, true);
  writeUint64(recordView, 24, BigInt(entryCount));
  writeUint64(recordView, 32, BigInt(entryCount));
  writeUint64(recordView, 40, centralSize);
  writeUint64(recordView, 48, centralOffset);

  const locator = new Uint8Array(20);
  const locatorView = new DataView(locator.buffer);
  locatorView.setUint32(0, 0x07064b50, true);
  writeUint64(locatorView, 8, zip64Offset);
  locatorView.setUint32(16, 1, true);
  return [record, locator];
}

function endOfCentralDirectory(entryCount: number, centralSize: bigint, centralOffset: bigint, zip64: boolean) {
  const bytes = new Uint8Array(22);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, zip64 ? 0xffff : entryCount, true);
  view.setUint16(10, zip64 ? 0xffff : entryCount, true);
  view.setUint32(12, zip64 ? 0xffffffff : Number(centralSize), true);
  view.setUint32(16, zip64 ? 0xffffffff : Number(centralOffset), true);
  return bytes;
}

export function createZipStream(entries: ZipSource[], bucket: MediaBucket) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const centralEntries: CentralEntry[] = [];
        let archiveOffset = 0n;

        for (const entry of entries) {
          const object = await bucket.get(entry.objectKey);
          if (!object) continue;

          const name = encoder.encode(entry.archiveName);
          const { time, date } = dosDateTime(entry.createdAt);
          const header = localHeader(name, time, date);
          const localOffset = archiveOffset;
          controller.enqueue(header);
          archiveOffset += BigInt(header.length);

          const reader = object.body.getReader();
          let crcState = 0xffffffff;
          let size = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            crcState = crc32Update(crcState, value);
            size += value.length;
            if (size > Number(UINT32_MAX)) throw new Error("A media file is too large for this archive");
            controller.enqueue(value);
            archiveOffset += BigInt(value.length);
          }

          const crc = (crcState ^ 0xffffffff) >>> 0;
          const descriptor = dataDescriptor(crc, size);
          controller.enqueue(descriptor);
          archiveOffset += BigInt(descriptor.length);
          centralEntries.push({ name, crc, size, offset: localOffset, time, date });
        }

        const centralOffset = archiveOffset;
        let centralSize = 0n;
        for (const entry of centralEntries) {
          const header = centralHeader(entry);
          controller.enqueue(header);
          centralSize += BigInt(header.length);
          archiveOffset += BigInt(header.length);
        }

        const zip64 = centralEntries.length >= 0xffff || centralSize > UINT32_MAX || centralOffset > UINT32_MAX || centralEntries.some((entry) => entry.offset > UINT32_MAX);
        if (zip64) {
          const [record, locator] = zip64Ending(centralEntries.length, centralSize, centralOffset, archiveOffset);
          controller.enqueue(record);
          controller.enqueue(locator);
        }
        controller.enqueue(endOfCentralDirectory(centralEntries.length, centralSize, centralOffset, zip64));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
