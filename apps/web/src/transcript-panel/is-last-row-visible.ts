/**
 * Az automatikus görgetés predikátuma (SPEC-008 7.4, AC40): a felhasználó
 * akkor "van az alján", ha a `react-window` `onRowsRendered` callbackje által
 * adott `visibleRows.stopIndex` a lista utolsó sora.
 *
 * Pixel küszöb nincs, és nem is lehet: egy `scrollTop + clientHeight >=
 * scrollHeight - X` alakú feltétel `X` értékére nincs forrásunk (M-71), ez a
 * predikátum pedig kizárólag a dokumentált API sorindexeiből dönt.
 */
export function isLastRowVisible(visibleRows: Readonly<{ stopIndex: number }>, rowCount: number): boolean {
  return visibleRows.stopIndex === rowCount - 1;
}
