"use client";
import { useEffect, useState } from "react";
import type { TabContext } from "@/lib/types";

/**
 * "Just this browser tab": while this page is open, Jarvis can see a screen you share, read files in a folder you
 * choose, and open pages in this browser. Nothing is installed, and you can stop each one at any time.
 */
interface DirHandle { name: string; values(): AsyncIterable<{ kind: string; name: string; getFile?: () => Promise<File> }> }
interface TabState { connected: boolean; screen: boolean; folder: string | null; files: string[] }

let state: TabState = { connected: false, screen: false, folder: null, files: [] };
let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
let dir: DirHandle | null = null;
const fileHandles = new Map<string, { getFile: () => Promise<File> }>();
const subs = new Set<(s: TabState) => void>();
const emit = (p: Partial<TabState>) => { state = { ...state, ...p }; subs.forEach((f) => f(state)); };

export function useTab(): TabState {
  const [s, set] = useState(state);
  useEffect(() => { subs.add(set); return () => { subs.delete(set); }; }, []);
  return s;
}

export const connectTab = () => emit({ connected: true });
export function disconnectTab() { stopScreen(); dir = null; fileHandles.clear(); emit({ connected: false, folder: null, files: [] }); }
export const folderSupported = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

export async function shareScreen(): Promise<string | null> {
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 2 }, audio: false });
    video = document.createElement("video");
    video.muted = true; video.srcObject = stream; await video.play();
    stream.getVideoTracks()[0].addEventListener("ended", () => stopScreen());
    emit({ connected: true, screen: true });
    return null;
  } catch { return "Screen sharing was cancelled."; }
}
export function stopScreen() { stream?.getTracks().forEach((t) => t.stop()); stream = null; video = null; emit({ screen: false }); }

export async function chooseFolder(): Promise<string | null> {
  if (!folderSupported()) return "This browser cannot share a folder. Use Chrome or Edge.";
  try {
    dir = await (window as unknown as { showDirectoryPicker: (o?: object) => Promise<DirHandle> }).showDirectoryPicker({ mode: "read" });
    fileHandles.clear();
    const names: string[] = [];
    for await (const e of dir.values()) if (e.kind === "file" && e.getFile && names.length < 500) { names.push(e.name); fileHandles.set(e.name, { getFile: e.getFile.bind(e) }); }
    emit({ connected: true, folder: dir.name, files: names.sort() });
    return null;
  } catch { return "No folder was chosen."; }
}

function frame(): string | null {
  if (!video || !video.videoWidth) return null;
  const scale = Math.min(1, 1280 / video.videoWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(video.videoWidth * scale); c.height = Math.round(video.videoHeight * scale);
  c.getContext("2d")!.drawImage(video, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.6).split(",")[1] ?? null;
}

const b64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(f); });
const SCREEN_WORDS = /(screen|this (page|email|mail|tab|window|doc)|what (do|am) i (see|looking)|on my (screen|display)|ye kya hai|is page|స్క్రీన్)/i;
const MIME: Record<string, string> = { pdf: "application/pdf", txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

/** What this tab shares for one request: the screen when the message is about it, the folder, and files the message names. */
export async function tabContext(text: string): Promise<TabContext | undefined> {
  if (!state.connected) return undefined;
  const ctx: TabContext = {};
  if (state.screen && (SCREEN_WORDS.test(text) || !state.folder)) { const f = frame(); if (f) ctx.screen = f; }
  if (state.folder) {
    ctx.folder = { name: state.folder, files: state.files };
    const words = text.toLowerCase().replace(/[^a-z0-9ऀ-౿ ]/g, " ").split(/\s+/).filter((w) => w.length >= 3);
    const alias: Record<string, string[]> = { resume: ["resume", "cv"], cv: ["resume", "cv"], invoice: ["invoice", "bill"], photo: ["jpg", "png", "photo"] };
    const keys = [...new Set(words.flatMap((w) => alias[w] ?? [w]))];
    const scored = state.files
      .map((n) => ({ n, s: keys.filter((k) => n.toLowerCase().includes(k)).length }))
      .filter((x) => x.s > 0 && MIME[x.n.split(".").pop()!.toLowerCase()])
      .sort((a, b) => b.s - a.s).slice(0, 2);
    const files: TabContext["files"] = [];
    for (const { n } of scored) {
      const f = await fileHandles.get(n)!.getFile().catch(() => null);
      if (f && f.size <= 4 * 1024 * 1024) files.push({ name: n, mime: MIME[n.split(".").pop()!.toLowerCase()], data: await b64(f) });
    }
    if (files.length) ctx.files = files;
  }
  return ctx;
}
