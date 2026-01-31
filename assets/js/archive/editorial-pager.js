(function () {
  const EDITORIALS = [
    { file: "camp-glam.html",      url: "/editorials/camp-glam.html",      title: "Camp Glam",            sub: "Tina Grimm · Joshua Tree desert mischief.",           thumb: "../assets/images/editorials/camp-glam/campglam_2x3.jpg" },
    { file: "madeline-houk.html",  url: "/editorials/madeline-houk.html",  title: "Subway Ballerina",     sub: "Madeline Houk · Hollywood underground.",            thumb: "../assets/images/editorials/madeline-houk/madeline_hero.jpg" },
    { file: "rachelpizzolato.html",url: "/editorials/rachelPizzolato.html",title: "Club James",           sub: "Rachel Pizzolato · Neon, smoke, and velvet.",       thumb: "../assets/images/editorials/rachelPizzolato/RachelPizzolato_02.jpg" },
    { file: "dani.html",           url: "/editorials/dani.html",           title: "Technicolor Dream",    sub: "Dani · Saturated color and late-night film stills.",thumb: "../assets/images/editorials/dani/Dani_Oliveira_08.jpg" },
    { file: "bella.html",          url: "/editorials/bella.html",          title: "Concrete Fever Dream", sub: "Bella Monroe · Sheats-Goldstein residence.",        thumb: "../assets/images/editorials/bellaMonroe/Bella_Monroe_Hero.jpg" },
    { file: "dasha-1.html",        url: "/editorials/dasha-1.html",        title: "Villa Blanco",         sub: "Dasha Alexandria · Desert minimalism, sharp quiet.", thumb: "../assets/images/editorials/dasha-1/dasha_hero.jpg" },
    { file: "weeses.html",         url: "/editorials/weeses.html",         title: "Water & Geometry",     sub: "Two figures · Weeses Pieces outdoor studio.",       thumb: "../assets/images/editorials/weeses/weeses_09.jpg" },
    { file: "lainey-floeck.html",  url: "/editorials/lainey-floeck.html",  title: "Monochrome Lines",     sub: "Lainey Floeck · Graphic light, strong shapes.",     thumb: "../assets/images/editorials/lainey-floeck/lainey_03.jpg" },
  ];

  function apply(card, data, label) {
    card.href = data.url;
    card.setAttribute("aria-label", `${label}: ${data.title}`);

    const title = card.querySelector(".pager-title");
    const sub = card.querySelector(".pager-sub");
    const thumb = card.querySelector(".pager-thumb");

    if (title) title.textContent = data.title;
    if (sub) sub.textContent = data.sub || "";
    if (thumb) thumb.style.backgroundImage = `url("${data.thumb}")`;
  }

  function init() {
    const prevEl = document.querySelector(".pager-prev");
    const nextEl = document.querySelector(".pager-next");
    if (!prevEl || !nextEl) return;

    const path = (window.location.pathname || "").toLowerCase();
    const currentFile = (path.split("/").pop() || "").toLowerCase();

    // Match by file name only (most robust)
    const currentIndex = EDITORIALS.findIndex(e => e.file.toLowerCase() === currentFile);

    // If not found, don’t silently fail—log once so we know what’s up.
    if (currentIndex === -1) {
      console.log("[pager] no match for:", { path, currentFile });
      return;
    }

    const prev = EDITORIALS[(currentIndex - 1 + EDITORIALS.length) % EDITORIALS.length];
    const next = EDITORIALS[(currentIndex + 1) % EDITORIALS.length];

    apply(prevEl, prev, "Previous editorial");
    apply(nextEl, next, "Next editorial");

    console.log("[pager] ok:", currentFile, "prev:", prev.file, "next:", next.file);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();