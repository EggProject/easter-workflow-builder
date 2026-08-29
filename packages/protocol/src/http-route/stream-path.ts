/**
 * Az SSE stream útvonala, szándékosan az `API_BASE_PATH` előtagon KÍVÜL
 * (SPEC-005 4.1 és 5.8 szekció). A fejlesztői Vite proxy nem továbbítja
 * rendesen az SSE kapcsolat lezárását (SPEC-005 F-10, két lezárt upstream
 * hiba: https://github.com/vitejs/vite/issues/13522,
 * https://github.com/vitejs/vite/issues/12157), tehát egy `/api` mintára írt
 * proxy szabály soha nem éri el ezt az útvonalat, akkor sem, ha valaki
 * később felveszi.
 */
export const STREAM_PATH = '/events';
