/**
 * Mekkora legyen a `panel` a csoport tengelyén (pixelben, felfelé egészre
 * kerekítve), hogy az `element` teljes egészében látsszon: a panel mai
 * mérete plusz az, amennyivel az elem túlnyúlik a legközelebbi levágó ősén
 * (az első olyan ős az elem és a panel között, a panelt is beleértve,
 * aminek a tengely menti `overflow` értéke nem `visible`). A levágó ős
 * görgetése hozzáadódik, tehát az eredmény független attól, hová görgetett a
 * felhasználó.
 *
 * Feltevés, kimondva: a levágó ős a panellel együtt, azonos mértékben nő
 * (a futás nézetben a jóváhagyás görgethető törzse a panel teljes magasságát
 * kapja, `run-view.css`). A felfelé kerekítés azért kell, mert a böngésző a
 * `flex-basis` százalékot tört pixelre számolja, és egy a levágásnál a
 * pixel törtjével alacsonyabb panel az elem alját levágná.
 */
export function measureRevealRequirement(panel: Element, element: Element, isVertical: boolean): number {
  let clip: Element = panel;
  for (
    let ancestor = element.parentElement;
    ancestor !== null && ancestor !== panel;
    ancestor = ancestor.parentElement
  ) {
    const style = globalThis.getComputedStyle(ancestor);
    if ((isVertical ? style.overflowY : style.overflowX) !== 'visible') {
      clip = ancestor;
      break;
    }
  }
  const elementRect = element.getBoundingClientRect();
  const clipRect = clip.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const overflow = isVertical
    ? elementRect.bottom + clip.scrollTop - clipRect.bottom
    : elementRect.right + clip.scrollLeft - clipRect.right;
  return Math.ceil((isVertical ? panelRect.height : panelRect.width) + overflow);
}
