import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

async function downloadInstagram(url) {
  const encoded = encodeURIComponent(url);
  const response = await axios.get(`https://igram.website/content.php?url=${encoded}`, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; Termux) AppleWebKit/537.36"
    }
  });
  
  const json = response.data;
  if (!json.html) {
    throw new Error("Failed to fetch Instagram data");
  }
  
  const $ = cheerio.load(json.html);
  const thumb = $("img.w-100").attr("src");
  const caption = $("p.text-sm").text().trim();
  const download = $('a:contains("Download HD")').attr("href");
  const user = json.username || "unknown";
  
  return {
    user,
    thumb,
    caption,
    download
  };
}

router.get("/api/instagram/download", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.url(url, "instagram.com")) {
    return res.status(200).json({ success: false, error: "Invalid Instagram URL", errorType: "ValidationError", hint: "Please provide a valid Instagram post URL" });
  }
  
  const result = await downloadInstagram(url);
  res.json({ success: true, data: result });
}));

router.post("/api/instagram/download", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.url(url, "instagram.com")) {
    return res.status(200).json({ success: false, error: "Invalid Instagram URL", errorType: "ValidationError", hint: "Please provide a valid Instagram post URL" });
  }
  
  const result = await downloadInstagram(url);
  res.json({ success: true, data: result });
}));

export const metadata = {
  name: "Instagram Download",
  path: "/api/instagram/download",
  method: "GET, POST",
  description: "Download Instagram photos and videos",
  category: "social-media",
  status: "free",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.instagram.com/p/xxxxx",
      description: "Instagram post URL"
    }
  ]
};

export default router;
