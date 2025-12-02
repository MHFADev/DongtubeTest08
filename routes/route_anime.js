import { Router } from "express";
import axios from "axios";
import { asyncHandler } from "../utils/validation.js";

const router = Router();

// Random Neko Image
async function getRandomNekoImage() {
  const { data } = await axios.get("https://api.waifu.pics/sfw/neko", {
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  
  if (!data?.url) throw new Error("Invalid API response: no image URL");
  
  const response = await axios.get(data.url, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  
  return {
    buffer: Buffer.from(response.data),
    contentType: response.headers["content-type"] || "image/jpeg"
  };
}

router.get("/api/r/neko", asyncHandler(async (req, res) => {
  const { buffer, contentType } = await getRandomNekoImage();
  
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="neko_${Date.now()}.${contentType.split("/")[1]}"`);
  res.end(buffer);
}));

router.post("/api/r/neko", asyncHandler(async (req, res) => {
  const { buffer, contentType } = await getRandomNekoImage();
  
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="neko_${Date.now()}.${contentType.split("/")[1]}"`);
  res.end(buffer);
}));

// Random Waifu Image
async function getRandomWaifuImage() {
  const { data } = await axios.get("https://api.waifu.pics/sfw/waifu", {
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  
  if (!data?.url) throw new Error("Invalid API response: no image URL");
  
  const response = await axios.get(data.url, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  
  return Buffer.from(response.data);
}

router.get("/api/r/waifu", asyncHandler(async (req, res) => {
  const imageBuffer = await getRandomWaifuImage();
  
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Length", imageBuffer.length);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="waifu_${Date.now()}.jpg"`);
  res.end(imageBuffer);
}));

router.post("/api/r/waifu", asyncHandler(async (req, res) => {
  const imageBuffer = await getRandomWaifuImage();
  
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Content-Length", imageBuffer.length);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Disposition", `inline; filename="waifu_${Date.now()}.jpg"`);
  res.end(imageBuffer);
}));

export const metadata = [
  {
    name: "Random Neko",
    path: "/api/r/neko",
    method: "GET, POST",
    description: "Get random neko anime images",
    category: "entertainment",
    status: "free",
    responseBinary: true,
    params: []
  },
  {
    name: "Random Waifu",
    path: "/api/r/waifu",
    method: "GET, POST",
    description: "Get random waifu anime images",
    category: "entertainment",
    status: "free",
    responseBinary: true,
    params: []
  }
];

export default router;