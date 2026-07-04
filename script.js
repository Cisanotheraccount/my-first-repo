document.addEventListener("DOMContentLoaded", function () {
  document.body.classList.add("js-ready");

  const button = document.getElementById("demoButton");
  const messageArea = document.getElementById("messageDisplay");
  const revealItems = document.querySelectorAll("main > *");

  if (button && messageArea) {
    button.addEventListener("click", function () {
      const currentTime = new Date().toLocaleTimeString();
      messageArea.textContent = "Hello! You clicked the button at " + currentTime;
      button.textContent = "Thanks for clicking!";

      setTimeout(function () {
        button.textContent = "Click Me!";
      }, 2000);
    });
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    revealItems.forEach(function (item) {
      observer.observe(item);
    });
  } else {
    revealItems.forEach(function (item) {
      item.classList.add("is-visible");
    });
  }
});
