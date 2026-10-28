import { crc32, deflateRawSync } from 'node:zlib';

/**
 * Egy szintetikus zip bejegyzés leírása. Minden fejléc mező külön állítható,
 * hogy a tesztek a SPEC-009 5.4 elutasítási ágait (szimbolikus link Unix mód,
 * titkosított jelző, ismeretlen tömörítési módszer, hazudó méret, tiltott név)
 * bináris fixtúra nélkül, a tesztben építve állíthassák elő.
 */
export interface TestZipEntry {
  // A név nyers bájtjai vagy UTF-8 szöveg (a UTF-8 jelzőt a szöveg alak kapcsolja be).
  readonly name: string | Buffer;
  readonly data: Buffer;
  // 0: tárolt, 8: deflate, minden más: a deklarált módszer, a tárolt bájtokkal.
  readonly compressionMethod: number;
  // A "version made by" mező felső bájtja a gazda rendszer (3: Unix).
  readonly versionMadeBy: number;
  readonly externalFileAttributes: number;
  readonly generalPurposeBitFlag: number;
  // A fejlécbe írt kicsomagolt méret; ha eltér a `data` hosszától, a fejléc hazudik.
  readonly declaredUncompressedSize: number;
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04_03_4b_50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02_01_4b_50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06_05_4b_50;
const UTF8_FLAG = 0x8_00;
const DEFLATE = 8;

function encodeName(name: string | Buffer): { readonly bytes: Buffer; readonly utf8Flag: number } {
  return typeof name === 'string'
    ? { bytes: Buffer.from(name, 'utf8'), utf8Flag: UTF8_FLAG }
    : { bytes: name, utf8Flag: 0 };
}

/**
 * Egy tesztben épített zip csomag (APPNOTE 4.3: helyi fejlécek, adat, központi
 * könyvtár, záró rekord), ZIP64 nélkül. Kizárólag a `skill-endpoint` téma
 * tesztjei használják; termékkód nem hívja.
 */
export function buildTestZipArchive(entries: readonly TestZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const { bytes: nameBytes, utf8Flag } = encodeName(entry.name);
    const payload = entry.compressionMethod === DEFLATE ? deflateRawSync(entry.data) : entry.data;
    const flag = entry.generalPurposeBitFlag | utf8Flag;
    const checksum = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flag, 6);
    local.writeUInt16LE(entry.compressionMethod, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.declaredUncompressedSize, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    localParts.push(local, nameBytes, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0);
    central.writeUInt16LE(entry.versionMadeBy, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flag, 8);
    central.writeUInt16LE(entry.compressionMethod, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(entry.declaredUncompressedSize, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(entry.externalFileAttributes >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);

    offset += local.length + nameBytes.length + payload.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}
