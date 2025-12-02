import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import HTTPClient from "../utils/HTTPClient.js";
import { asyncHandler } from "../utils/validation.js";

const router = Router();

class Anhmoe extends HTTPClient {
  constructor() {
    super("https://anh.moe", {
      headers: { 
        Origin: "https://anh.moe",
        Referer: "https://anh.moe/",
        "User-Agent": "Zanixon/1.0.0"
      }
    });
    this.validCategories = [
      "sfw",
      "nsfw", 
      "video-gore",
      "video-nsfw",
      "moe",
      "ai-picture",
      "hentai"
    ];
  }
  
  async getCategory(category, page = null) {
    if (!this.validCategories.includes(category)) {
      throw new Error(`Invalid category: ${category}. Valid options are: ${this.validCategories.join(", ")}`);
    }

    const url = page ? page : `/category/${category}`;
    const response = page 
      ? await axios.get(url, { headers: this.client.defaults.headers })
      : await this.get(url);
    
    const html = typeof response === 'string' ? response : response;
    const $ = cheerio.load(html);
    const $listItems = $(".list-item");

    const items = [];
    $listItems.each((_, el) => {
      const $el = $(el);

      let data = {};
      const rawData = $el.attr("data-object");
      if (rawData) {
        try {
          data = JSON.parse(decodeURIComponent(rawData));
        } catch {
          // Skip if can't parse
        }
      }

      const title = $el.find(".list-item-desc-title a").attr("title") || data.title || "No title";
      const viewLink = $el.find(".list-item-image a").attr("href");
      const uploadBy = $el.find(".list-item-desc-title div").text();
      const imgUrl = data.image?.url || $el.find("img").attr("src") || "";

      if (imgUrl) {
        items.push({
          type: data.type || "image",
          title,
          viewLink: viewLink ? `https://anh.moe${viewLink}` : null,
          image: {
            url: imgUrl,
            sizeFormatted: data.size_formatted,
            width: data.width,
            height: data.height,
            uploaded: data.how_long_ago
          },
          uploadBy
        });
      }
    });

    const next = $("li.pagination-next a").attr("href") || null;
    const prev = $("li.pagination-prev a").attr("href") || null;
    const nextPage = next ? `https://anh.moe${next}` : null;
    const prevPage = prev ? `https://anh.moe${prev}` : null;

    return {
      category,
      contents: items,
      nextPage,
      prevPage
    };
  }
  
  getCategories() {
    return this.validCategories;
  }
}

const anh = new Anhmoe();

// Get categories list
router.get("/api/anhmoe/categories", (req, res) => {
  res.json({
    success: true,
    categories: anh.getCategories(),
    total: anh.getCategories().length
  });
});

// Get random by specific category (/:category dynamic route)
router.get("/api/anhmoe/:category", asyncHandler(async (req, res) => {
  const { category } = req.params;
  const validCategories = anh.getCategories();
  
  if (!validCategories.includes(category)) {
    return res.status(200).json({
      success: false,
      error: "Invalid category",
      errorType: "ValidationError",
      available_categories: validCategories
    });
  }
  
  const result = await anh.getCategory(category);
  if (!result.contents || result.contents.length === 0) {
    return res.status(200).json({
      success: false,
      error: "No content found",
      errorType: "NotFoundError"
    });
  }
  
  const randomItem = result.contents[Math.floor(Math.random() * result.contents.length)];
  
  res.json({ 
    success: true, 
    category,
    data: randomItem
  });
}));

// Legacy /random endpoint (GET & POST)
router.get("/api/anhmoe/random", asyncHandler(async (req, res) => {
  const { category = "sfw" } = req.query;
  const validCategories = anh.getCategories();
  
  if (!validCategories.includes(category)) {
    return res.status(200).json({
      success: false,
      error: "Invalid category",
      errorType: "ValidationError",
      available_categories: validCategories
    });
  }
  
  const result = await anh.getCategory(category);
  if (!result.contents || result.contents.length === 0) {
    return res.status(200).json({
      success: false,
      error: "No content found",
      errorType: "NotFoundError"
    });
  }
  
  const randomItem = result.contents[Math.floor(Math.random() * result.contents.length)];
  
  res.json({ 
    success: true, 
    category, 
    data: randomItem 
  });
}));

router.post("/api/anhmoe/random", asyncHandler(async (req, res) => {
  const { category = "sfw" } = req.body;
  const validCategories = anh.getCategories();
  
  if (!validCategories.includes(category)) {
    return res.status(200).json({
      success: false,
      error: "Invalid category",
      errorType: "ValidationError",
      available_categories: validCategories
    });
  }
  
  const result = await anh.getCategory(category);
  if (!result.contents || result.contents.length === 0) {
    return res.status(200).json({
      success: false,
      error: "No content found",
      errorType: "NotFoundError"
    });
  }
  
  const randomItem = result.contents[Math.floor(Math.random() * result.contents.length)];
  
  res.json({ 
    success: true, 
    category, 
    data: randomItem 
  });
}));

export const metadata = [
  {
    name: "Anhmoe Categories",
    path: "/api/anhmoe/categories",
    method: "GET",
    description: "Get all available Anhmoe categories",
    category: "entertainment",
    status: "free",
    params: []
  },
  {
    name: "Anhmoe SFW",
    path: "/api/anhmoe/sfw",
    method: "GET",
    description: "Get random SFW images",
    category: "entertainment",
    status: "free",
    params: []
  },
  {
    name: "Anhmoe NSFW",
    path: "/api/anhmoe/nsfw",
    method: "GET",
    description: "Get random NSFW images",
    category: "entertainment",
    status: "premium",
    params: []
  },
  {
    name: "Anhmoe Video Gore",
    path: "/api/anhmoe/video-gore",
    method: "GET",
    description: "Get random video gore content",
    category: "entertainment",
    status: "premium",
    params: []
  },
  {
    name: "Anhmoe Video NSFW",
    path: "/api/anhmoe/video-nsfw",
    method: "GET",
    description: "Get random NSFW videos",
    category: "entertainment",
    status: "premium",
    params: []
  },
  {
    name: "Anhmoe Moe",
    path: "/api/anhmoe/moe",
    method: "GET",
    description: "Get random moe images",
    category: "entertainment",
    status: "free",
    params: []
  },
  {
    name: "Anhmoe AI Picture",
    path: "/api/anhmoe/ai-picture",
    method: "GET",
    description: "Get random AI-generated images",
    category: "ai",
    status: "free",
    params: []
  },
  {
    name: "Anhmoe Hentai",
    path: "/api/anhmoe/hentai",
    method: "GET",
    description: "Get random hentai images",
    category: "entertainment",
    status: "premium",
    params: []
  },
  {
    name: "Anhmoe Random",
    path: "/api/anhmoe/random",
    method: "GET, POST",
    description: "Get random images from Anh.moe",
    category: "entertainment",
    status: "free",
    params: [
      {
        name: "category",
        type: "text",
        required: false,
        placeholder: "sfw",
        description: "Category: sfw, nsfw, video-gore, video-nsfw, moe, ai-picture, hentai"
      }
    ]
  }
];

export default router;
