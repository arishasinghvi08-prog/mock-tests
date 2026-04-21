import React, { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

export default function App() {
  const canvasRef = useRef(null);

  const [pdf, setPdf] = useState(null);
  const [pageNum, setPageNum] = useState(1);

  const [numQuestions, setNumQuestions] = useState(0);
  const [answers, setAnswers] = useState({});
  const [answerKey, setAnswerKey] = useState({});
  const [currentQ, setCurrentQ] = useState(1);

  const [timeLeft, setTimeLeft] = useState(10800);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [mode, setMode] = useState("BITSAT");
  const [warningShown, setWarningShown] = useState(false);

  // Load PDF
  const handlePDFUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function () {
      const typedarray = new Uint8Array(this.result);
      const pdfDoc = await pdfjsLib.getDocument(typedarray).promise;
      setPdf(pdfDoc);
      setPageNum(1);
    };
    reader.readAsArrayBuffer(file);
  };

  // Render PDF
  useEffect(() => {
    const renderPage = async () => {
      if (!pdf) return;

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.2 });

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
    };

    renderPage();
  }, [pdf, pageNum]);

  // Timer + MHTCET warning
  useEffect(() => {
    if (!started || submitted) return;

    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }

    // Half-time warning for MHTCET
    if (
      mode === "MHTCET" &&
      !warningShown &&
      timeLeft <= 5400 // half of 3 hrs
    ) {
      alert("Half time over! Stay focused.");
      setWarningShown(true);
    }

    const timer = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [started, timeLeft, submitted, mode, warningShown]);

  const formatTime = (t) => {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  };

  // Answer key parser
  const handleKeyUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      const key = {};

      const matches = text.matchAll(/(\d+)\s*[\.\-\)]?\s*([A-D])/gi);

      for (const match of matches) {
        key[Number(match[1])] = match[2].toUpperCase();
      }

      setAnswerKey(key);
    };

    reader.readAsText(file);
  };

  const selectOption = (opt) => {
    setAnswers((prev) => ({ ...prev, [currentQ]: opt }));
  };

  const clearResponse = () => {
    const updated = { ...answers };
    delete updated[currentQ];
    setAnswers(updated);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setStarted(false);
  };

  const calculateScore = () => {
    let correct = 0,
      wrong = 0,
      skipped = 0;

    for (let i = 1; i <= numQuestions; i++) {
      const userAns = answers[i];
      const correctAns = answerKey[i];

      if (!userAns) skipped++;
      else if (userAns === correctAns) correct++;
      else wrong++;
    }

    return {
      correct,
      wrong,
      skipped,
      score: correct * 4 - wrong,
      accuracy: (
        correct + wrong === 0
          ? 0
          : (correct / (correct + wrong)) * 100
      ).toFixed(2),
    };
  };

  const result = submitted ? calculateScore() : null;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial" }}>
      {/* PDF */}
      <div style={{ width: "65%", padding: "10px", overflow: "auto" }}>
        <input type="file" accept="application/pdf" onChange={handlePDFUpload} />

        {pdf && (
          <div style={{ marginTop: "10px" }}>
            <button onClick={() => setPageNum((p) => Math.max(1, p - 1))}>
              ◀
            </button>
            <button onClick={() => setPageNum((p) => Math.min(pdf.numPages, p + 1))}>
              ▶
            </button>
            <span style={{ marginLeft: "10px" }}>
              Page {pageNum}/{pdf.numPages}
            </span>
          </div>
        )}

        <canvas ref={canvasRef} />
      </div>

      {/* PANEL */}
      <div style={{ width: "35%", padding: "15px", background: "#f9fafb" }}>
        <h2>⏱ {formatTime(timeLeft)}</h2>

        <div style={{ marginBottom: "10px" }}>
          <button onClick={() => setStarted(true)}>Start</button>
          <button onClick={handleSubmit}>Submit</button>
        </div>

        {/* Mode Selector */}
        <div>
          <b>Mode:</b>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{ marginLeft: "10px" }}
          >
            <option>BITSAT</option>
            <option>MHTCET</option>
          </select>
        </div>

        <hr />

        <input
          type="number"
          placeholder="No. of Questions"
          onChange={(e) => setNumQuestions(Number(e.target.value))}
        />
        <br />
        <input type="file" onChange={handleKeyUpload} />

        <hr />

        <h3>Q{currentQ}</h3>

        {["A", "B", "C", "D"].map((opt) => (
          <button
            key={opt}
            onClick={() => selectOption(opt)}
            style={{
              display: "block",
              margin: "5px 0",
              padding: "8px",
              width: "100%",
              background: answers[currentQ] === opt ? "#60a5fa" : "#e5e7eb",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {opt}
          </button>
        ))}

        <button onClick={() => setCurrentQ((q) => Math.max(1, q - 1))}>
          Prev
        </button>
        <button onClick={() => setCurrentQ((q) => Math.min(numQuestions, q + 1))}>
          Next
        </button>
        <button onClick={clearResponse}>Clear</button>

        <hr />

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "5px" }}>
          {Array.from({ length: numQuestions }, (_, i) => i + 1).map((q) => (
            <button
              key={q}
              onClick={() => setCurrentQ(q)}
              style={{
                padding: "6px",
                borderRadius: "5px",
                border: "none",
                backgroundColor: (() => {
                  if (submitted) {
                    if (!answers[q]) return "#c084fc";
                    if (answers[q] === answerKey[q]) return "#4ade80";
                    return "#f87171";
                  } else {
                    if (currentQ === q) return "#facc15";
                    if (answers[q]) return "#93c5fd";
                    return "#e5e7eb";
                  }
                })(),
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {submitted && result && (
          <div>
            <h3>Result</h3>
            <p>Score: {result.score}</p>
            <p>Correct: {result.correct}</p>
            <p>Wrong: {result.wrong}</p>
            <p>Skipped: {result.skipped}</p>
            <p>Accuracy: {result.accuracy}%</p>
          </div>
        )}
      </div>
    </div>
  );
}
