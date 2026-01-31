document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("nav-mount");
  if (!mount) return;

  fetch("/nav.html")
    .then(res => res.text())
    .then(html => {
      mount.innerHTML = html;

      // Add scroll behavior: shrink / blur nav on scroll
      const nav = document.getElementById("nav");
      if (!nav) return;

      const onScroll = () => {
        if (window.scrollY > 40) {
          nav.classList.add("scrolled");
        } else {
          nav.classList.remove("scrolled");
        }
      };

      onScroll(); // run once on load
      window.addEventListener("scroll", onScroll);
    })
    .catch(err => console.error("Failed to load nav:", err));
});