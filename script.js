document.addEventListener("DOMContentLoaded", function () {
  document.body.classList.add("js-ready");

  const button = document.getElementById("demoButton");
  const messageArea = document.getElementById("messageDisplay");
  const revealItems = document.querySelectorAll(".reveal");

  const messages = [
    "Large spacing makes the page feel calmer before any interaction begins.",
    "The glass cards use soft transparency, thin borders, and shadow instead of heavy decoration.",
    "Motion stays subtle: it supports the reading rhythm without becoming the main subject."
  ];

  let messageIndex = 0;

  button.addEventListener("click", function () {
    messageArea.textContent = messages[messageIndex];
    messageArea.classList.add("is-active");
    button.textContent = "Show another note";
    messageIndex = (messageIndex + 1) % messages.length;
  });

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealItems.forEach(function (item) {
    observer.observe(item);
  });
});
