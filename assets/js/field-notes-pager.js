(async function () {
  const mount = document.getElementById("field-notes-pager");
  if (!mount) return;

  // Get current slug from URL: /field-notes/<slug>.html
  const path = window.location.pathname;
  const file = path.split("/").pop() || "";
  const slug = file.replace(/\.html$/i, "");

  // Load list
  const res = await fetch("/assets/data/field_notes.json", { cache: "no-store" });
  const posts = await res.json();

  const idx = posts.findIndex(p => p.slug === slug);
  if (idx === -1) {
    // If slug not found, don’t render anything.
    return;
  }

  const prev = posts[(idx - 1 + posts.length) % posts.length];
  const next = posts[(idx + 1) % posts.length];

  const card = (p, dir) => {
    const href = `/field-notes/${p.slug}.html`;
    const kicker = dir === "prev" ? "Previous Field Note" : "Next Field Note";
    const arrow = dir === "prev" ? "← Previous" : "Next →";
    const imgAlt = `${p.title} preview`;

    // Image optional: if thumb is missing, it still looks fine.
    const img = p.thumb
      ? `<div class="pager-image"><img src="/${p.thumb}" alt="${imgAlt}"></div>`
      : `<div class="pager-image pager-image--empty" aria-hidden="true"></div>`;

    // Layout matches your “text outside / image inside” vibe
    if (dir === "prev") {
      return `
        <a href="${href}" class="pager-card pager-prev">
          <div class="pager-text">
            <div class="pager-kicker">${kicker}</div>
            <div class="pager-title">${p.title}</div>
            <div class="pager-sub">${p.deck || ""}</div>
            <div class="pager-arrow">${arrow}</div>
          </div>
          ${img}
        </a>
      `;
    }

    return `
      <a href="${href}" class="pager-card pager-next">
        ${img}
        <div class="pager-text">
          <div class="pager-kicker">${kicker}</div>
          <div class="pager-title">${p.title}</div>
          <div class="pager-sub">${p.deck || ""}</div>
          <div class="pager-arrow">${arrow}</div>
        </div>
      </a>
    `;
  };

  mount.innerHTML = `
    ${card(prev, "prev")}
    ${card(next, "next")}
  `;
})();