// A logó SVG-t Vite alapértelmezés szerint a feloldott URL sztringként
// importálja (lásd `svg-module.d.ts`), nem nyers tartalomként: a hívó
// (`AppShell`) egy `<img src>` attribútumban használja, a topnav shell
// saját `.app-tn__brand img` szabálya szerint méretezve.
export { default as logoMarkUrl } from './logo-mark.svg';
