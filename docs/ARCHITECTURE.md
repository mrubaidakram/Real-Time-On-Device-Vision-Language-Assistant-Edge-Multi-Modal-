# Architecture, data flow, and privacy

## Data flow

The user grants browser camera access. A React video element displays the `MediaStream`; on demand, a canvas draws a downscaled frame into browser memory. Transformers.js converts the frame and question to model inputs, then runs Moondream in the browser. The result is rendered as text in the UI.

There is no application API server, frame upload, telemetry endpoint, or remote image storage in this code. On first model load, the browser does fetch tokenizer/model assets from Hugging Face and caches them according to browser policy. Browser extensions, the hosting provider, and the model asset host are outside this code's control.

## Resource controls

- Still-frame dimension is bounded to 384 pixels on the longest edge.
- Only one inference runs at a time.
- Live mode samples at 2.5-second intervals and drops a tick if a previous inference is still running.
- Inference requests generate at most 96 new tokens.
- Camera tracks are stopped when the user stops the camera and when the component unmounts.

## Browser support

WebGPU is selected when the browser exposes `navigator.gpu`; otherwise the app asks Transformers.js to use `wasm`. Hardware, browser driver, and memory limits affect model loading and speed. Production deployments should be served over HTTPS and should review model licensing, model provenance, and Hugging Face availability for their use case.
