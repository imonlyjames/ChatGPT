import React, { useEffect, useRef, useState } from "react";
import { parseCustomerNames, runParserTests, DEMO_MANIFEST } from "./parse.js";

export default function App() {
  const [images, setImages] = useState([]);
  const [ocrText, setOcrText] = useState("");
  const [names, setNames] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [skipMode, setSkipMode] = useState("contains"); // 'contains' | 'standalone'
  const inputRef = useRef(null);

  useEffect(() => {
    // auto-run tests once
    runParserTests();
  }, []);

  async function ensureTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      s.onload = res; s.onerror = () => rej(new Error("tesseract load failed"));
      document.head.appendChild(s);
    });
    return window.Tesseract;
  }

  const fileToDataURL = (file) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result || ""));
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  async function ocrImage(dataURL, i, total) {
    const T = await ensureTesseract();
    const res = await T.recognize(dataURL, "eng", {
      logger: (m) => {
        if (m?.progress != null) {
          const base = (i / total) * 100;
          const span = (1 / total) * 100;
          setProgress(Math.min(100, Math.round(base + span * m.progress * 100)));
        }
      },
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });
    return res?.data?.text || "";
  }

  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setImages(files.map(f => f.name));
    setRunning(true);
    setProgress(0);
    let text = "";
    for (let i = 0; i < files.length; i++) {
      try {
        const url = await fileToDataURL(files[i]);
        text += (await ocrImage(url, i, files.length)) + "\n";
      } catch (err) {
        console.warn("OCR failed for", files[i]?.name, err);
      }
    }
    setOcrText(text.trim());
    const parsed = parseCustomerNames(text, { skipMode });
    setNames(parsed);
    setRunning(false);
    setProgress(100);
  }

  function parseFromText() {
    const parsed = parseCustomerNames(ocrText, { skipMode });
    setNames(parsed);
  }

  async function copyNames() {
    try {
      await navigator.clipboard.writeText(names.join("\n"));
      alert("Names copied");
    } catch {
      alert("Copy failed");
    }
  }

  function downloadNames() {
    const a = document.createElement("a");
    a.href = "data:text/plain;charset=utf-8," + encodeURIComponent(names.join("\n"));
    a.download = "customer-names.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="wrap">
      <h2>Swift Routes — Step 1: OCR → Customer Names</h2>

      <div className="box">
        <h3>Upload Manifest Photo(s)</h3>
        <div className="row">
          <button className="btn" onClick={() => inputRef.current?.click()}>Select Images</button>
          <input ref={inputRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: "none" }} />
          {running && (<><progress max="100" value={progress}></progress><span>{progress}%</span></>)}
          {!!images.length && <span style={{opacity:.7,fontSize:12}}>Files: {images.join(", ")}</span>}
        </div>
      </div>

      <div className="box">
        <h3>OCR Text (optional paste/edit)</h3>
        <div className="row">
          <button className="btn" onClick={() => { setOcrText(DEMO_MANIFEST); setNames([]); }}>Load Demo Text</button>
          <label> Skip Mode:
            <select value={skipMode} onChange={e => setSkipMode(e.target.value)} style={{ marginLeft: 6 }}>
              <option value="contains">skip if word is anywhere</option>
              <option value="standalone">skip only whole-word lines</option>
            </select>
          </label>
          <button className="btn" onClick={parseFromText}>Parse Names</button>
        </div>
        <textarea
          rows={6}
          placeholder="(After OCR, text appears here. You can also paste raw manifest text and click Parse.)"
          value={ocrText}
          onChange={(e) => setOcrText(e.target.value)}
          style={{ width: "100%", marginTop: 8 }}
        />
      </div>

      <div className="box">
        <h3>Customer Names</h3>
        <div className="row">
          <button className="btn" onClick={copyNames} disabled={!names.length}>Copy</button>
          <button className="btn" onClick={downloadNames} disabled={!names.length}>Download</button>
          <span style={{opacity:.7,fontSize:12}}>Count: {names.length}</span>
        </div>
        {names.length > 0 && (
          <ul>{names.map((n, i) => <li key={i}>{n}</li>)}</ul>
        )}
      </div>

      <details>
        <summary>Diagnostics</summary>
        <pre style={{whiteSpace:"pre-wrap",fontFamily:"monospace",fontSize:12}}>
{`Images: ${images.length}
Progress: ${progress}%
Names: ${names.length}`}
        </pre>
      </details>
    </div>
  );
}
