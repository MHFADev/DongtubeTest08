import { Router } from "express";
import QRCode from "qrcode";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import CryptoJS from "crypto-js";

const router = Router();

// 1. QR Code Generator
router.post("/api/tools/qr-code", async (req, res) => {
  try {
    const { text, size = 300, color = "#000000", bgColor = "#FFFFFF" } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: "Text is required" });
    }

    const qrCodeDataURL = await QRCode.toDataURL(text, {
      width: parseInt(size),
      color: {
        dark: color,
        light: bgColor
      },
      errorCorrectionLevel: 'H'
    });

    res.json({
      success: true,
      data: {
        qrCode: qrCodeDataURL,
        text,
        size,
        color,
        bgColor
      }
    });
  } catch (error) {
    console.error('QR Code generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate QR code' });
  }
});

// 2. Password Generator
router.post("/api/tools/password", (req, res) => {
  try {
    const { length = 16, includeUppercase = true, includeLowercase = true, includeNumbers = true, includeSymbols = true } = req.body;
    
    let charset = '';
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeNumbers) charset += '0123456789';
    if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    if (charset.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one character type must be selected' });
    }
    
    let password = '';
    for (let i = 0; i < parseInt(length); i++) {
      password += charset.charAt(crypto.randomInt(0, charset.length));
    }
    
    const strength = length >= 16 ? 'Very Strong' : length >= 12 ? 'Strong' : length >= 8 ? 'Medium' : 'Weak';
    
    res.json({
      success: true,
      data: {
        password,
        length: password.length,
        strength
      }
    });
  } catch (error) {
    console.error('Password generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate password' });
  }
});

// 3. Hash Generator
router.post("/api/tools/hash", (req, res) => {
  try {
    const { text, algorithm = 'sha256' } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: "Text is required" });
    }

    const algorithms = {
      'md5': () => CryptoJS.MD5(text).toString(),
      'sha1': () => CryptoJS.SHA1(text).toString(),
      'sha256': () => CryptoJS.SHA256(text).toString(),
      'sha512': () => CryptoJS.SHA512(text).toString(),
      'sha3': () => CryptoJS.SHA3(text).toString()
    };

    if (!algorithms[algorithm]) {
      return res.status(400).json({ success: false, error: 'Invalid algorithm' });
    }

    const hash = algorithms[algorithm]();
    
    res.json({
      success: true,
      data: {
        original: text,
        algorithm,
        hash
      }
    });
  } catch (error) {
    console.error('Hash generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate hash' });
  }
});

// 4. Base64 Encoder/Decoder
router.post("/api/tools/base64", (req, res) => {
  try {
    const { text, action = 'encode' } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: "Text is required" });
    }

    let result;
    if (action === 'encode') {
      result = Buffer.from(text, 'utf-8').toString('base64');
    } else if (action === 'decode') {
      result = Buffer.from(text, 'base64').toString('utf-8');
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    res.json({
      success: true,
      data: {
        original: text,
        action,
        result
      }
    });
  } catch (error) {
    console.error('Base64 error:', error);
    res.status(500).json({ success: false, error: 'Failed to process base64' });
  }
});

// 5. UUID Generator
router.post("/api/tools/uuid", (req, res) => {
  try {
    const { count = 1, version = 'v4' } = req.body;
    
    const uuids = [];
    for (let i = 0; i < Math.min(parseInt(count), 100); i++) {
      uuids.push(uuidv4());
    }
    
    res.json({
      success: true,
      data: {
        uuids,
        count: uuids.length,
        version
      }
    });
  } catch (error) {
    console.error('UUID generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate UUID' });
  }
});

// 6. Lorem Ipsum Generator
router.post("/api/tools/lorem-ipsum", (req, res) => {
  try {
    const { paragraphs = 3, wordsPerParagraph = 50 } = req.body;
    
    const loremWords = [
      'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
      'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
      'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
      'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
      'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
      'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
      'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
      'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum'
    ];
    
    const generateParagraph = (words) => {
      const paragraph = [];
      for (let i = 0; i < words; i++) {
        paragraph.push(loremWords[crypto.randomInt(0, loremWords.length)]);
      }
      return paragraph.join(' ').charAt(0).toUpperCase() + paragraph.join(' ').slice(1) + '.';
    };
    
    const result = [];
    for (let i = 0; i < Math.min(parseInt(paragraphs), 20); i++) {
      result.push(generateParagraph(parseInt(wordsPerParagraph)));
    }
    
    res.json({
      success: true,
      data: {
        text: result.join('\n\n'),
        paragraphs: result.length,
        wordsPerParagraph: parseInt(wordsPerParagraph)
      }
    });
  } catch (error) {
    console.error('Lorem ipsum generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate lorem ipsum' });
  }
});

// 7. JSON Formatter & Validator
router.post("/api/tools/json-format", (req, res) => {
  try {
    const { json, indent = 2 } = req.body;
    
    if (!json) {
      return res.status(400).json({ success: false, error: "JSON is required" });
    }

    const parsed = JSON.parse(json);
    const formatted = JSON.stringify(parsed, null, parseInt(indent));
    
    res.json({
      success: true,
      data: {
        formatted,
        valid: true,
        size: formatted.length,
        keys: Object.keys(parsed).length
      }
    });
  } catch (error) {
    res.json({
      success: false,
      error: 'Invalid JSON',
      details: error.message
    });
  }
});

// 8. URL Encoder/Decoder
router.post("/api/tools/url-encode", (req, res) => {
  try {
    const { text, action = 'encode' } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: "Text is required" });
    }

    let result;
    if (action === 'encode') {
      result = encodeURIComponent(text);
    } else if (action === 'decode') {
      result = decodeURIComponent(text);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    res.json({
      success: true,
      data: {
        original: text,
        action,
        result
      }
    });
  } catch (error) {
    console.error('URL encode error:', error);
    res.status(500).json({ success: false, error: 'Failed to process URL encoding' });
  }
});

// 9. Color Converter
router.post("/api/tools/color-convert", (req, res) => {
  try {
    const { color } = req.body;
    
    if (!color) {
      return res.status(400).json({ success: false, error: "Color is required" });
    }

    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };

    const rgb = hexToRgb(color);
    if (!rgb) {
      return res.status(400).json({ success: false, error: 'Invalid hex color' });
    }

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    
    res.json({
      success: true,
      data: {
        hex: color.toUpperCase(),
        rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
        rgba: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`,
        hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
      }
    });
  } catch (error) {
    console.error('Color conversion error:', error);
    res.status(500).json({ success: false, error: 'Failed to convert color' });
  }
});

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

// 10. Timestamp Converter
router.post("/api/tools/timestamp", (req, res) => {
  try {
    const { timestamp, action = 'toDate' } = req.body;
    
    let result;
    if (action === 'toDate') {
      const ts = timestamp || Date.now();
      const date = new Date(parseInt(ts));
      result = {
        iso: date.toISOString(),
        utc: date.toUTCString(),
        local: date.toLocaleString(),
        timestamp: parseInt(ts)
      };
    } else if (action === 'toTimestamp') {
      const date = new Date(timestamp);
      result = {
        timestamp: date.getTime(),
        iso: date.toISOString()
      };
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Timestamp conversion error:', error);
    res.status(500).json({ success: false, error: 'Failed to convert timestamp' });
  }
});

// 11. JWT Decoder
router.post("/api/tools/jwt-decode", (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ success: false, error: "JWT token is required" });
    }

    const parts = token.trim().split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ success: false, error: 'Invalid JWT format. A valid JWT must have exactly 3 parts separated by dots (header.payload.signature)' });
    }

    function base64UrlDecode(str) {
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      return Buffer.from(base64, 'base64').toString('utf-8');
    }

    let header, payload;
    try {
      header = JSON.parse(base64UrlDecode(parts[0]));
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid JWT header. Unable to decode or parse the header portion of the token.' 
      });
    }

    try {
      payload = JSON.parse(base64UrlDecode(parts[1]));
    } catch (e) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid JWT payload. Unable to decode or parse the payload portion of the token.' 
      });
    }
    
    res.json({
      success: true,
      data: {
        header,
        payload,
        signature: parts[2]
      }
    });
  } catch (error) {
    console.error('JWT decode error:', error);
    res.status(400).json({ 
      success: false, 
      error: 'Failed to decode JWT. Please ensure the token is properly formatted.' 
    });
  }
});

// 12. CSV to JSON Converter
router.post("/api/tools/csv-to-json", (req, res) => {
  try {
    const { csv } = req.body;
    
    if (!csv) {
      return res.status(400).json({ success: false, error: "CSV data is required" });
    }

    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const obj = {};
      const currentLine = lines[i].split(',').map(v => v.trim());
      
      headers.forEach((header, index) => {
        obj[header] = currentLine[index] || '';
      });
      
      result.push(obj);
    }
    
    res.json({
      success: true,
      data: {
        json: result,
        formatted: JSON.stringify(result, null, 2),
        rows: result.length
      }
    });
  } catch (error) {
    console.error('CSV to JSON error:', error);
    res.status(500).json({ success: false, error: 'Failed to convert CSV to JSON' });
  }
});

// 13. Text Case Converter
router.post("/api/tools/text-case", (req, res) => {
  try {
    const { text, caseType = 'upper' } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: "Text is required" });
    }

    const converters = {
      'upper': (t) => t.toUpperCase(),
      'lower': (t) => t.toLowerCase(),
      'title': (t) => t.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),
      'sentence': (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(),
      'camel': (t) => t.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase()).replace(/\s+/g, ''),
      'snake': (t) => t.toLowerCase().replace(/\s+/g, '_'),
      'kebab': (t) => t.toLowerCase().replace(/\s+/g, '-')
    };

    const result = converters[caseType] ? converters[caseType](text) : text;
    
    res.json({
      success: true,
      data: {
        original: text,
        caseType,
        result
      }
    });
  } catch (error) {
    console.error('Text case conversion error:', error);
    res.status(500).json({ success: false, error: 'Failed to convert text case' });
  }
});

// 14. String Length & Word Counter
router.post("/api/tools/text-stats", (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: "Text is required" });
    }

    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
    
    res.json({
      success: true,
      data: {
        characters: text.length,
        charactersNoSpaces: text.replace(/\s/g, '').length,
        words: words.length,
        sentences: sentences.length,
        paragraphs: paragraphs.length,
        lines: text.split('\n').length,
        readingTime: Math.ceil(words.length / 200)
      }
    });
  } catch (error) {
    console.error('Text stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate text stats' });
  }
});

// 15. HTML Entity Encoder/Decoder
router.post("/api/tools/html-entity", (req, res) => {
  try {
    const { text, action = 'encode' } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: "Text is required" });
    }

    let result;
    if (action === 'encode') {
      result = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    } else if (action === 'decode') {
      result = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    res.json({
      success: true,
      data: {
        original: text,
        action,
        result
      }
    });
  } catch (error) {
    console.error('HTML entity error:', error);
    res.status(500).json({ success: false, error: 'Failed to process HTML entities' });
  }
});

export const metadata = {
  name: "Admin Tools",
  description: "Collection of 15 utility tools for developers"
};

export default router;
