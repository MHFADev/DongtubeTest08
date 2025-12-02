import { Router } from "express";
import axios from "axios";
import { asyncHandler } from "../utils/validation.js";

const router = Router();

// Generate BRAT Image
async function generateBratImage(text, background = null, color = null) {
  const params = new URLSearchParams();
  params.append("text", text);
  if (background) params.append("background", background);
  if (color) params.append("color", color);
  
  const response = await axios.get(`https://raolbyte-brat.hf.space/maker/brat?${params.toString()}`, {
    timeout: 30000,
    headers: { "User-Agent": "Raol-APIs/2.0.0" }
  });
  
  if (!response.data?.image_url) throw new Error("Invalid response from BRAT API");
  
  const imageResponse = await axios.get(response.data.image_url, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: { "User-Agent": "Raol-APIs/2.0.0" }
  });
  
  return Buffer.from(imageResponse.data);
}

// Generate BRAT Video
async function generateBratVideo(text, background = null, color = null) {
  const params = new URLSearchParams();
  params.append("text", text);
  if (background) params.append("background", background);
  if (color) params.append("color", color);
  
  const response = await axios.get(`https://raolbyte-brat.hf.space/maker/bratvid?${params.toString()}`, {
    timeout: 60000,
    headers: { "User-Agent": "Raol-APIs/2.0.0" }
  });
  
  if (!response.data?.video_url) throw new Error("Invalid response from BRATVID API");
  
  const videoResponse = await axios.get(response.data.video_url, {
    responseType: "arraybuffer",
    timeout: 60000,
    headers: { "User-Agent": "Raol-APIs/2.0.0" }
  });
  
  return Buffer.from(videoResponse.data);
}

// BRAT Image endpoint
router.get("/maker/brat", asyncHandler(async (req, res) => {
  const { text, background, color } = req.query;
  
  if (!text) {
    return res.status(200).json({
      success: false,
      error: "Missing required parameter: text",
      errorType: "ValidationError",
      hint: "Please provide text for the BRAT image"
    });
  }
  
  if (text.length > 500) {
    return res.status(200).json({
      success: false,
      error: "Text must be 500 characters or less",
      errorType: "ValidationError"
    });
  }
  
  if (background && !/^#[0-9A-Fa-f]{6}$/.test(background)) {
    return res.status(200).json({
      success: false,
      error: "Background color must be in hex format (e.g., #000000)",
      errorType: "ValidationError"
    });
  }
  
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return res.status(200).json({
      success: false,
      error: "Text color must be in hex format (e.g., #FFFFFF)",
      errorType: "ValidationError"
    });
  }
  
  const imageBuffer = await generateBratImage(text, background, color);
  
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Length", imageBuffer.length);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="brat_${Date.now()}.png"`);
  res.end(imageBuffer);
}));

// BRAT Video endpoint
router.get("/maker/bratvid", asyncHandler(async (req, res) => {
  const { text, background, color } = req.query;
  
  if (!text) {
    return res.status(200).json({
      success: false,
      error: "Missing required parameter: text",
      errorType: "ValidationError",
      hint: "Please provide text for the BRAT video"
    });
  }
  
  if (text.length > 500) {
    return res.status(200).json({
      success: false,
      error: "Text must be 500 characters or less",
      errorType: "ValidationError"
    });
  }
  
  if (background && !/^#[0-9A-Fa-f]{6}$/.test(background)) {
    return res.status(200).json({
      success: false,
      error: "Background color must be in hex format (e.g., #000000)",
      errorType: "ValidationError"
    });
  }
  
  if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return res.status(200).json({
      success: false,
      error: "Text color must be in hex format (e.g., #FFFFFF)",
      errorType: "ValidationError"
    });
  }
  
  const videoBuffer = await generateBratVideo(text, background, color);
  
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Length", videoBuffer.length);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="bratvid_${Date.now()}.mp4"`);
  res.setHeader("Accept-Ranges", "bytes");
  
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoBuffer.length - 1;
    const chunksize = end - start + 1;
    const chunk = videoBuffer.slice(start, end + 1);
    
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${videoBuffer.length}`);
    res.setHeader("Content-Length", chunksize);
    res.end(chunk);
  } else {
    res.end(videoBuffer);
  }
}));

export const metadata = [
  {
    name: "BRAT Image Maker",
    path: "/maker/brat",
    method: "GET",
    description: "Generate BRAT style images with custom text",
    category: "tools",
    status: "free",
    responseBinary: true,
    params: [
      {
        name: "text",
        type: "text",
        required: true,
        placeholder: "brat summer",
        description: "Text to display (max 500 chars)"
      },
      {
        name: "background",
        type: "text",
        required: false,
        placeholder: "#8ACE00",
        description: "Background color in hex format"
      },
      {
        name: "color",
        type: "text",
        required: false,
        placeholder: "#000000",
        description: "Text color in hex format"
      }
    ]
  },
  {
    name: "BRAT Video Maker",
    path: "/maker/bratvid",
    method: "GET",
    description: "Generate BRAT style animated videos",
    category: "tools",
    status: "free",
    responseBinary: true,
    params: [
      {
        name: "text",
        type: "text",
        required: true,
        placeholder: "brat summer",
        description: "Text to display (max 500 chars)"
      },
      {
        name: "background",
        type: "text",
        required: false,
        placeholder: "#8ACE00",
        description: "Background color in hex format"
      },
      {
        name: "color",
        type: "text",
        required: false,
        placeholder: "#000000",
        description: "Text color in hex format"
      }
    ]
  }
];

export default router;