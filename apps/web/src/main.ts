// Ideiglenes, minimalis bongeszo belepesi pont, KIZAROLAG a Playwright e2e
// infrastruktura vazahoz (SPEC-001 10. szekcio) - nem a tenyleges
// alkalmazas. A valodi React 19 UI-t egy kesobbi specifikacio adja
// (SPEC-001 1. szekcio, "Amit NEM dont el": "Nem tervez UI-t"). Ez a fajl
// csak annyit csinal, hogy legyen mit betoltenie a Playwright smoke
// tesztnek (lasd e2e/smoke.spec.ts).
const root = document.querySelector<HTMLDivElement>('#root');
if (root !== null) {
  root.textContent = 'easter-workflow-builder';
}
