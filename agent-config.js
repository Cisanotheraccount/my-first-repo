// Public endpoint configuration for the NYC Housing Guide.
// The OpenAI API key is stored only as an encrypted Cloudflare Worker secret.
window.NYC_HOUSING_GUIDE_CONFIG = Object.freeze({
  workerUrl: "https://cdw-nyc-housing-guide.cdw-nyc-housing-guide-worker.workers.dev"
});
