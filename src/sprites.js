/* SHEETS_SPRITES — the unit drawings the two tools letter their pages with.

   Both the berthing sheets and the diagram analyser show the fleet at the
   top of the page, and a second copy of six kilobytes of SVG would drift
   from the first the moment one of them was corrected. So they live here
   and both builds include this file.

   One <svg> per class, drawn to the same 132x32 box so a row of them lines
   up on the rail. Nothing here knows anything about either page: it is
   handed a class and gives back markup. */
"use strict";
const SHEETS_SPRITES = (() => {
function sprite(cls) {
  const wheels =
    '<circle cx="20" cy="27" r="3" fill="#23282C"/>' +
    '<circle cx="32" cy="27" r="3" fill="#23282C"/>' +
    '<circle cx="100" cy="27" r="3" fill="#23282C"/>' +
    '<circle cx="112" cy="27" r="3" fill="#23282C"/>';
  const rail = '<rect x="0" y="30" width="132" height="1.2" fill="#5A6169"/>';
  if (cls === "395") {
    return '<svg viewBox="0 0 132 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Class 395 Javelin">' +
      '<path d="M4 6 a3 3 0 0 1 3-3 h103 l18 15 v5 a1.5 1.5 0 0 1-1.5 1.5 h-119.5 a3 3 0 0 1-3-3 z" fill="#26356B" stroke="#8FA0CE" stroke-width="0.9"/>' +
      '<path d="M113 3 l15 15 v4.6 a1.5 1.5 0 0 1-1.5 1.5 h-6.5 l-16-21 z" fill="#F5C400"/>' +
      '<rect x="10" y="8" width="92" height="5.4" rx="1.4" fill="#8FA0CE"/>' +
      '<rect x="4" y="19" width="110" height="2.4" fill="#E8EAF2"/>' +
      '<rect x="46" y="7" width="5" height="14" fill="#1B2751"/>' +
      '<rect x="78" y="7" width="5" height="14" fill="#1B2751"/>' +
      wheels + rail + "</svg>";
  }
  if (cls === "377") {
    // 377 Electrostar in Southern's white and green, as the 377/5s run here
    return '<svg viewBox="0 0 132 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Class 377 Electrostar">' +
      '<path d="M4 8 a4 4 0 0 1 4-4 h110 l10 7 v10 a3 3 0 0 1-3 3 h-117 a4 4 0 0 1-4-4 z" fill="#F2F3F1" stroke="#B9BDB6" stroke-width="1"/>' +
      '<path d="M4.5 17.5 h113.5 l6 4.2 v1.3 a3 3 0 0 1-3 3 h-116.5 a4 4 0 0 1-4-4 z" fill="#2F8A4C"/>' +
      '<rect x="4.5" y="16.2" width="113" height="1.6" fill="#8CCB9B"/>' +
      '<path d="M118 4 l10 7 v10 a3 3 0 0 1-3 3 h-7 v-20 z" fill="#FFD335"/>' +
      '<rect x="4" y="6" width="112" height="2.4" fill="#C8CBC4"/>' +
      '<rect x="10" y="9.6" width="102" height="6" rx="1.6" fill="#3A4348"/>' +
      '<rect x="40" y="9" width="8" height="15" fill="#5FAF7A"/>' +
      '<rect x="88" y="9" width="8" height="15" fill="#5FAF7A"/>' +
      wheels + rail + "</svg>";
  }
  if (cls === "376") {
    // 376 metro Electrostar: the flatter cab, a lighter window band, doors everywhere
    return '<svg viewBox="0 0 132 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Class 376 Electrostar">' +
      '<path d="M4 8 a4 4 0 0 1 4-4 h114 l6 4 v13 a3 3 0 0 1-3 3 h-117 a4 4 0 0 1-4-4 z" fill="#24346E" stroke="#8FA0CE" stroke-width="0.9"/>' +
      '<path d="M120 4 l6 4 v13 a3 3 0 0 1-3 3 h-3 v-20 z" fill="#FFD335"/>' +
      '<rect x="4" y="6" width="116" height="2.6" fill="#18244F"/>' +
      '<rect x="10" y="10" width="108" height="6.4" rx="1.6" fill="#B3C0E6"/>' +
      '<rect x="26" y="9" width="7" height="15" fill="#3D4F94"/>' +
      '<rect x="50" y="9" width="7" height="15" fill="#3D4F94"/>' +
      '<rect x="74" y="9" width="7" height="15" fill="#3D4F94"/>' +
      '<rect x="98" y="9" width="7" height="15" fill="#3D4F94"/>' +
      wheels + rail + "</svg>";
  }
  if (cls === "466") {
    // 466 Networker: the two-car, so a shorter body than the 465
    return '<svg viewBox="0 0 132 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Class 466 Networker">' +
      '<path d="M18 8 a4 4 0 0 1 4-4 h98 a8 8 0 0 1 8 8 v10 a3 3 0 0 1-3 3 h-103 a4 4 0 0 1-4-4 z" fill="#F2F3F1" stroke="#B9BDB6" stroke-width="1"/>' +
      '<path d="M120 4 a8 8 0 0 1 8 8 v10 a3 3 0 0 1-3 3 h-7 v-21 z" fill="#FFD335"/>' +
      '<rect x="18" y="6" width="100" height="2.6" fill="#C8CBC4"/>' +
      '<rect x="24" y="10" width="90" height="6" rx="1.6" fill="#3A4348"/>' +
      '<rect x="44" y="9" width="9" height="15" fill="#AEB4AE"/>' +
      '<rect x="54" y="9" width="9" height="15" fill="#AEB4AE"/>' +
      '<rect x="84" y="9" width="9" height="15" fill="#AEB4AE"/>' +
      '<rect x="94" y="9" width="9" height="15" fill="#AEB4AE"/>' +
      '<circle cx="34" cy="27" r="3" fill="#23282C"/><circle cx="46" cy="27" r="3" fill="#23282C"/>' +
      '<circle cx="100" cy="27" r="3" fill="#23282C"/><circle cx="112" cy="27" r="3" fill="#23282C"/>' +
      rail + "</svg>";
  }
  if (cls === "707") {
    // 707 Desiro City: the big curved windscreen and no yellow panel; pale doors
    return '<svg viewBox="0 0 132 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Class 707 Desiro City">' +
      '<path d="M4 8 a4 4 0 0 1 4-4 h102 c10 0 18 6 18 15 v2 a3 3 0 0 1-3 3 h-117 a4 4 0 0 1-4-4 z" fill="#24346E" stroke="#8FA0CE" stroke-width="0.9"/>' +
      '<path d="M107 7 c9 .5 15.5 6 16.5 13 h-3.8 c-1 -5.4 -6.2 -9.2 -12.7 -9.2 z" fill="#9DACD9"/>' +
      '<rect x="4" y="6" width="103" height="2.6" fill="#18244F"/>' +
      '<rect x="10" y="10" width="97" height="6.4" rx="1.6" fill="#9DACD9"/>' +
      '<rect x="28" y="9" width="7" height="15" fill="#F0D66A"/>' +
      '<rect x="52" y="9" width="7" height="15" fill="#F0D66A"/>' +
      '<rect x="76" y="9" width="7" height="15" fill="#F0D66A"/>' +
      '<rect x="98" y="9" width="7" height="15" fill="#F0D66A"/>' +
      '<rect x="112" y="19.5" width="9" height="1.8" fill="#F5C400"/>' +
      wheels + rail + "</svg>";
  }
  if (cls === "465") {
    return '<svg viewBox="0 0 132 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Class 465 Networker">' +
      '<path d="M4 8 a4 4 0 0 1 4-4 h112 a8 8 0 0 1 8 8 v10 a3 3 0 0 1-3 3 h-117 a4 4 0 0 1-4-4 z" fill="#F2F3F1" stroke="#B9BDB6" stroke-width="1"/>' +
      '<path d="M120 4 a8 8 0 0 1 8 8 v10 a3 3 0 0 1-3 3 h-7 v-21 z" fill="#FFD335"/>' +
      '<rect x="4" y="6" width="114" height="2.6" fill="#C8CBC4"/>' +
      '<rect x="10" y="10" width="104" height="6" rx="1.6" fill="#3A4348"/>' +
      '<rect x="34" y="9" width="9" height="15" fill="#AEB4AE"/>' +
      '<rect x="44" y="9" width="9" height="15" fill="#AEB4AE"/>' +
      '<rect x="84" y="9" width="9" height="15" fill="#AEB4AE"/>' +
      '<rect x="94" y="9" width="9" height="15" fill="#AEB4AE"/>' +
      wheels + rail + "</svg>";
  }
  // 375 Electrostar - Southeastern's dark blue livery, yellow warning end
  return '<svg viewBox="0 0 132 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Class 375 Electrostar">' +
    '<path d="M4 8 a4 4 0 0 1 4-4 h110 l10 7 v10 a3 3 0 0 1-3 3 h-117 a4 4 0 0 1-4-4 z" fill="#24346E" stroke="#8FA0CE" stroke-width="0.9"/>' +
    '<path d="M118 4 l10 7 v10 a3 3 0 0 1-3 3 h-7 v-20 z" fill="#FFD335"/>' +
    '<rect x="4" y="6" width="112" height="2.6" fill="#18244F"/>' +
    '<rect x="10" y="10" width="102" height="6.4" rx="1.6" fill="#9DACD9"/>' +
    '<rect x="40" y="9" width="8" height="15" fill="#3D4F94"/>' +
    '<rect x="88" y="9" width="8" height="15" fill="#3D4F94"/>' +
    wheels + rail + "</svg>";
}

return { sprite };
})();
if (typeof module !== "undefined" && module.exports) module.exports = SHEETS_SPRITES;
if (typeof globalThis !== "undefined") globalThis.SHEETS_SPRITES = SHEETS_SPRITES;
