import { Router } from "express";
import * as cheerio from "cheerio";
import HTTPClient from "../utils/HTTPClient.js";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

class MAL extends HTTPClient {
  constructor() {
    super("https://myanimelist.net");
  }
  
  async topAnime() {
    const html = await this.get("/topanime.php");
    const $ = cheerio.load(html);
    const list = [];
    
    $(".ranking-list").each((i, el) => {
      if (i >= 50) return false;
      const $el = $(el);
      list.push({
        rank: $el.find(".rank").text().trim(),
        title: $el.find(".title h3 a").text().trim(),
        url: $el.find(".title h3 a").attr("href"),
        score: $el.find(".score span").text().trim(),
        cover: $el.find(".title img").attr("data-src"),
        type: $el.find(".information").text().split("\n")[1]?.trim(),
        release: $el.find(".information").text().split("\n")[2]?.trim()
      });
    });
    
    return list;
  }
  
  async search(query, type = "anime") {
    if (!validate.notEmpty(query)) throw new Error("Query is required");
    
    const html = await this.get(`/${type}.php`, {
      params: { q: query, cat: type }
    });
    const $ = cheerio.load(html);
    const list = [];
    
    $("table tbody tr").each((i, el) => {
      if (i >= 20) return false;
      const $el = $(el);
      const title = $el.find("td:nth-child(2) strong").text().trim();
      const url = $el.find("td:nth-child(2) a").attr("href");
      
      if (title && url) {
        list.push({
          title,
          url,
          cover: $el.find("td:nth-child(1) img").attr("data-src") || $el.find("td:nth-child(1) img").attr("src"),
          type: $el.find("td:nth-child(3)").text().trim(),
          score: $el.find("td:nth-child(5)").text().trim(),
          description: $el.find("td:nth-child(2) .pt4").text().replace("read more.", "").trim() || "No description"
        });
      }
    });
    
    return list;
  }
}

const mal = new MAL();

// Cache middleware for top anime (10 minutes)
const cacheMiddleware = (ttl) => {
  const cache = new Map();
  return (req, res, next) => {
    const key = req.originalUrl || req.url;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < ttl) {
      return res.send(cached.data);
    }
    res.sendResponse = res.send;
    res.send = (body) => {
      cache.set(key, { data: body, time: Date.now() });
      res.sendResponse(body);
    };
    next();
  };
};

router.get("/api/mal/top-anime", cacheMiddleware(10 * 60 * 1000), asyncHandler(async (req, res) => {
  const result = await mal.topAnime();
  res.json({ success: true, count: result.length, data: result });
}));

router.get("/api/mal/search", asyncHandler(async (req, res) => {
  const { query, type = "anime" } = req.query;
  
  if (!query || !query.trim()) {
    return res.status(200).json({
      success: false,
      error: "Query is required",
      errorType: "ValidationError",
      hint: "Please provide a search query"
    });
  }
  
  if (!["anime", "manga"].includes(type)) {
    return res.status(200).json({
      success: false,
      error: "Type must be anime or manga",
      errorType: "ValidationError",
      validTypes: ["anime", "manga"]
    });
  }
  
  const result = await mal.search(query, type);
  res.json({ success: true, query, type, count: result.length, data: result });
}));

router.post("/api/mal/search", asyncHandler(async (req, res) => {
  const { query, type = "anime" } = req.body;
  
  if (!query || !query.trim()) {
    return res.status(200).json({
      success: false,
      error: "Query is required",
      errorType: "ValidationError",
      hint: "Please provide a search query"
    });
  }
  
  if (!["anime", "manga"].includes(type)) {
    return res.status(200).json({ success: false, error: "Type must be anime or manga", errorType: "ValidationError", validTypes: ["anime", "manga"] });
  }
  
  const result = await mal.search(query, type);
  res.json({ success: true, type, count: result.length, data: result });
}));

export const metadata = [
  {
    name: "MAL Top Anime",
    path: "/api/mal/top-anime",
    method: "GET",
    description: "Get top anime list from MyAnimeList",
    category: "search",
    status: "free",
    params: []
  },
  {
    name: "MAL Search",
    path: "/api/mal/search",
    method: "GET, POST",
    description: "Search anime or manga on MyAnimeList",
    category: "search",
    status: "free",
    params: [
      {
        name: "query",
        type: "text",
        required: true,
        placeholder: "rimuru",
        description: "Search query"
      },
      {
        name: "type",
        type: "text",
        required: false,
        placeholder: "anime",
        description: "Type: anime or manga"
      }
    ]
  }
];

export default router;
