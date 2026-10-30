// Capital Street icons (Goal 25): our own hand-drawn icon set, in place of emoji. Chunky shapes in the game's palette
// with a dark navy outline, drawn on a 32 × 32 grid (Penny the piggy bank on 64 × 64). The same set is in the Figma
// file (Capital Street — Game UI, page "Icons").
// IC('farm') gives the HTML for one icon; the sprite is added to the page once.
'use strict';
(function () {
  const O = '#0a0f2e';
  const P = { blue: '#4c8dff', blue2: '#2a5fd6', sky: '#9fd8ff', green: '#45d483', green2: '#1fa35b', gold: '#ffd21f', gold2: '#f0a400', orange: '#ff8a3d', red: '#ff5d5d', pink: '#ff8fb1', purple: '#a35cff', brown: '#b0703c', brown2: '#7a4a28', grey: '#c3cad6', grey2: '#7d8798', white: '#ffffff', cream: '#fff3d6', teal: '#2fd0c0' };
  const I = {
    // ---- jobs and places ----
    chart: `<rect x="4" y="4" width="24" height="24" rx="5" fill="${P.white}"/><path d="M8 21l5-6 4 3 7-9" fill="none" stroke-width="3"/><circle cx="24" cy="9" r="2.5" fill="${P.green}"/>`,
    building: `<rect x="7" y="5" width="18" height="23" rx="2" fill="${P.blue}"/><path d="M11 9h3v3h-3zM18 9h3v3h-3zM11 15h3v3h-3zM18 15h3v3h-3z" fill="${P.sky}"/><rect x="13.5" y="21" width="5" height="7" fill="${P.gold}"/>`,
    tag: `<path d="M5 5h11l11 11-11 11L5 16z" fill="${P.gold}"/><circle cx="11" cy="11" r="2.5" fill="${P.white}"/>`,
    gavel: `<rect x="5" y="24" width="15" height="4" rx="1.5" fill="${P.brown2}"/><path d="M13 13l11 11" stroke-width="4"/><path d="M13 13l11 11" stroke="${P.brown}" stroke-width="2"/><rect x="8" y="4" width="9" height="13" rx="2" transform="rotate(-45 12.5 10.5)" fill="${P.brown}"/>`,
    land: `<path d="M3 23l13-7 13 7-13 7z" fill="${P.green}"/><path d="M16 4c-4 0-5 4-5 6 0 3 2 5 5 5s5-2 5-5c0-2-1-6-5-6z" fill="${P.green2}"/><path d="M16 15v6" stroke-width="2.5"/>`,
    farm: `<path d="M4 15l12-9 12 9v13H4z" fill="${P.red}"/><path d="M4 15l12-9 12 9" fill="none" stroke-width="2.5"/><rect x="12" y="18" width="8" height="10" fill="${P.white}"/><path d="M12 18l8 10M20 18l-8 10" stroke-width="1.6"/><path d="M13 11h6" stroke-width="2"/>`,
    ship: `<path d="M3 19h26l-4 8H7z" fill="${P.blue}"/><rect x="8" y="12" width="7" height="7" fill="${P.orange}"/><rect x="15" y="9" width="7" height="10" fill="${P.gold}"/><rect x="22" y="13" width="4" height="6" fill="${P.green}"/><path d="M5 30c2-1 4-1 6 0s4 1 6 0 4-1 6 0 4 1 6 0" fill="none" stroke="${P.sky}" stroke-width="2"/>`,
    company: `<path d="M4 11L16 4l12 7z" fill="${P.gold}"/><rect x="4" y="25" width="24" height="4" fill="${P.gold}"/><path d="M8 12v12M13 12v12M19 12v12M24 12v12" stroke-width="3"/><path d="M8 12v12M13 12v12M19 12v12M24 12v12" stroke="${P.white}" stroke-width="1.4"/>`,
    office: `<rect x="4" y="10" width="24" height="17" rx="3" fill="${P.brown}"/><path d="M12 10V7a2 2 0 012-2h4a2 2 0 012 2v3" fill="none" stroke-width="2.5"/><path d="M4 17h24" stroke-width="2"/><rect x="14" y="15" width="4" height="5" rx="1" fill="${P.gold}"/>`,
    bank: `<path d="M3 12L16 4l13 8z" fill="${P.gold}"/><rect x="5" y="25" width="22" height="4" fill="${P.gold}"/><rect x="7" y="13" width="3.5" height="11" fill="${P.white}"/><rect x="14.25" y="13" width="3.5" height="11" fill="${P.white}"/><rect x="21.5" y="13" width="3.5" height="11" fill="${P.white}"/>`,
    key: `<circle cx="11" cy="11" r="7" fill="${P.gold}"/><circle cx="11" cy="11" r="2.5" fill="${P.white}"/><path d="M15.5 15.5L27 27M22 22l3-3M25 25l2-2" stroke-width="3"/>`,
    news: `<rect x="4" y="5" width="21" height="22" rx="2" fill="${P.white}"/><path d="M25 10h3v15a2 2 0 01-4 0" fill="${P.grey}"/><rect x="8" y="9" width="13" height="5" fill="${P.red}"/><path d="M8 18h13M8 22h9" stroke-width="2"/>`,
    crane: `<path d="M9 29V5M9 5h18M9 9l6-4" fill="none" stroke-width="3"/><path d="M9 29V5M9 5h18" fill="none" stroke="${P.gold}" stroke-width="1.4"/><path d="M23 5v9" stroke-width="1.6"/><rect x="20" y="14" width="6" height="5" fill="${P.orange}"/><rect x="5" y="26" width="8" height="3" fill="${P.grey2}"/>`,
    trade: `<path d="M5 11h17l-4-5M27 21H10l4 5" fill="none" stroke-width="3.2"/><path d="M5 11h17l-4-5M27 21H10l4 5" fill="none" stroke="${P.green}" stroke-width="1.4"/>`,
    hire: `<circle cx="13" cy="10" r="5" fill="${P.cream}"/><path d="M4 27c0-6 4-9 9-9s9 3 9 9z" fill="${P.blue}"/><circle cx="24" cy="21" r="6" fill="${P.green}"/><path d="M24 18v6M21 21h6" stroke="${P.white}" stroke-width="2.4"/>`,
    mine: `<path d="M6 10c5-5 15-5 20 0" fill="none" stroke-width="4"/><path d="M6 10c5-5 15-5 20 0" fill="none" stroke="${P.grey}" stroke-width="2"/><path d="M16 7l-6 21" stroke-width="3.4"/><path d="M16 7l-6 21" stroke="${P.brown}" stroke-width="1.6"/><path d="M18 25l4-5 6 3-2 6h-7z" fill="${P.grey2}"/>`,
    oil: `<path d="M16 4L8 28M16 4l8 24M10 21h12M12 14h8" fill="none" stroke-width="2.5"/><path d="M5 28h22" stroke-width="3"/><path d="M24 9c-2 3-3 4-3 6a3 3 0 006 0c0-2-1-3-3-6z" fill="#2c2f36"/>`,
    shop: `<rect x="5" y="14" width="22" height="14" fill="${P.white}"/><path d="M4 8h24l-1 6c-1 2-4 2-5 0-1 2-4 2-5 0-1 2-4 2-5 0-1 2-4 2-5 0-1 2-4 2-5 0z" fill="${P.red}"/><rect x="9" y="18" width="6" height="10" fill="${P.blue}"/><rect x="18" y="18" width="6" height="5" fill="${P.sky}"/>`,
    truck: `<rect x="3" y="9" width="16" height="13" rx="1" fill="${P.orange}"/><path d="M19 13h5l4 5v4h-9z" fill="${P.blue}"/><circle cx="9" cy="24" r="3" fill="${P.grey2}"/><circle cx="23" cy="24" r="3" fill="${P.grey2}"/>`,
    plane: `<path d="M4 18l9-2 6-11c1-2 4-1 3 1l-3 9 8 1 2-3h2l-1 6-12 3-6 5h-3l2-5z" fill="${P.white}"/>`,
    close: `<path d="M9 9l14 14M23 9L9 23" stroke-width="4"/><path d="M9 9l14 14M23 9L9 23" stroke="${P.white}" stroke-width="1.6"/>`,
    lock: `<path d="M10 14v-4a6 6 0 0112 0v4" fill="none" stroke-width="3"/><rect x="6" y="14" width="20" height="14" rx="3" fill="${P.gold}"/><circle cx="16" cy="20" r="2" fill="${O}"/><path d="M16 21v3" stroke-width="2"/>`,
    coin: `<circle cx="16" cy="16" r="12" fill="${P.gold}"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="${P.gold2}" stroke-width="1.6"/><path d="M19 12.5c-1-1-2-1.5-3-1.5-2 0-3 1-3 2.3 0 3 6 1.7 6 4.7 0 1.3-1 2.5-3 2.5-1.2 0-2.4-.5-3.2-1.5M16 9v2M16 21v2" fill="none" stroke-width="2"/>`,
    star: `<path d="M16 3l4 8.5 9 1.2-6.6 6.3 1.7 9L16 23.6 7.9 28l1.7-9L3 12.7l9-1.2z" fill="${P.gold}"/>`,
    skyline: `<rect x="3" y="14" width="7" height="15" fill="${P.blue}"/><rect x="10" y="5" width="8" height="24" fill="${P.purple}"/><rect x="18" y="10" width="6" height="19" fill="${P.teal}"/><rect x="24" y="17" width="5" height="12" fill="${P.orange}"/><path d="M13 9h2M13 13h2M13 17h2M13 21h2" stroke="${P.white}" stroke-width="1.6"/><path d="M14 5V2" stroke-width="2"/>`,
    hammer: `<path d="M14 12l12 12" stroke-width="4.5"/><path d="M14 12l12 12" stroke="${P.brown}" stroke-width="2.4"/><path d="M6 10l6-6 6 6-3 3-2-2-4 4z" fill="${P.grey}"/>`,
    // ---- goods ----
    wheat: `<path d="M16 29V9" stroke-width="2.5"/><path d="M16 10c-3-1-4-4-4-6 3 0 5 2 4 6zM16 10c3-1 4-4 4-6-3 0-5 2-4 6zM16 16c-3-1-5-3-5-6 3 0 5 3 5 6zM16 16c3-1 5-3 5-6-3 0-5 3-5 6zM16 22c-3-1-5-3-5-6 3 0 5 3 5 6zM16 22c3-1 5-3 5-6-3 0-5 3-5 6z" fill="${P.gold}"/>`,
    ore: `<path d="M4 22l5-10 8-4 9 5 2 10-8 5H9z" fill="${P.grey2}"/><path d="M12 14l3 3M19 13l2 4M10 21l3-1M20 22l3 1" stroke="${P.orange}" stroke-width="2.4"/>`,
    barrel: `<rect x="8" y="4" width="16" height="24" rx="4" fill="${P.blue2}"/><path d="M8 11h16M8 21h16" stroke-width="2"/><path d="M16 13c-2 3-3 4-3 5.5a3 3 0 006 0c0-1.5-1-2.5-3-5.5z" fill="#2c2f36"/>`,
    box: `<path d="M4 10l12-5 12 5v14l-12 5-12-5z" fill="${P.brown}"/><path d="M4 10l12 5 12-5M16 15v14" fill="none" stroke-width="2"/><path d="M9 7.8l12 5" stroke="${P.cream}" stroke-width="2"/>`,
    beam: `<path d="M3 11h26v4H3zM3 21h26v4H3z" fill="${P.grey}"/><rect x="13" y="15" width="6" height="6" fill="${P.grey2}"/><path d="M3 11h26M3 25h26" stroke-width="2"/>`,
    fuel: `<path d="M7 9l4-4h11v23H7z" fill="${P.red}"/><rect x="17" y="2" width="6" height="4" fill="${P.grey2}"/><path d="M11 14l7 9M18 14l-7 9" stroke="${P.white}" stroke-width="2"/>`,
    gear: `<path d="M14 3h4l1 4 3 1.5 3.5-2 3 3-2 3.5L28 16l-.5 3-4 1-1.5 3 2 3.5-3 3-3.5-2-3 1.5-1 4h-4l-1-4-3-1.5-3.5 2-3-3 2-3.5L4 18v-4l4-1 1.5-3-2-3.5 3-3 3.5 2L13 4z" fill="${P.grey}"/><circle cx="16" cy="16" r="4.5" fill="${P.white}"/>`,
    // ---- office furniture ----
    desk: `<rect x="5" y="5" width="22" height="14" rx="2" fill="${P.blue2}"/><rect x="8" y="8" width="16" height="8" fill="${P.sky}"/><path d="M16 19v5M10 27h12" stroke-width="3"/>`,
    tdesk: `<rect x="3" y="6" width="26" height="15" rx="2" fill="#24304f"/><path d="M7 17l5-5 4 3 6-6 3 2" fill="none" stroke="${P.green}" stroke-width="2.4"/><path d="M16 21v4M9 28h14" stroke-width="3"/>`,
    table: `<ellipse cx="16" cy="13" rx="13" ry="6" fill="${P.brown}"/><path d="M8 17v10M24 17v10M16 19v9" stroke-width="3"/>`,
    plant: `<path d="M9 19h14l-2 10H11z" fill="${P.orange}"/><path d="M16 19c0-6-4-9-9-9 0 5 3 9 9 9zM16 19c0-7 4-12 10-12 0 6-3 12-10 12z" fill="${P.green}"/>`,
    coffee: `<path d="M6 11h16v9a7 7 0 01-7 7h-2a7 7 0 01-7-7z" fill="${P.white}"/><path d="M22 13h2a3 3 0 010 6h-2" fill="none" stroke-width="2.4"/><path d="M11 4c-1 2 1 3 0 5M16 4c-1 2 1 3 0 5" fill="none" stroke-width="2"/>`,
    cooler: `<path d="M10 3h12l-1 9H11z" fill="${P.sky}"/><rect x="9" y="12" width="14" height="17" rx="2" fill="${P.white}"/><rect x="13" y="16" width="6" height="3" fill="${P.blue}"/>`,
    sofa: `<rect x="6" y="9" width="20" height="10" rx="3" fill="${P.purple}"/><rect x="3" y="14" width="26" height="9" rx="3" fill="${P.purple}"/><path d="M6 23v4M26 23v4" stroke-width="3"/><path d="M8 18h16" stroke-width="2"/>`,
    pingpong: `<circle cx="12" cy="13" r="8" fill="${P.red}"/><path d="M17 19l8 8" stroke-width="4"/><path d="M17 19l8 8" stroke="${P.brown}" stroke-width="2"/><circle cx="25" cy="8" r="3" fill="${P.white}"/>`,
    rug: `<rect x="4" y="8" width="24" height="16" rx="2" fill="${P.red}"/><rect x="8" y="12" width="16" height="8" fill="${P.gold}"/><path d="M4 12H1M4 20H1M28 12h3M28 20h3" stroke-width="2"/>`,
    books: `<rect x="5" y="6" width="5" height="22" fill="${P.red}"/><rect x="10" y="9" width="5" height="19" fill="${P.blue}"/><rect x="15" y="5" width="5" height="23" fill="${P.green}"/><path d="M21 9l5-1 3 20-5 1z" fill="${P.gold}"/>`,
    bricks: `<rect x="3" y="6" width="26" height="20" fill="${P.red}"/><path d="M3 12.7h26M3 19.3h26M10 6v6.7M22 6v6.7M16 12.7v6.6M8 19.3V26M24 19.3V26" stroke-width="2"/>`,
    server: `<rect x="7" y="3" width="18" height="26" rx="2" fill="#24304f"/><path d="M7 11h18M7 19h18" stroke-width="2"/><circle cx="11" cy="7" r="1.4" fill="${P.green}"/><circle cx="11" cy="15" r="1.4" fill="${P.green}"/><circle cx="11" cy="23" r="1.4" fill="${P.gold}"/>`,
    tv: `<rect x="3" y="6" width="26" height="17" rx="2" fill="#24304f"/><rect x="6" y="9" width="20" height="11" fill="${P.red}"/><path d="M8 17h12" stroke="${P.white}" stroke-width="2"/><path d="M12 27h8M16 23v4" stroke-width="2.5"/>`,
    snow: `<path d="M16 3v26M5 9.5l22 13M5 22.5l22-13" stroke-width="3.6"/><path d="M16 3v26M5 9.5l22 13M5 22.5l22-13" stroke="${P.sky}" stroke-width="1.6"/>`,
    sun: `<circle cx="16" cy="16" r="7" fill="${P.gold}"/><path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M26 6l-3 3M9 23l-3 3" stroke-width="2.6"/>`,
    leaf: `<path d="M6 26C6 13 14 6 27 5c0 13-7 21-21 21z" fill="${P.orange}"/><path d="M6 26L20 12" stroke-width="2"/>`,
    sprout: `<path d="M16 28V15" stroke-width="2.6"/><path d="M16 17c-6 0-9-4-9-9 6 0 9 4 9 9zM16 15c0-5 3-9 9-9 0 5-3 9-9 9z" fill="${P.green}"/><path d="M9 28h14" stroke-width="2.6"/>`,
    trash: `<path d="M7 9h18l-2 19H9z" fill="${P.grey}"/><path d="M5 9h22M13 5h6M13 13v11M19 13v11" stroke-width="2.4"/>`,
    sea: `<path d="M3 18c3-3 6-3 8 0s5 3 8 0 6-3 8 0 4 3 2 3H3z" fill="${P.blue}"/><path d="M4 26c3-2 5-2 8 0s5 2 8 0 5-2 8 0" fill="none" stroke-width="2"/>`
  };
  // Penny, the piggy bank who runs the tutorial
  const penny = `<symbol id="ic-penny" viewBox="0 0 64 64"><g stroke="${O}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M14 44l-2 10h7l2-7M42 47l2 7h7l-2-10" fill="#f48fb1"/>
    <ellipse cx="33" cy="34" rx="24" ry="18" fill="#ff9fc0"/>
    <path d="M18 22l-3-11 10 6M40 18l7-8 1 11" fill="#f48fb1"/>
    <rect x="25" y="15" width="14" height="4" rx="2" fill="${O}"/>
    <ellipse cx="11" cy="36" rx="6" ry="5" fill="#f48fb1"/><circle cx="9.5" cy="35.5" r="1.1" fill="${O}" stroke="none"/><circle cx="12.5" cy="35.5" r="1.1" fill="${O}" stroke="none"/>
    <circle cx="21" cy="28" r="3.4" fill="#fff"/><circle cx="22" cy="28.5" r="1.7" fill="${O}" stroke="none"/>
    <path d="M17 42c3 3 7 3 10 1" fill="none"/>
    <path d="M57 32c4-1 5 3 2 4" fill="none"/>
    <circle cx="44" cy="30" r="6" fill="${P.gold}"/><path d="M44 27v6" stroke-width="2"/></g></symbol>`;
  const sym = (id, body) => `<symbol id="ic-${id}" viewBox="0 0 32 32"><g stroke="${O}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</g></symbol>`;
  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${Object.entries(I).map(([k, v]) => sym(k, v)).join('')}${penny}</svg>`;
  const add = () => document.body.insertAdjacentHTML('afterbegin', sprite);
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
  window.ICONS = Object.keys(I).concat('penny');
  window.ICON_SVG = I; // for the Figma export
  window.IC = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#ic-${name}"/></svg>`;
})();
