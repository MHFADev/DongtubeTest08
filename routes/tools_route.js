import { Router } from "express";
import axios from "axios";
import { Buffer } from "buffer";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

// ========== TTS GOOGLE ==========

const GOOGLE_COOKIES = `# Netscape HTTP Cookie File
# http://curl.haxx.se/rfc/cookie_spec.html
# This is a generated file!  Do not edit.

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
  const lines = cookieString.split("\n");

  lines.forEach(line => {
    if (line.startsWith(".google.com") || line.startsWith(".gemini.google.com")) {
      const parts = line.split("\t");
      if (parts.length >= 7) {
        cookies[parts[5]] = parts[6];
      }
    }
  });
  return cookies;
}

async function extractBase64(response) {
  const lines = response.split("\n");
  for (const line of lines) {
    if (line.includes("wrb.fr") && line.includes("XqA3Ic")) {
      const jsonData = JSON.parse(line);
      const firstElement = jsonData[0];
      const base64String = firstElement[2];
      return base64String.replace(/^"/, "").replace(/"$/, "").replace(/\\"/g, "").trim();
    }
  }
  throw new Error("Base64 data not found in response");
}

async function getGeminiToken() {
  const cookies = parseCookies(GOOGLE_COOKIES);
  const cookieString = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");

  const bardRes = await axios.get("https://gemini.google.com/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Cookie": cookieString
    },
    timeout: 30000
  });

  const bardText = bardRes.data;
  const tokens = { at: null, sid: null };

  const atMatch = bardText.match(/"FdrFJe":"([^"]+)"/);
  if (atMatch) tokens.sid = atMatch[1];

  const SNlM0eMatch = bardText.match(/"SNlM0e":"([^"]+)"/);
  if (SNlM0eMatch) tokens.at = SNlM0eMatch[1];

  return tokens;
}

async function makeGeminiRequest(query, language) {
  const cookies = parseCookies(GOOGLE_COOKIES);
  const cookieString = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");

  const url = "https://gemini.google.com/_/BardChatUi/data/batchexecute";
  const tokens = await getGeminiToken();

  const params = {
    rpcids: "XqA3Ic",
    "source-path": "/app",
    bl: "boq_assistant-bard-web-server_20250226.06_p2",
    "f.sid": tokens.sid,
    hl: "id",
    "_reqid": "1951413",
    rt: "c"
  };

  const headers = {
    "authority": "gemini.google.com",
    "accept": "*/*",
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    "origin": "https://gemini.google.com",
    "referer": "https://gemini.google.com/",
    "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36",
    Cookie: cookieString
  };

  const message = query.replace(/\n/g, "\\\\n");
  const data = new URLSearchParams();
  data.append("f.req", `[[["XqA3Ic","[null,\\"${message}\\",\\"${language}\\",null,2]",null,"generic"]]]`);
  data.append("at", tokens.at);

  const response = await axios.post(url, data.toString(), { params, headers, timeout: 30000 });
  return response.data;
}

async function getGoogleTTSAudio(query, language = "ja-JP") {
  const result = await makeGeminiRequest(query, language);
  return await extractBase64(result);
}

// ========== TTS ==========

async function getTtsAudio(text, voice, rate, pitch, volume) {
  const apiUrl = `https://iniapi-tts.hf.space/generate?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(rate)}&volume=${encodeURIComponent(volume)}&pitch=${encodeURIComponent(pitch)}`;

  const response = await axios.get(apiUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    responseType: "arraybuffer",
    timeout: 30000
  });

  return Buffer.from(response.data);
}

// ========== TRANSLATE ==========

async function translateText(text, source, target) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;

  const response = await axios.get(url, {
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });

  if (response.status !== 200) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const data = response.data;
  return data?.[0]?.[0]?.[0] || "Translation not found.";
}

// ========== BASE64 TO TEXT ==========

function base64ToText(base64String) {
  try {
    const text = Buffer.from(base64String, "base64").toString("utf-8");
    return { text };
  } catch (error) {
    throw new Error("Invalid Base64 string provided.");
  }
}

// ========== ROUTES ==========

// TTS Google
router.get("/api/tools/ttsgoogle", asyncHandler(async (req, res) => {
  const { text } = req.query;
  
  if (!validate.notEmpty(text)) {
    return res.status(200).json({ success: false, error: "Parameter 'text' is required", errorType: "ValidationError", hint: "Please provide text to convert to speech" });
  }

  const base64Audio = await getGoogleTTSAudio(text.trim());
  if (!base64Audio) {
    throw new Error("Failed to get audio");
  }

  const audioBuffer = Buffer.from(base64Audio, "base64");

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Content-Length", audioBuffer.length);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="tts_${Date.now()}.mp3"`);
  
  res.end(audioBuffer);
}));

router.post("/api/tools/ttsgoogle", asyncHandler(async (req, res) => {
  const { text } = req.body;
  
  if (!validate.notEmpty(text)) {
    return res.status(200).json({ success: false, error: "Parameter 'text' is required", errorType: "ValidationError", hint: "Please provide text to convert to speech" });
  }

  const base64Audio = await getGoogleTTSAudio(text.trim());
  if (!base64Audio) {
    throw new Error("Failed to get audio");
  }

  const audioBuffer = Buffer.from(base64Audio, "base64");

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Content-Length", audioBuffer.length);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="tts_${Date.now()}.mp3"`);
  
  res.end(audioBuffer);
}));

// TTS
router.get("/api/tools/tts", asyncHandler(async (req, res) => {
  const { text, voice, rate, pitch, volume } = req.query;
  
  if (!text || !voice || !rate || !pitch || !volume) {
    return res.status(200).json({
      success: false,
      error: "All parameters (text, voice, rate, pitch, volume) are required",
      errorType: "ValidationError",
      hint: "Please provide all required parameters for TTS"
    });
  }

  const audioBuffer = await getTtsAudio(text.trim(), voice.trim(), rate.trim(), pitch.trim(), volume.trim());

  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Content-Length", audioBuffer.length);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="audio.wav"`);
  
  res.end(audioBuffer);
}));

router.post("/api/tools/tts", asyncHandler(async (req, res) => {
  const { text, voice, rate, pitch, volume } = req.body;
  
  if (!text || !voice || !rate || !pitch || !volume) {
    return res.status(200).json({
      success: false,
      error: "All parameters (text, voice, rate, pitch, volume) are required",
      errorType: "ValidationError",
      hint: "Please provide all required parameters for TTS"
    });
  }

  const audioBuffer = await getTtsAudio(text.trim(), voice.trim(), rate.trim(), pitch.trim(), volume.trim());

  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Content-Length", audioBuffer.length);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="audio.wav"`);
  
  res.end(audioBuffer);
}));

// Translate
router.get("/api/tools/translate", asyncHandler(async (req, res) => {
  const { text, source = "auto", target = "id" } = req.query;
  
  if (!validate.notEmpty(text)) {
    return res.status(200).json({ success: false, error: "Parameter 'text' is required", errorType: "ValidationError", hint: "Please provide text to translate" });
  }

  const translatedText = await translateText(text.trim(), source.trim(), target.trim());
  
  res.json({
    success: true,
    data: { translatedText }
  });
}));

router.post("/api/tools/translate", asyncHandler(async (req, res) => {
  const { text, source = "auto", target = "id" } = req.body;
  
  if (!validate.notEmpty(text)) {
    return res.status(200).json({ success: false, error: "Parameter 'text' is required", errorType: "ValidationError", hint: "Please provide text to translate" });
  }

  const translatedText = await translateText(text.trim(), source.trim(), target.trim());
  
  res.json({
    success: true,
    data: { translatedText }
  });
}));

// Base64 to Text
router.get("/api/tools/base642text", asyncHandler(async (req, res) => {
  const { base64 } = req.query;
  
  if (!validate.notEmpty(base64)) {
    return res.status(200).json({ success: false, error: "Parameter 'base64' is required", errorType: "ValidationError", hint: "Please provide a base64 string to decode" });
  }

  const result = base64ToText(base64.trim());
  res.json({ success: true, data: result });
}));

router.post("/api/tools/base642text", asyncHandler(async (req, res) => {
  const { base64 } = req.body;
  
  if (!validate.notEmpty(base64)) {
    return res.status(200).json({ success: false, error: "Parameter 'base64' is required", errorType: "ValidationError", hint: "Please provide a base64 string to decode" });
  }

  const result = base64ToText(base64.trim());
  res.json({ success: true, data: result });
}));

export const metadata = [
  {
    name: "TTS Google",
    path: "/api/tools/ttsgoogle",
    method: "GET, POST",
    description: "Convert text to speech using Google TTS (leveraging Gemini infrastructure)",
    category: "tools",
    status: "free",
    responseBinary: true,
    params: [
      {
        name: "text",
        type: "text",
        required: true,
        placeholder: "halo semua",
        description: "Text to convert to speech (max 1000 chars)"
      }
    ]
  },
  {
    name: "Translate",
    path: "/api/tools/translate",
    method: "GET, POST",
    description: "Translate text from one language to another using Google Translate",
    category: "tools",
    status: "free",
    params: [
      {
        name: "text",
        type: "text",
        required: true,
        placeholder: "I love you",
        description: "Text to translate (max 5000 chars)"
      },
      {
        name: "source",
        type: "text",
        required: false,
        placeholder: "auto",
        description: "Source language code (default: auto)"
      },
      {
        name: "target",
        type: "text",
        required: false,
        placeholder: "id",
        description: "Target language code (default: id)"
      }
    ]
  },
  {
    name: "Base64 to Text",
    path: "/api/tools/base642text",
    method: "GET, POST",
    description: "Decode Base64 encoded string to plain text",
    category: "tools",
    status: "free",
    params: [
      {
        name: "base64",
        type: "text",
        required: true,
        placeholder: "SGVsbG8gV29ybGQ=",
        description: "Base64 encoded string"
      }
    ]
  }
];

export default router;
