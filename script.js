document.addEventListener("DOMContentLoaded", function() {
  const revealItems = document.querySelectorAll(".reveal");
  const root = document.documentElement;
  const hero = document.querySelector(".hero");
  let ticking = false;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function updateScrollEffects() {
    ticking = false;

    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const pageProgress = clamp(window.scrollY / maxScroll, 0, 1);
    let heroProgress = 0;

    if (hero) {
      const heroHeight = Math.max(1, hero.offsetHeight);
      heroProgress = clamp(window.scrollY / heroHeight, 0, 1);
    }

    root.style.setProperty("--scroll-progress", pageProgress.toFixed(4));
    root.style.setProperty("--atmosphere-shift", `${Math.round(pageProgress * -120)}px`);
    root.style.setProperty("--hero-logo-blur", `${(heroProgress * 10).toFixed(2)}px`);
    root.style.setProperty("--hero-logo-scale", (1 - heroProgress * 0.08).toFixed(4));
    root.style.setProperty("--hero-logo-y", `${Math.round(heroProgress * -44)}px`);
    root.style.setProperty("--hero-copy-y", `${Math.round(heroProgress * 28)}px`);
  }

  function requestScrollUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateScrollEffects);
    }
  }

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach(function(item) {
      item.classList.add("is-visible");
    });
  } else {
    const observer = new IntersectionObserver(
      function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.22,
        rootMargin: "0px 0px -14% 0px"
      }
    );

    revealItems.forEach(function(item) {
      observer.observe(item);
    });
  }

  updateScrollEffects();
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate);
});
