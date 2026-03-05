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

      // Mobile hamburger menu
      const hamburger = nav.querySelector(".nav-hamburger");
      const navLinks = nav.querySelector(".nav-links");
      if (hamburger && navLinks) {
        hamburger.addEventListener("click", () => {
          const isOpen = nav.classList.toggle("nav-open");
          hamburger.setAttribute("aria-expanded", isOpen);
        });

        // Close menu when a link is tapped
        navLinks.querySelectorAll("a").forEach(link => {
          link.addEventListener("click", () => {
            nav.classList.remove("nav-open");
            hamburger.setAttribute("aria-expanded", "false");
          });
        });
      }
    })
    .catch(err => console.error("Failed to load nav:", err));
});