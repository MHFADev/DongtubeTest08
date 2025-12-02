import { Router } from "express";
import axios from "axios";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

async function downloadFacebook(url) {
  const apiUrl = `https://www.a2zconverter.com/api/files/proxy?url=${encodeURIComponent(url)}`;
  const { data } = await axios.get(apiUrl, {
    headers: {
      "Referer": "https://www.a2zconverter.com/facebook-video-downloader",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
  });
  return data;
}

router.get("/api/facebook/download", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.url(url, "facebook.com")) {
    return res.status(200).json({ success: false, error: "Invalid Facebook URL", errorType: "ValidationError", hint: "Please provide a valid Facebook video URL" });
  }
  
  const result = await downloadFacebook(url);
  res.json({ success: true, data: result });
}));

router.post("/api/facebook/download", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.url(url, "facebook.com")) {
    return res.status(200).json({ success: false, error: "Invalid Facebook URL", errorType: "ValidationError", hint: "Please provide a valid Facebook video URL" });
  }
  
  const result = await downloadFacebook(url);
  res.json({ success: true, data: result });
}));

export const metadata = {
  name: "Facebook Download",
  path: "/api/facebook/download",
  method: "GET, POST",
  description: "Download Facebook videos",
  category: "social-media",
  status: "free",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.facebook.com/watch?v=123",
      description: "Facebook video URL"
    }
  ]
};

export default router;
