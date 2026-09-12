"use client";

import React, { useState } from "react";
import { Send, Sparkles, MapPin, Mic, MicOff, Volume2, Square } from "lucide-react";

interface ChatComposerProps {
  onSendMessage: (message: string) => Promise<void>;
  isLoading: boolean;
  needsLocation?: boolean;
}

const SAMPLE_PROMPTS = [
  { label: "Sewage overflow (Roman Urdu)", text: "Bhai yahan 3 din se gutter overflow ho raha hai." },
  { label: "Recurring streetlight", text: "Streetlight phir band hai" },
  { label: "Road repair needed", text: "Road ka masla hai." },
  { label: "English streetlight report", text: "The streetlight outside my house has been broken for two weeks." },
];

const SAMPLE_LOCATIONS = [
  "Near ABC Chowk, Sector G-9",
  "Street 14, Sector F-7/2, Islamabad",
  "Main Boulevard near Army Public School",
  "Block B Commercial Market, Sector I-8",
];

const VOICE_PRESETS = [
  { label: "Urdu Voice Note: Gutter Overflow", text: "Bhai yahan 3 din se gutter overflow ho raha hai aur ganda pani jama hai." },
  { label: "Urdu Voice Note: Streetlight Broken", text: "Streetlight phir band hai do hafte se koi nahi aya dekhne." },
  { label: "Urdu Voice Note: Pothole Outside School", text: "Main road par bada gaddha ban gaya hai school ke bache gir rahe hain." },
];

export function ChatComposer({ onSendMessage, isLoading, needsLocation }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const startVoiceRecording = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
  };

  const stopVoiceRecording = (transcript?: string) => {
    setIsRecording(false);
    if (transcript) {
      setText(transcript);
    } else if (!text) {
      setText(VOICE_PRESETS[0].text);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isLoading) return;
    const msg = text.trim();
    setText("");
    await onSendMessage(msg);
  };

  const handleChipClick = (msg: string) => {
    setText(msg);
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      {/* Suggestion Chips */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.4rem",
        marginBottom: "0.75rem",
      }}>
        {needsLocation ? (
          <>
            <span style={{ fontSize: "0.75rem", color: "var(--text-accent)", display: "flex", alignItems: "center", gap: "0.25rem", marginRight: "0.25rem", fontWeight: 600 }}>
              <MapPin size={12} /> Suggest landmark:
            </span>
            {SAMPLE_LOCATIONS.map((loc, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleChipClick(loc)}
                style={{
                  background: "var(--border-subtle)",
                  border: "1px solid var(--border-highlight)",
                  borderRadius: "var(--radius-full)",
                  color: "var(--text-accent)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.25rem 0.65rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {loc}
              </button>
            ))}
          </>
        ) : (
          <>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem", marginRight: "0.25rem", fontWeight: 600 }}>
              <Sparkles size={12} /> Try asking:
            </span>
            {SAMPLE_PROMPTS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleChipClick(p.text)}
                style={{
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-full)",
                  color: "var(--text-secondary)",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  padding: "0.25rem 0.65rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {p.label}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Voice Recording Modal / Simulation Bar */}
      {isRecording && (
        <div style={{
          background: "var(--bg-card-elevated)",
          border: "1px solid var(--accent-danger)",
          borderRadius: "var(--radius-md)",
          padding: "1rem",
          marginBottom: "0.75rem",
          boxShadow: "0 0 15px rgba(244, 63, 94, 0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#ef4444",
                boxShadow: "0 0 8px #ef4444",
                animation: "pulse 1.2s infinite",
              }} />
              <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--accent-danger)" }}>
                Recording Voice Note (Urdu / Roman Urdu / English)...
              </span>
            </div>

            <button
              type="button"
              onClick={() => stopVoiceRecording()}
              className="btn btn-primary"
              style={{
                background: "#ef4444",
                fontSize: "0.75rem",
                padding: "0.25rem 0.65rem",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              <Square size={12} fill="#ffffff" />
              Stop & Transcribe
            </button>
          </div>

          <div className="micro-label" style={{ marginBottom: "0.35rem" }}>
            Simulate realistic citizen voice notes:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {VOICE_PRESETS.map((vp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => stopVoiceRecording(vp.text)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.4rem 0.65rem",
                  color: "var(--text-primary)",
                  fontSize: "0.78rem",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <Volume2 size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                <span><strong>{vp.label}:</strong> &ldquo;{vp.text}&rdquo;</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{ position: "relative" }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={needsLocation ? "Provide your exact location or landmark..." : "Tell Awwaz what happened (English, Urdu, Roman Urdu)..."}
          disabled={isLoading}
          className="input-field"
          style={{
            paddingLeft: "2.75rem",
            paddingRight: "4rem",
            paddingTop: "0.85rem",
            paddingBottom: "0.85rem",
            fontSize: "0.95rem",
          }}
        />

        {/* Mic Toggle Button */}
        <button
          type="button"
          onClick={() => (isRecording ? stopVoiceRecording() : startVoiceRecording())}
          title={isRecording ? "Stop recording" : "Record voice note"}
          style={{
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            background: isRecording ? "rgba(239, 68, 68, 0.2)" : "transparent",
            border: isRecording ? "1px solid #ef4444" : "none",
            borderRadius: "var(--radius-full)",
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: isRecording ? "#ef4444" : "var(--text-muted)",
            transition: "all 0.15s ease",
          }}
        >
          {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !text.trim()}
          className="btn btn-primary"
          style={{
            position: "absolute",
            right: 6,
            top: 6,
            bottom: 6,
            padding: "0 1rem",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {isLoading ? (
            <span style={{ fontSize: "0.75rem" }}>Analyzing...</span>
          ) : (
            <Send size={16} />
          )}
        </button>
      </form>
      {isLoading && (
        <div style={{ fontSize: "0.75rem", color: "var(--text-accent)", marginTop: "0.35rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-primary)", display: "inline-block", boxShadow: "0 0 6px var(--accent-glow)" }} />
          Awwaz is understanding your report...
        </div>
      )}
    </div>
  );
}
