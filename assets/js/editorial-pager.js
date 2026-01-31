(async function () {
  const prevCard = document.querySelector(".pager-prev");
  const nextCard = document.querySelector(".pager-next");
  if (!prevCard || !nextCard) return;

  // Helpers to fill a card
  function fillCard(card, item) {
    if (!item) return;

    card.href = item.url;

    const titleEl = card.querySelector("[data-pager-title]");
    const subEl = card.querySelector("[data-pager-sub]");
    const imgEl = card.querySelector("[data-pager-img]");

    if (titleEl) titleEl.textContent = item.title || "";
    if (subEl) subEl.textContent = item.sub || "";

    if (imgEl) {
      imgEl.src = item.hero || "";
      imgEl.alt = (item.title ? `${item.title} preview` : "Editorial preview");
      imgEl.loading = "lazy";
      imgEl.decoding = "async";
    }
  }

  // Identify current page by pathname (works on a server)
  const path = window.location.pathname.toLowerCase();

  // Fetch manifest
  let manifest = [];
  try {
    const res = await fetch("/assets/data/editorials.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load editorials.json (${res.status})`);
    manifest = await res.json();
  } catch (err) {
    console.warn("[pager] manifest load failed:", err);
    return;
  }

  if (!Array.isArray(manifest) || manifest.length < 2) {
    console.warn("[pager] manifest missing/too short");
    return;
  }

  // Find current index:
  // Prefer matching by url; fallback to slug match; fallback to filename.
  const currentIndex = manifest.findIndex(item => {
    const u = (item.url || "").toLowerCase();
    const s = (item.slug || "").toLowerCase();
    return (u && path.endsWith(u)) || (s && path.includes(s));
  });

  if (currentIndex === -1) {
    console.warn("[pager] current page not found in manifest:", path);
    return;
  }

  const prevIndex = (currentIndex - 1 + manifest.length) % manifest.length;
  const nextIndex = (currentIndex + 1) % manifest.length;

  const prevItem = manifest[prevIndex];
  const nextItem = manifest[nextIndex];

  fillCard(prevCard, prevItem);
  fillCard(nextCard, nextItem);

  console.log(
    "[pager] ok",
    "current:", manifest[currentIndex]?.slug,
    "prev:", prevItem?.slug,
    "next:", nextItem?.slug
  );
})();