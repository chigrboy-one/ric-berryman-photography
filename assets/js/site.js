
  // Disable right-click everywhere except form fields
  document.addEventListener("contextmenu", (e) => {
    if (e.target.closest("input, textarea, [contenteditable]")) return;
    e.preventDefault();
  });

  // Disable image dragging
  document.addEventListener("dragstart", (e) => {
    const t = e.target;
    if (t && (t.tagName === "IMG" || t.closest("img"))) {
      e.preventDefault();
    }
  });



  // =========================
// Home Slider
// =========================
(function(){
  const track = document.getElementById("homeSliderTrack");
  const prev = document.getElementById("homeSliderPrev");
  const next = document.getElementById("homeSliderNext");
  const dotsWrap = document.getElementById("homeSliderDots");
  if (!track || !prev || !next || !dotsWrap) return;

  const slides = Array.from(track.querySelectorAll(".home-slide"));
  let i = 0;
  let timer = null;

  // build dots
  dotsWrap.innerHTML = "";
  const dots = slides.map((_, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.addEventListener("click", () => go(idx));
    dotsWrap.appendChild(b);
    return b;
  });

  function render(){
    track.style.transform = `translateX(${-i * 100}%)`;
    dots.forEach((d, idx) => d.classList.toggle("is-active", idx === i));
  }

  function go(idx){
    i = (idx + slides.length) % slides.length;
    render();
    restart();
  }

  function step(dir){
    go(i + dir);
  }

  function restart(){
    clearInterval(timer);
    timer = setInterval(() => step(1), 6500);
  }

  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));

  // pause on hover (desktop)
  track.addEventListener("mouseenter", () => clearInterval(timer));
  track.addEventListener("mouseleave", restart);

  // simple swipe (mobile)
  let x0 = null;
  track.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, {passive:true});
  track.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const x1 = e.changedTouches[0].clientX;
    const dx = x1 - x0;
    if (Math.abs(dx) > 40) step(dx > 0 ? -1 : 1);
    x0 = null;
  }, {passive:true});

  render();
  restart();
})();