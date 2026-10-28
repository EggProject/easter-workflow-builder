/**
 * Bájtszám emberi olvasatra hozva, a forrás `FileUpload.jsx` `formatBytes`
 * függvénye szerint: 1024-es váltás, B az egész bájtra, KB, MB és GB egy
 * tizedesjeggyel. Hiányzó méretre üres szöveg.
 */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) {
    return '';
  }
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
