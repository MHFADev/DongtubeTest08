import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { validate, unifiedHandler } from "../utils/validation.js";

const router = Router();

async function textToImage(prompt) {
  const res = await axios.post(
    "https://www.texttoimage.org/generate",
    new URLSearchParams({ prompt }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "Accept": "application/json, text/javascript, */*; q=0.01", "X-Requested-With": "XMLHttpRequest" } }
  );
  
  if (!res.data.success) throw new Error("Failed to generate image");
  
  const pageUrl = `https://www.texttoimage.org/${res.data.url}`;
  const html = await axios.get(pageUrl);
  const $ = cheerio.load(html.data);
  const imageUrl = $('meta[property="og:image"]').attr("content") || $("img").first().attr("src");
  
  return { prompt, pageUrl, imageUrl };
}

router.all("/maker/text2img", unifiedHandler(async (params, req, res) => {
  const { prompt } = params;
  
  if (!validate.notEmpty(prompt)) {
    return res.status(200).json({ success: false, error: "Prompt is required", errorType: "ValidationError", hint: "Please provide a text prompt for image generation" });
  }
  
  const result = await textToImage(prompt);
  res.json({ success: true, data: result });
}));

export const metadata = [
  {
    name: "Text to Image",
    path: "/maker/text2img",
    method: "GET, POST",
    description: "Generate images from text prompts",
    category: "ai",
    status: "free",
    params: [{ name: "prompt", type: "text", required: true, placeholder: "cat yellow", description: "Image generation prompt" }]
  }
];

export default router;
