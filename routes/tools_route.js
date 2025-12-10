import { Router } from "express";
import axios from "axios";
import { Buffer } from "buffer";
import { validate, unifiedHandler } from "../utils/validation.js";

const router = Router();

const GOOGLE_COOKIES = `# Netscape HTTP Cookie File
.gemini.google.com      TRUE    /       FALSE   1771146485      _ga     GA1.1.1119144039.1723713365
.gemini.google.com      TRUE    /       FALSE   1739973360      _gcl_au 1.1.2088761144.1732197360
.google.com     TRUE    /       FALSE   1750386349      SEARCH_SAMESITE CgQI75wB
.google.com     TRUE    /       FALSE   1769954360      SID     g.a000rwgHeGZrz9y_SUE3vLuLRAXa7PXu23AI8lR26-MAZyNrYy7qsNu0SJeu7CsQtSI0V1UizAACgYKAYUSARASFQHGX2MiqjNwsRM3J-H6Qjtq4RWzrhoVAUF8yKrpTl7a6E8qpIp2obumt6mA0076
.google.com     TRUE    /       TRUE    1769954360      __Secure-1PSID  g.a000rwgHeGZrz9y_SUE3vLuLRAXa7PXu23AI8lR26-MAZyNrYy7qUdMFbWyuwMFTt-bk3Ve5awACgYKAQ4SARASFQHGX2MiYZI6LzvRvy6oikfkw1EQXxoVAUF8yKrBjPOyinpCh2hWbnxebrLx0076
.google.com     TRUE    /       TRUE    1769954360      __Secure-3PSID  g.a000rwgHeGZrz9y_SUE3vLuLRAXa7PXu23AI8lR26-MAZyNrYy7qpr5DN7XGdRxP0mZmmHaQlQACgYKAbQSARASFQHGX2MigJd5isCZCLCyWwGuBHKeTxoVAUF8yKre3I4qP1UJtMJR1I3xaw_x0076
.google.com     TRUE    /       FALSE   1769954360      HSID    AcK2pYSICr0m5vnfx
.google.com     TRUE    /       TRUE    1769954360      SSID    A6hnDJO-5GUFxInVg
.google.com     TRUE    /       FALSE   1769954360      APISID  _YUMvJaRkbLz8SDp/Aazx_-GbIamNBEqsP
.google.com     TRUE    /       TRUE    1769954360      SAPISID CaxTa_5jC8MVeX3Y/A_wZ5nFoW6k_h0QIp
.google.com     TRUE    /       TRUE    1769954360      __Secure-1PAPISID       CaxTa_5jC8MVeX3Y/A_wZ5nFoW6k_h0QIp
.google.com     TRUE    /       TRUE    1769954360      __Secure-3PAPISID       CaxTa_5jC8MVeX3Y/A_wZ5nFoW6k_h0QIp
.google.com     TRUE    /       TRUE    1742215973      AEC     AZ6Zc-WmCBxLx0He79__0pKbzfh9twPSn6-xYcsbw7Q_xqv2vEbhKJg56gE`;

function parseCookies(cookieString) {
  const cookies = {};
  cookieString.split("\n").forEach(line => {
    if (line.startsWith(".google.com") || line.startsWith(".gemini.google.com")) {
      const parts = line.split("\t");
      if (parts.length >= 7) cookies[parts[5]] = parts[6];
    }
  });
  return cookies;
}

async function extractBase64(response) {
  const lines = response.split("\n");
  for (const line of lines) {
    if (line.includes("wrb.fr") && line.includes("XqA3Ic")) {
      const jsonData = JSON.parse(line);
      return jsonData[0][2].replace(/^"/, "").replace(/"$/, "").replace(/\\"/g, "").trim();
    }
  }
  throw new Error("Base64 data not found in response");
}

async function getGeminiToken() {
  const cookies = parseCookies(GOOGLE_COOKIES);
  const cookieString = Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join("; ");
  const bardRes = await axios.get("https://gemini.google.com/", { headers: { "User-Agent": "Mozilla/5.0", "Cookie": cookieString }, timeout: 30000 });
  const tokens = { at: null, sid: null };
  const atMatch = bardRes.data.match(/"FdrFJe":"([^"]+)"/);
  if (atMatch) tokens.sid = atMatch[1];
  const SNlM0eMatch = bardRes.data.match(/"SNlM0e":"([^"]+)"/);
  if (SNlM0eMatch) tokens.at = SNlM0eMatch[1];
  return tokens;
}

async function makeGeminiRequest(query, language) {
  const cookies = parseCookies(GOOGLE_COOKIES);
  const cookieString = Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join("; ");
  const tokens = await getGeminiToken();
  const params = { rpcids: "XqA3Ic", "source-path": "/app", bl: "boq_assistant-bard-web-server_20250226.06_p2", "f.sid": tokens.sid, hl: "id", "_reqid": "1951413", rt: "c" };
  const headers = { "authority": "gemini.google.com", "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "origin": "https://gemini.google.com", "referer": "https://gemini.google.com/", Cookie: cookieString };
  const data = new URLSearchParams();
  data.append("f.req", `[[["XqA3Ic","[null,\\"${query.replace(/\n/g, "\\\\n")}\\",\\"${language}\\",null,2]",null,"generic"]]]`);
  data.append("at", tokens.at);
  const response = await axios.post("https://gemini.google.com/_/BardChatUi/data/batchexecute", data.toString(), { params, headers, timeout: 30000 });
  return response.data;
}

async function getGoogleTTSAudio(query, language = "ja-JP") {
  const result = await makeGeminiRequest(query, language);
  return await extractBase64(result);
}

async function getTtsAudio(text, voice, rate, pitch, volume) {
  const response = await axios.get(`https://iniapi-tts.hf.space/generate?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(rate)}&volume=${encodeURIComponent(volume)}&pitch=${encodeURIComponent(pitch)}`, { headers: { "user-agent": "Mozilla/5.0" }, responseType: "arraybuffer", timeout: 30000 });
  return Buffer.from(response.data);
}

async function translateText(text, source, target) {
  const response = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`, { timeout: 30000, headers: { "User-Agent": "Mozilla/5.0" } });
  return response.data?.[0]?.[0]?.[0] || "Translation not found.";
}

function base64ToText(base64String) {
  try { return { text: Buffer.from(base64String, "base64").toString("utf-8") }; } 
  catch (error) { throw new Error("Invalid Base64 string provided."); }
}

router.all("/api/tools/ttsgoogle", unifiedHandler(async (params, req, res) => {
  const { text } = params;
  if (!validate.notEmpty(text)) return res.status(200).json({ success: false, error: "Parameter 'text' is required", errorType: "ValidationError", hint: "Please provide text to convert to speech" });
  const base64Audio = await getGoogleTTSAudio(text.trim());
  if (!base64Audio) throw new Error("Failed to get audio");
  const audioBuffer = Buffer.from(base64Audio, "base64");
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Content-Length", audioBuffer.length);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="tts_${Date.now()}.mp3"`);
  res.end(audioBuffer);
}));

router.all("/api/tools/tts", unifiedHandler(async (params, req, res) => {
  const { text, voice, rate, pitch, volume } = params;
  if (!text || !voice || !rate || !pitch || !volume) return res.status(200).json({ success: false, error: "All parameters (text, voice, rate, pitch, volume) are required", errorType: "ValidationError" });
  const audioBuffer = await getTtsAudio(text.trim(), voice.trim(), rate.trim(), pitch.trim(), volume.trim());
  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Content-Length", audioBuffer.length);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="audio.wav"`);
  res.end(audioBuffer);
}));

router.all("/api/tools/translate", unifiedHandler(async (params, req, res) => {
  const { text, source = "auto", target = "id" } = params;
  if (!validate.notEmpty(text)) return res.status(200).json({ success: false, error: "Parameter 'text' is required", errorType: "ValidationError", hint: "Please provide text to translate" });
  const translatedText = await translateText(text.trim(), source.trim(), target.trim());
  res.json({ success: true, data: { translatedText } });
}));

router.all("/api/tools/base642text", unifiedHandler(async (params, req, res) => {
  const { base64 } = params;
  if (!validate.notEmpty(base64)) return res.status(200).json({ success: false, error: "Parameter 'base64' is required", errorType: "ValidationError", hint: "Please provide a base64 string to decode" });
  const result = base64ToText(base64.trim());
  res.json({ success: true, data: result });
}));

export const metadata = [
  { name: "TTS Google", path: "/api/tools/ttsgoogle", method: "GET, POST", description: "Convert text to speech using Google TTS", category: "tools", status: "free", responseBinary: true, params: [{ name: "text", type: "text", required: true, placeholder: "halo semua", description: "Text to convert to speech" }] },
  { name: "Translate", path: "/api/tools/translate", method: "GET, POST", description: "Translate text using Google Translate", category: "tools", status: "free", params: [{ name: "text", type: "text", required: true, placeholder: "I love you", description: "Text to translate" }, { name: "source", type: "text", required: false, placeholder: "auto", description: "Source language code" }, { name: "target", type: "text", required: false, placeholder: "id", description: "Target language code" }] },
  { name: "Base64 to Text", path: "/api/tools/base642text", method: "GET, POST", description: "Decode Base64 to plain text", category: "tools", status: "free", params: [{ name: "base64", type: "text", required: true, placeholder: "SGVsbG8gV29ybGQ=", description: "Base64 encoded string" }] }
];

export default router;
