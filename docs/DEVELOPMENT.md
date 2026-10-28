# Development and deployment

## Source layout

- `src/main.tsx` contains the camera lifecycle, model initialization, inference, and interface.
- `src/styles.css` provides responsive layout and accessible focus states.
- `vite.config.ts` defines the local development server.

## Development standards

- Keep image inputs in browser memory; do not introduce upload or analytics endpoints without an explicit product/privacy review.
- Request camera permission only after user interaction and stop tracks on teardown.
- Bound frame dimensions, prompt length, inference concurrency, and generated tokens.
- Keep model IDs and Transformers.js APIs aligned with documented model cards.
- Use strict TypeScript and follow the shared [Ubaid engineering standards](../../CODE_STANDARDS.md).

## Deployment

Build static assets with `npm run build` and serve `dist/` over HTTPS. No Node.js server is needed at runtime for inference. Configure your content security policy to allow the selected Hugging Face model asset origin (and any associated model file hosts) as required by the actual deployed model files; inspect network requests before finalizing policy. Browser camera access is unavailable on insecure origins except localhost.

The repository does not contain a lockfile, automated tests, or CI pipeline. Generate and review a lockfile as part of a controlled dependency installation before deployment.
