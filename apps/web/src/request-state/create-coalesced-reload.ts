/**
 * Egy újratöltés kéréseinek összevonója (PLAN-009 T-009-25a). A visszaadott
 * függvény hívása elindítja a betöltést, ha éppen egy sem fut; ha fut, csak
 * megjegyzi, hogy a befejezése után még EGYSZER le kell futnia. Egyszerre
 * tehát legfeljebb egy betöltés áll folyamatban, és a futása alatt érkező
 * tetszőleges számú kérés egyetlen utólagos betöltéssé olvad össze.
 *
 * **Miért kell.** A stream keretei egyenként, kihagyás nélkül érkeznek
 * (`stream-client/subscribe-to-stream-frames.ts`), tehát ha minden jelző
 * keret saját betöltést indítana, egy löketben érkező pótlás annyi kérést
 * indítana, ahány jelző keret van benne.
 *
 * **Miért nem elég a futás alatti kéréseket eldobni.** A már elküldött kérés
 * válasza nem feltétlenül tartalmazza azt a változást, amiről a futás ALATT
 * érkezett keret szól, tehát az eldobás elavult állapotot hagyna a felületen.
 * Az utólagos betöltés a sorrendet is megőrzi: a betöltések egymás után
 * futnak, tehát egy régebbi válasz sosem írhat felül egy újabbat.
 */
export function createCoalescedReload(load: () => Promise<void>): () => void {
  let isLoading = false;
  let isRequestedAgain = false;

  function request(): void {
    if (isLoading) {
      isRequestedAgain = true;
      return;
    }
    isLoading = true;
    void load().finally(() => {
      isLoading = false;
      if (isRequestedAgain) {
        isRequestedAgain = false;
        request();
      }
    });
  }

  return request;
}
