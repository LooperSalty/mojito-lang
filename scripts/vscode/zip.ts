import { crc32, deflateRawSync } from 'node:zlib';

/** Générateur minimal d'archives ZIP (format utilisé par les paquets .vsix). */

export interface ZipEntry {
  /** Chemin dans l'archive, avec des « / ». */
  readonly path: string;
  readonly data: Buffer;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;
const DEFLATE = 8;
const UTF8_FLAG = 0x0800;
const DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1; // 1er janvier 2026, date fixe : archives reproductibles

interface Packed {
  readonly name: Buffer;
  readonly compressed: Buffer;
  readonly crc: number;
  readonly size: number;
  readonly offset: number;
}

function localHeader(entry: Packed): Buffer {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(LOCAL_HEADER, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(UTF8_FLAG, 6);
  header.writeUInt16LE(DEFLATE, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(DOS_DATE, 12);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.compressed.length, 18);
  header.writeUInt32LE(entry.size, 22);
  header.writeUInt16LE(entry.name.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, entry.name]);
}

function centralHeader(entry: Packed): Buffer {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(CENTRAL_HEADER, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(UTF8_FLAG, 8);
  header.writeUInt16LE(DEFLATE, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(DOS_DATE, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.compressed.length, 20);
  header.writeUInt32LE(entry.size, 24);
  header.writeUInt16LE(entry.name.length, 28);
  header.writeUInt32LE(entry.offset, 42);
  return Buffer.concat([header, entry.name]);
}

export function createZip(entries: readonly ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const packed: Packed[] = [];
  let offset = 0;
  for (const entry of entries) {
    const item: Packed = {
      name: Buffer.from(entry.path, 'utf8'),
      compressed: deflateRawSync(entry.data),
      crc: crc32(entry.data),
      size: entry.data.length,
      offset,
    };
    const local = Buffer.concat([localHeader(item), item.compressed]);
    locals.push(local);
    packed.push(item);
    offset += local.length;
  }
  const central = Buffer.concat(packed.map(centralHeader));
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL, 0);
  end.writeUInt16LE(packed.length, 8);
  end.writeUInt16LE(packed.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}
