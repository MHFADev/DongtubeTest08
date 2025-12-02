import { Router } from "express";
import axios from "axios";
import FormData from "form-data";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

// Remove Background
router.get("/api/removebg", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.url(url)) {
    return res.status(200).json({ success: false, error: "Invalid image URL", errorType: "ValidationError", hint: "Please provide a valid image URL" });
  }
  
  const imgResponse = await axios.get(url, { responseType: "arraybuffer" });
  const buffer = Buffer.from(imgResponse.data, "binary");
  const form = new FormData();
  form.append("file", buffer, "image.jpg");
  
  const { data } = await axios.post("https://removebg.one/api/predict/v2", form, {
    headers: { ...form.getHeaders(), platform: "PC", product: "REMOVEBG" }
  });
  
  res.json({
    success: true,
    data: {
      original_url: data.data.url,
      no_background_url: data.data.cutoutUrl,
      mask_url: data.data.maskUrl
    }
  });
}));

router.post("/api/removebg", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.url(url)) {
    return res.status(200).json({ success: false, error: "Invalid image URL", errorType: "ValidationError", hint: "Please provide a valid image URL" });
  }
  
  const imgResponse = await axios.get(url, { responseType: "arraybuffer" });
  const buffer = Buffer.from(imgResponse.data, "binary");
  const form = new FormData();
  form.append("file", buffer, "image.jpg");
  
  const { data } = await axios.post("https://removebg.one/api/predict/v2", form, {
    headers: { ...form.getHeaders(), platform: "PC", product: "REMOVEBG" }
  });
  
  res.json({
    success: true,
    data: {
      original_url: data.data.url,
      no_background_url: data.data.cutoutUrl,
      mask_url: data.data.maskUrl
    }
  });
}));

// OCR Image
router.get("/api/ocr", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.url(url)) {
    return res.status(200).json({ success: false, error: "Invalid image URL", errorType: "ValidationError", hint: "Please provide a valid image URL" });
  }
  
  const imgResponse = await axios.get(url, { responseType: "arraybuffer" });
  const imageBase64 = Buffer.from(imgResponse.data).toString("base64");
  const ext = url.split('.').pop().toLowerCase();
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  
  const ocrResponse = await axios.post(
    "https://staging-ai-image-ocr-266i.frontend.encr.app/api/ocr/process",
    { imageBase64, mimeType },
    { headers: { "content-type": "application/json" } }
  );
  
  res.json({
    success: true,
    data: {
      extractedText: ocrResponse.data.extractedText
    }
  });
}));

router.post("/api/ocr", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.url(url)) {
    return res.status(200).json({ success: false, error: "Invalid image URL", errorType: "ValidationError", hint: "Please provide a valid image URL" });
  }
  
  const imgResponse = await axios.get(url, { responseType: "arraybuffer" });
  const imageBase64 = Buffer.from(imgResponse.data).toString("base64");
  const ext = url.split('.').pop().toLowerCase();
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  
  const ocrResponse = await axios.post(
    "https://staging-ai-image-ocr-266i.frontend.encr.app/api/ocr/process",
    { imageBase64, mimeType },
    { headers: { "content-type": "application/json" } }
  );
  
  res.json({
    success: true,
    data: {
      extractedText: ocrResponse.data.extractedText
    }
  });
}));

// Screenshot
router.get("/api/screenshot", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.url(url)) {
    return res.status(200).json({ success: false, error: "Invalid URL", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  
  const accessKey = "fdaf638490cf4d5aad5bdabe7ec23187";
  const params = new URLSearchParams({
    access_key: accessKey,
    url: url,
    response_type: "image",
    full_page: "true"
  });
  
  const { data } = await axios.get(`https://api.apiflash.com/v1/urltoimage?${params}`, {
    responseType: "arraybuffer",
    timeout: 60000
  });
  
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.end(Buffer.from(data));
}));

router.post("/api/screenshot", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.url(url)) {
    return res.status(200).json({ success: false, error: "Invalid URL", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  
  const accessKey = "fdaf638490cf4d5aad5bdabe7ec23187";
  const params = new URLSearchParams({
    access_key: accessKey,
    url: url,
    response_type: "image",
    full_page: "true"
  });
  
  const { data } = await axios.get(`https://api.apiflash.com/v1/urltoimage?${params}`, {
    responseType: "arraybuffer",
    timeout: 60000
  });
  
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.end(Buffer.from(data));
}));

export const metadata = [
  {
    name: "Remove Background",
    path: "/api/removebg",
    method: "GET, POST",
    description: "Remove background from images",
    category: "image",
    status: "free",
    params: [
      {
        name: "url",
        type: "text",
        required: true,
        placeholder: "https://example.com/image.jpg",
        description: "Image URL"
      }
    ]
  },
  {
    name: "OCR Image",
    path: "/api/ocr",
    method: "GET, POST",
    description: "Extract text from images using OCR",
    category: "image",
    status: "free",
    params: [
      {
        name: "url",
        type: "text",
        required: true,
        placeholder: "https://example.com/image.jpg",
        description: "Image URL containing text"
      }
    ]
  },
  {
    name: "Screenshot",
    path: "/api/screenshot",
    method: "GET, POST",
    description: "Take screenshot of any website",
    category: "image",
    status: "free",
    responseBinary: true,
    params: [
      {
        name: "url",
        type: "text",
        required: true,
        placeholder: "https://example.com",
        description: "Website URL"
      }
    ]
  }
];

export default router;