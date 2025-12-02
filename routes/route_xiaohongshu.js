import { Router } from "express";
import axios from "axios";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

class Xiaohongshu {
  constructor() {
    this.api = {
      base: "https://rednote-downloader.io",
      endpoint: "/api/download",
    };
    this.client = axios.create({
      baseURL: this.api.base,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
        "Referer": "https://rednote-downloader.io/?ref=api",
      },
      timeout: 30000
    });
  }

  async download({ url }) {
    if (!url || !validate.url(url)) {
      throw new Error("Invalid Xiaohongshu URL");
    }

    const { data } = await this.client.post(this.api.endpoint, { url });
    if (!data) {
      throw new Error("No media found in this Xiaohongshu post");
    }

    return data;
  }
}

const xhs = new Xiaohongshu();

router.get("/api/xiaohongshu/download", asyncHandler(async (req, res) => {
  const { url } = req.query;
  
  if (!validate.url(url)) {
    return res.status(200).json({
      success: false,
      error: "Valid Xiaohongshu URL is required",
      errorType: "ValidationError",
      hint: "Please provide a valid Xiaohongshu post URL"
    });
  }
  
  const result = await xhs.download({ url: url.trim() });
  res.json({
    success: true,
    data: result
  });
}));

router.post("/api/xiaohongshu/download", asyncHandler(async (req, res) => {
  const { url } = req.body;
  
  if (!validate.url(url)) {
    return res.status(200).json({
      success: false,
      error: "Valid Xiaohongshu URL is required",
      errorType: "ValidationError",
      hint: "Please provide a valid Xiaohongshu post URL"
    });
  }
  
  const result = await xhs.download({ url: url.trim() });
  res.json({
    success: true,
    data: result
  });
}));

export const metadata = {
  name: "Xiaohongshu (RedNote) Download",
  path: "/api/xiaohongshu/download",
  method: "GET, POST",
  description: "Download photos and videos from Xiaohongshu (Little Red Book / RedNote)",
  category: "social-media",
  status: "free",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.xiaohongshu.com/explore/xxxxx",
      description: "Xiaohongshu post URL"
    }
  ]
};

export default router;