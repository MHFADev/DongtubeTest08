import { Router } from "express";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import HTTPClient from "../utils/HTTPClient.js";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

class Ideogram {
  constructor() {
    this.IV = "Hid8sUW70idf2Duv";
    this.keyPassword = "X7aB9cD2EfGhJ5Kq";
    this.saltPassword = "9371052846137285";
    this.client = new HTTPClient("https://us-central1-chatbotandroid-3894d.cloudfunctions.net");
  }
  
  async generate(prompt, options = {}) {
    if (!validate.notEmpty(prompt)) {
      throw new Error("Prompt is required");
    }
    
    const encrypted = await this._encrypt({
      aspect_ratio: options.aspect_ratio || "ASPECT_1_1",
      detail: "50",
      image_file: "",
      magic_prompt_option: options.magic_prompt_option || "AUTO",
      negative_prompt: options.negative_prompt || "",
      prompt,
      request_type: "Generate",
      resemblance: "50",
      speed: "V_1",
      style_type: "AUTO"
    });
    
    return await this.client.post("/chatbotandroid", { data: encrypted });
  }
  
  async _encrypt(requestMessage) {
    const timestamp = Date.now();
    const requestId = `ideogram|${timestamp}|nw_connection_copy_connected_local_endpoint_block_invoke|${uuidv4()}`;
    const requestJson = JSON.stringify({
      messages: requestMessage,
      authorization: requestId
    });
    
    const keyPasswordHash = crypto.createHash("sha256").update(this.keyPassword).digest();
    const derivedKey = await new Promise((resolve, reject) => {
      crypto.pbkdf2(this.saltPassword, keyPasswordHash, 1000, 32, "sha1", (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
    
    const secretKey = crypto.createHash("sha256").update(derivedKey.toString("base64")).digest();
    const ivBuffer = Buffer.from(this.IV, "base64");
    const cipher = crypto.createCipheriv("aes-256-gcm", secretKey, ivBuffer, { authTagLength: 16 });
    
    let encrypted = cipher.update(requestJson, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    return this.IV + Buffer.concat([encrypted, authTag]).toString("base64");
  }
}

const ideogram = new Ideogram();

router.get("/api/ideogram/generate", asyncHandler(async (req, res) => {
  const result = await ideogram.generate(req.query.prompt, {
    aspect_ratio: req.query.aspect_ratio,
    magic_prompt_option: req.query.magic_prompt_option,
    negative_prompt: req.query.negative_prompt
  });
  res.json({ success: true, data: result });
}));

router.post("/api/ideogram/generate", asyncHandler(async (req, res) => {
  const result = await ideogram.generate(req.body.prompt, {
    aspect_ratio: req.body.aspect_ratio,
    magic_prompt_option: req.body.magic_prompt_option,
    negative_prompt: req.body.negative_prompt
  });
  res.json({ success: true, data: result });
}));

export const metadata = {
  name: "Ideogram AI Generate",
  path: "/api/ideogram/generate",
  method: "GET, POST",
  description: "Generate images using Ideogram AI",
  category: "ai",
  status: "free",
  params: [
    {
      name: "prompt",
      type: "text",
      required: true,
      placeholder: "a beautiful sunset over mountains",
      description: "Image generation prompt"
    },
    {
      name: "aspect_ratio",
      type: "text",
      required: false,
      placeholder: "ASPECT_1_1",
      description: "Aspect ratio (ASPECT_1_1, ASPECT_16_9, etc)"
    },
    {
      name: "negative_prompt",
      type: "text",
      required: false,
      placeholder: "blurry, low quality",
      description: "Negative prompt"
    }
  ]
};

export default router;
