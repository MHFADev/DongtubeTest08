import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

async function downloadSnackvideo(url) {
  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(html);
    const videoJsonText = $('#VideoObject').html();
    
    if (!videoJsonText) {
      throw new Error("Video data not found");
    }

    const videoData = JSON.parse(videoJsonText);

    return {
      title: videoData.name,
      description: videoData.description,
      videoUrl: videoData.contentUrl,
      thumbnail: videoData.thumbnailUrl?.[0] || null,
      duration: videoData.duration,
      uploadDate: videoData.uploadDate
    };

  } catch (error) {
    throw new Error(`Failed to fetch Snackvideo data: ${error.message}`);
  }
}

router.get("/api/snackvideo/download", asyncHandler(async (req, res) => {
  const { url } = req.query;
  
  if (!validate.url(url, "snackvideo.com")) {
    return res.status(200).json({ 
      success: false, 
      error: "Invalid Snackvideo URL",
      errorType: "ValidationError",
      hint: "Please provide a valid Snackvideo URL"
    });
  }
  
  const result = await downloadSnackvideo(url);
  res.json({ success: true, data: result });
}));

router.post("/api/snackvideo/download", asyncHandler(async (req, res) => {
  const { url } = req.body;
  
  if (!validate.url(url, "snackvideo.com")) {
    return res.status(200).json({ 
      success: false, 
      error: "Invalid Snackvideo URL",
      errorType: "ValidationError",
      hint: "Please provide a valid Snackvideo URL"
    });
  }
  
  const result = await downloadSnackvideo(url);
  res.json({ success: true, data: result });
}));

export const metadata = {
  name: "Snackvideo Download",
  path: "/api/snackvideo/download",
  method: "GET, POST",
  description: "Download Snackvideo videos",
  category: "social-media",
  status: "free",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.snackvideo.com/@user/video/123",
      description: "Snackvideo URL"
    }
  ]
};

export default router;