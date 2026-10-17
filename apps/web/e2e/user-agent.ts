// A két rögzített felhasználói ügynök az e2e tesztekhez (PLAN-009 T-009-58,
// SPEC-008 5.10, O-31). A szerkesztő az Automatikus módosítót a
// `navigator.userAgent` `Mac` szava alapján oldja fel, ezért a billentyű
// tesztek a platformot kifejezetten rögzítik, hogy a futtató gép operációs
// rendszere ne számítson (a `devices['Desktop Chrome']` ügynöke is Windows
// jellegű, de azt a config módosítása elmozdíthatná). Az alak a Chromium
// frozen (reduced) felhasználói ügynök formátuma
// (<https://www.chromium.org/updates/ua-reduction/>); a verzió token nem
// számít, a szerkesztő csak a `Mac` szót keresi.

/**
 * macOS Chrome felhasználói ügynök: tartalmazza a `Mac` szót.
 */
export const MACOS_CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

/**
 * Windows Chrome felhasználói ügynök: nem tartalmazza a `Mac` szót.
 */
export const WINDOWS_CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
