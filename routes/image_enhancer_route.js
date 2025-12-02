import { Router } from "express";
import axios from "axios";
import FormData from "form-data";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

/**
 * Enhance image quality using ihancer.com API
 * @param {string} url - Public URL of the image
 * @returns {Buffer} Enhanced image buffer
 */
async function enhanceImage(url) {
  if (!validate.url(url)) {
    throw new Error("Invalid or missing image URL");
  }

  try {
    // 1. Download image from URL
    const imgResponse = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    const buffer = Buffer.from(imgResponse.data, "binary");

    // 2. Prepare FormData for enhancement
    const form = new FormData();
    form.append("method", "1");
    form.append("is_pro_version", "false");
    form.append("is_enhancing_more", "false");
    form.append("max_image_size", "high");
    form.append("file", buffer, `image_${Date.now()}.jpg`);

    // 3. Send request to ihancer.com
    const { data } = await axios.post("https://ihancer.com/api/enhance", form, {
      headers: {
        ...form.getHeaders(),
        "accept-encoding": "gzip",
        "host": "ihancer.com",
        "user-agent": "Dart/3.5 (dart:io)"
      },
      responseType: "arraybuffer",
      timeout: 60000
    });

    return Buffer.from(data);
  } catch (error) {
    console.error("Image Enhancer Error:", error.message);

    if (error.code === "ECONNABORTED") {
      throw new Error("Request timeout - Enhancer API took too long to respond");
    } else if (error.response) {
      throw new Error(`Enhancer API error: ${error.response.status} - Failed to process image`);
    } else {
      throw new Error(`Image enhancement failed: ${error.message}`);
    }
  }
}

// GET endpoint
router.get("/api/enhance/image", asyncHandler(async (req, res) => {
  const { url } = req.query;

  if (!validate.url(url)) {
    return res.status(200).json({
      success: false,
      error: "Invalid or missing image URL parameter",
      errorType: "ValidationError",
      hint: "Please provide a valid image URL"
    });
  }

  const imageBuffer = await enhanceImage(url);

  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Length", imageBuffer.length);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="enhanced_${Date.now()}.jpeg"`);
  
  res.end(imageBuffer);
}));

// POST endpoint
router.post("/api/enhance/image", asyncHandler(async (req, res) => {
  const { url } = req.body;

  if (!validate.url(url)) {
    return res.status(200).json({
      success: false,
      error: "Invalid or missing image URL parameter",
      errorType: "ValidationError",
      hint: "Please provide a valid image URL"
    });
  }

  const imageBuffer = await enhanceImage(url);

  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Length", imageBuffer.length);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="enhanced_${Date.now()}.jpeg"`);
  
  res.end(imageBuffer);
}));

export const metadata = {
  name: "Image Enhancer",
  path: "/api/enhance/image",
  method: "GET, POST",
  description: "Enhance image quality using AI-powered enhancement",
  category: "image",
  status: "free",
  responseBinary: true,
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://example.com/image.jpg",
      description: "Public URL of the image to enhance"
    }
  ]
};

export default router;