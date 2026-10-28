import React from "react";
import { createRoot } from "react-dom/client";
import { AutoProcessor, AutoTokenizer, Moondream1ForConditionalGeneration, RawImage } from "@huggingface/transformers";
import "./styles.css";

const MODEL_ID = "Xenova/moondream2";
const MAX_IMAGE_EDGE = 384;

type AssistantRuntime = {
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>;
  tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
  model: Awaited<ReturnType<typeof Moondream1ForConditionalGeneration.from_pretrained>>;
};

function App(): React.JSX.Element {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const runtimeRef = React.useRef<AssistantRuntime | null>(null);
  const busyRef = React.useRef(false);
  const [status, setStatus] = React.useState("Model not loaded");
  const [answer, setAnswer] = React.useState("");
  const [question, setQuestion] = React.useState("Describe the main things you can see.");
  const [modelReady, setModelReady] = React.useState(false);
  const [cameraReady, setCameraReady] = React.useState(false);
  const [live, setLive] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const loadModel = async (): Promise<void> => {
    setError("");
    setStatus("Loading model files into browser cache…");
    try {
      const device: "webgpu" | "wasm" = "gpu" in navigator ? "webgpu" : "wasm";
      const [processor, tokenizer, model] = await Promise.all([
        AutoProcessor.from_pretrained(MODEL_ID),
        AutoTokenizer.from_pretrained(MODEL_ID),
        Moondream1ForConditionalGeneration.from_pretrained(MODEL_ID, {
          device,
          dtype: { embed_tokens: "fp16", vision_encoder: "fp16", decoder_model_merged: "q4" },
        }),
      ]);
      runtimeRef.current = { processor, tokenizer, model };
      setModelReady(true);
      setStatus(`Model ready on ${device === "webgpu" ? "WebGPU" : "WebAssembly CPU"}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Model could not be loaded.");
      setStatus("Model load failed");
    }
  };

  const startCamera = async (): Promise<void> => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not provide camera access. Use localhost or HTTPS in a supported browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Camera permission was denied or unavailable.");
    }
  };

  const stopCamera = (): void => {
    setLive(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  };

  const analyzeFrame = async (): Promise<void> => {
    const runtime = runtimeRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!runtime || !video || !canvas || busyRef.current || video.videoWidth === 0) return;
    busyRef.current = true;
    setError("");
    setStatus("Analyzing the current frame locally…");
    try {
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas is unavailable in this browser.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = RawImage.fromCanvas(canvas);
      const prompt = `<image>\n\nQuestion: ${question.slice(0, 500)}\n\nAnswer:`;
      const textInputs = runtime.tokenizer(prompt);
      const visionInputs = await runtime.processor(image);
      const output = await runtime.model.generate({ ...textInputs, ...visionInputs, do_sample: false, max_new_tokens: 96 });
      const decoded = runtime.tokenizer.batch_decode(output, { skip_special_tokens: true });
      const response = decoded[0]?.trim();
      if (!response) throw new Error("The model returned an empty response.");
      setAnswer(response);
      setStatus("Frame analyzed locally");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inference failed.");
      setStatus("Analysis failed");
      setLive(false);
    } finally {
      busyRef.current = false;
    }
  };

  React.useEffect(() => {
    if (!live || !cameraReady || !modelReady) return undefined;
    const timer = window.setInterval(() => void analyzeFrame(), 2500);
    return () => window.clearInterval(timer);
  }, [live, cameraReady, modelReady, question]);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">E</div>
        <div><p className="eyebrow">EDGE MULTIMODAL</p><h1>Vision Assistant</h1></div>
        <span className="privacy-pill"><span /> Local inference</span>
      </header>

      <section className="intro">
        <p className="eyebrow">PRIVATE BY DESIGN</p>
        <h2>Ask about what your camera sees.</h2>
        <p>Camera frames are analyzed in this browser. Model files are downloaded once and cached by the browser.</p>
      </section>

      <section className="workspace" aria-label="Vision assistant workspace">
        <div className="camera-card">
          <div className="camera-view">
            <video ref={videoRef} autoPlay muted playsInline aria-label="Local camera preview" />
            {!cameraReady && <div className="empty-camera"><span className="camera-icon">◎</span><p>Camera preview appears here</p><small>Camera access starts only when you choose it.</small></div>}
            <canvas ref={canvasRef} className="capture-canvas" aria-hidden="true" />
            <div className="camera-label"><span className={cameraReady ? "dot active" : "dot"} />{cameraReady ? "CAMERA ACTIVE" : "CAMERA OFF"}</div>
          </div>
          <div className="camera-controls">
            {!cameraReady ? <button className="button primary" onClick={() => void startCamera()}>Enable camera</button> : <button className="button secondary" onClick={stopCamera}>Stop camera</button>}
            <label className="live-toggle"><input type="checkbox" checked={live} onChange={(event) => setLive(event.target.checked)} disabled={!cameraReady || !modelReady} /><span className="toggle-track" /><span>Live scan every 2.5 sec</span></label>
          </div>
        </div>

        <div className="assistant-card">
          <div className="card-heading"><div><p className="eyebrow">ASK THE MODEL</p><h3>Frame analysis</h3></div><span className="status-tag">{status}</span></div>
          <label className="field-label" htmlFor="question">Your question</label>
          <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} rows={3} placeholder="What is in this scene?" />
          <div className="action-row">
            {!modelReady ? <button className="button primary" onClick={() => void loadModel()}>Load local model</button> : <button className="button primary" onClick={() => void analyzeFrame()} disabled={!cameraReady || !question.trim()}>Analyze frame</button>}
            <span className="runtime-hint">Moondream 2 · WebGPU when available</span>
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
          <div className="answer-box" aria-live="polite"><p className="eyebrow">ASSISTANT RESPONSE</p><p>{answer || "Your frame description will appear here."}</p></div>
          <p className="privacy-note">Nothing in the camera frame is uploaded by this app. Model files come from Hugging Face on first load.</p>
        </div>
      </section>
      <footer><span>ON DEVICE · BROWSER BASED</span><span>Camera access is controlled by you</span></footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
