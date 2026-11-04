const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const ZIP64_RECORD_SIGNATURE = 0x06_06_4b_50;
const ZIP64_RECORD_SIZE = 56;
const ZIP64_LOCATOR_SIGNATURE = 0x07_06_4b_50;
const ZIP64_LOCATOR_SIZE = 20;

/**
 * Egy `buildTestZipArchive` csomag ZIP64 záró rekorddal (APPNOTE 4.3.14,
 * 4.3.15): a régi záró rekord elé kerül a ZIP64 rekord és a helymutatója, a
 * régi rekord számláló és méret mezői a "ZIP64-ben áll" jelzést (csupa 1 bit)
 * kapják. A `centralDirectorySize` felülírhatja a ZIP64 rekordba írt méretet
 * (hazudó méret). Kizárólag a `skill-endpoint` téma tesztjei használják.
 */
export function withZip64EndRecord(archive: Buffer, centralDirectorySize?: number): Buffer {
  const body = archive.subarray(0, archive.length - END_OF_CENTRAL_DIRECTORY_SIZE);
  const end = Buffer.from(archive.subarray(archive.length - END_OF_CENTRAL_DIRECTORY_SIZE));
  const entryCount = end.readUInt16LE(10);
  const declaredSize = centralDirectorySize ?? end.readUInt32LE(12);
  const centralDirectoryOffset = end.readUInt32LE(16);

  const record = Buffer.alloc(ZIP64_RECORD_SIZE);
  record.writeUInt32LE(ZIP64_RECORD_SIGNATURE, 0);
  record.writeBigUInt64LE(BigInt(ZIP64_RECORD_SIZE - 12), 4);
  record.writeUInt16LE(45, 12);
  record.writeUInt16LE(45, 14);
  record.writeBigUInt64LE(BigInt(entryCount), 24);
  record.writeBigUInt64LE(BigInt(entryCount), 32);
  record.writeBigUInt64LE(BigInt(declaredSize), 40);
  record.writeBigUInt64LE(BigInt(centralDirectoryOffset), 48);

  const locator = Buffer.alloc(ZIP64_LOCATOR_SIZE);
  locator.writeUInt32LE(ZIP64_LOCATOR_SIGNATURE, 0);
  locator.writeBigUInt64LE(BigInt(body.length), 8);
  locator.writeUInt32LE(1, 16);

  end.writeUInt16LE(0xff_ff, 8);
  end.writeUInt16LE(0xff_ff, 10);
  end.writeUInt32LE(0xff_ff_ff_ff, 12);
  end.writeUInt32LE(0xff_ff_ff_ff, 16);
  return Buffer.concat([body, record, locator, end]);
}
