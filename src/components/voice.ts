"use client";
import { GoogleGenAI, Modality, Type, type LiveServerMessage, type Session } from "@google/genai";
import type { Lang } from "@/lib/types";

export type VoiceState = "idle" | "connecting" | "listening" | "speaking" | "working" | "error";

interface Handlers {
  onState: (s: VoiceState, note?: string) => void;
  onUserText: (text: string, final: boolean) => void;
  onModelText: (text: string, final: boolean) => void;
  onTool: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const LANG_NAME: Record<Lang, string> = { en: "English", hi: "Hindi", te: "Telugu" };
const SPEECH_LANG: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", te: "te-IN" };

const WORKLET = `class Mic extends AudioWorkletProcessor{constructor(){super();this.buf=[]}process(i){const c=i[0]&&i[0][0];if(c){for(let k=0;k<c.length;k++)this.buf.push(c[k]);if(this.buf.length>=1600){this.port.postMessage(new Float32Array(this.buf));this.buf=[]}}return true}}registerProcessor('mic',Mic)`;

function toBase64PCM(f: Float32Array): string {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) out[i] = Math.max(-1, Math.min(1, f[i])) * 0x7fff;
  const bytes = new Uint8Array(out.buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Voice lane: a Gemini Live session in the browser, using a short-lived token from our server. */
export class LiveVoice {
  private session: Session | null = null;
  private micCtx: AudioContext | null = null;
  private outCtx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private playAt = 0;
  private sources: AudioBufferSourceNode[] = [];
  private userBuf = "";
  private modelBuf = "";
  private recog: { stop: () => void } | null = null;
  mode: "gemini-live" | "browser" = "gemini-live";

  constructor(private h: Handlers) {}

  async start(lang: Lang) {
    this.h.onState("connecting");
    let token: string | null = null;
    let models: string[] = [];
    try {
      const r = await fetch("/api/live-token", { method: "POST" });
      const j = await r.json();
      if (r.ok && j.token) { token = j.token; models = j.models ?? []; }
    } catch { /* fall back below */ }
    if (!token) return this.startBrowser(lang);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      this.outCtx = new AudioContext({ sampleRate: 24000 });
      const client = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });
      let lastErr: unknown;
      for (const model of models) {
        try {
          this.session = await this.connect(client, model, lang);
          break;
        } catch (e) { lastErr = e; }
      }
      if (!this.session) throw lastErr ?? new Error("no live model");
      this.micCtx = new AudioContext({ sampleRate: 16000 });
      const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      await this.micCtx.audioWorklet.addModule(url);
      const src = this.micCtx.createMediaStreamSource(this.stream);
      const node = new AudioWorkletNode(this.micCtx, "mic");
      node.port.onmessage = (e) => {
        this.session?.sendRealtimeInput({ audio: { data: toBase64PCM(e.data as Float32Array), mimeType: "audio/pcm;rate=16000" } });
      };
      src.connect(node);
      this.mode = "gemini-live";
    } catch (e) {
      console.warn("Gemini Live failed, using browser voice", e);
      this.cleanup();
      return this.startBrowser(lang);
    }
  }

  private connect(client: GoogleGenAI, model: string, lang: Lang): Promise<Session> {
    return client.live.connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are Jarvis, the voice of a personal agent in India. Speak naturally and briefly, like a helpful friend. Reply in the language the user speaks; default ${LANG_NAME[lang]}.
For anything that needs doing or looking up (email, calendar, WhatsApp, reminders, memory, bookings, web search), call run_task with the user's request in their own words, then tell them the result in one or two sentences.
If run_task says an approval is needed, read the exact content back briefly and ask "Should I go ahead?". If the user says yes (haan, avunu, ok, go ahead), call approve_pending. If no, call deny_pending.
Never claim something was sent or booked unless a tool result says so.`,
          tools: [{
            functionDeclarations: [
              { name: "run_task", description: "Do or look up anything for the user.", parameters: { type: Type.OBJECT, properties: { request: { type: Type.STRING, description: "The user's request in their own words" } }, required: ["request"] } },
              { name: "approve_pending", description: "The user approved the waiting action.", parameters: { type: Type.OBJECT, properties: {} } },
              { name: "deny_pending", description: "The user declined the waiting action.", parameters: { type: Type.OBJECT, properties: {} } },
            ],
          }],
        },
        callbacks: {
          onopen: () => this.h.onState("listening", "Gemini Live"),
          onmessage: (m) => void this.onMessage(m),
          onerror: () => this.h.onState("error", "Voice connection failed"),
          onclose: () => this.cleanup(),
        },
      });
  }

  private async onMessage(m: LiveServerMessage) {
    const sc = m.serverContent;
    if (sc?.interrupted) this.stopPlayback();
    if (sc?.inputTranscription?.text) { this.userBuf += sc.inputTranscription.text; this.h.onUserText(this.userBuf, false); }
    if (sc?.outputTranscription?.text) { this.modelBuf += sc.outputTranscription.text; this.h.onModelText(this.modelBuf, false); }
    for (const p of sc?.modelTurn?.parts ?? []) {
      const d = p.inlineData;
      if (d?.data && d.mimeType?.startsWith("audio/pcm")) this.play(d.data);
    }
    if (sc?.turnComplete) {
      if (this.userBuf) this.h.onUserText(this.userBuf, true);
      if (this.modelBuf) this.h.onModelText(this.modelBuf, true);
      this.userBuf = ""; this.modelBuf = "";
      this.h.onState("listening", "Gemini Live");
    }
    if (m.toolCall?.functionCalls?.length) {
      if (this.userBuf) { this.h.onUserText(this.userBuf, true); this.userBuf = ""; }
      this.h.onState("working");
      const functionResponses = [];
      for (const fc of m.toolCall.functionCalls) {
        const response = await this.h.onTool(fc.name ?? "", (fc.args ?? {}) as Record<string, unknown>);
        functionResponses.push({ id: fc.id, name: fc.name, response });
      }
      this.session?.sendToolResponse({ functionResponses });
      this.h.onState("listening", "Gemini Live");
    }
  }

  private play(b64: string) {
    if (!this.outCtx) return;
    const bin = atob(b64);
    const pcm = new Int16Array(bin.length / 2);
    for (let i = 0; i < pcm.length; i++) pcm[i] = (bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)) << 16 >> 16;
    const buf = this.outCtx.createBuffer(1, pcm.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const s = this.outCtx.createBufferSource();
    s.buffer = buf;
    s.connect(this.outCtx.destination);
    const at = Math.max(this.outCtx.currentTime, this.playAt);
    s.start(at);
    this.playAt = at + buf.duration;
    this.sources.push(s);
    s.onended = () => { this.sources = this.sources.filter((x) => x !== s); if (!this.sources.length) this.h.onState("listening", "Gemini Live"); };
    this.h.onState("speaking", "Gemini Live");
  }

  private stopPlayback() {
    for (const s of this.sources) { try { s.stop(); } catch { /* already stopped */ } }
    this.sources = [];
    this.playAt = 0;
  }

  /** Fallback when Gemini Live is unavailable: browser speech recognition and speech synthesis. */
  private startBrowser(lang: Lang) {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) { this.h.onState("error", "Voice is not supported in this browser. Use Chrome, or type instead."); return; }
    this.mode = "browser";
    const rec = new Ctor();
    rec.lang = SPEECH_LANG[lang];
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = async (e: SREvent) => {
      const r = e.results[e.results.length - 1];
      const text = r[0].transcript;
      this.h.onUserText(text, r.isFinal);
      if (r.isFinal) {
        this.h.onState("working");
        const out = await this.h.onTool("run_task", { request: text });
        const say = String(out.reply ?? "");
        this.h.onModelText(say, true);
        const u = new SpeechSynthesisUtterance(say);
        u.lang = SPEECH_LANG[lang];
        speechSynthesis.speak(u);
        this.h.onState("idle");
      }
    };
    rec.onerror = () => this.h.onState("idle");
    rec.onend = () => { if (this.recog === rec) this.h.onState("idle"); };
    this.recog = rec;
    rec.start();
    this.h.onState("listening", "Browser voice (fallback)");
  }

  stop() {
    this.recog?.stop();
    this.recog = null;
    try { this.session?.close(); } catch { /* closed */ }
    this.cleanup();
  }

  private cleanup() {
    this.stopPlayback();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.micCtx?.close().catch(() => {});
    void this.outCtx?.close().catch(() => {});
    this.session = null; this.micCtx = null; this.outCtx = null; this.stream = null;
    this.h.onState("idle");
  }
}

interface SR { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: (e: SREvent) => void; onerror: () => void; onend: () => void }
interface SREvent { results: { isFinal: boolean; 0: { transcript: string } }[] & { length: number } }
