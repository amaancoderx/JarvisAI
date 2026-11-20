import { existsSync } from "node:fs";
import type { Browser } from "puppeteer-core";

/** The Jarvis computer: a real, sandboxed Chromium on Cloud Run that opens pages and shows what it sees. */
let browser: Promise<Browser> | null = null;
const exe = () => process.env.CHROME_PATH || "/usr/bin/chromium";

export function computerReady(): boolean {
  try { return existsSync(exe()); } catch { return false; }
}

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    const puppeteer = (await import("puppeteer-core")).default;
    browser = puppeteer.launch({
      executablePath: exe(),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--no-zygote", "--single-process", "--lang=en-IN"],
    }).catch((e) => { browser = null; throw e; });
  }
  return browser;
}

const blocked = (h: string) => /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|metadata)/i.test(h) || h.endsWith(".internal");

export interface Shot { url: string; title: string; image: string; text: string }

export async function openPage(raw: string, timeoutMs = 15000): Promise<Shot> {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (blocked(new URL(url).hostname)) throw new Error("That address is not allowed.");
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36");
    await page.setRequestInterception(true);
    page.on("request", (r) => { try { const h = new URL(r.url()).hostname; if (blocked(h) || r.resourceType() === "media") void r.abort(); else void r.continue(); } catch { void r.abort(); } });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs }).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 1800));
    const title = await page.title().catch(() => "");
    const text = await page.evaluate(() => (document.body?.innerText || "").replace(/\n{3,}/g, "\n\n")).catch(() => "");
    const image = (await page.screenshot({ type: "jpeg", quality: 55 })) as Uint8Array;
    return { url: page.url(), title, image: `data:image/jpeg;base64,${Buffer.from(image).toString("base64")}`, text: String(text).slice(0, 12000) };
  } finally {
    await page.close().catch(() => undefined);
  }
}
