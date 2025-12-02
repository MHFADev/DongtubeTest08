import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { validate, asyncHandler } from "../utils/validation.js";
import HTTPClient from "../utils/HTTPClient.js";

const router = Router();
const httpClient = new HTTPClient("", {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  }
});

async function scrapeWikipedia(url) {
  const data = await httpClient.get(url);
  
  const $ = cheerio.load(data);

  const contentTitle = $("#firstHeading").text().trim();

  const content = [];
  $("#mw-content-text .mw-parser-output > p").each((i, el) => {
    const text = $(el).text().replace(/\[\d+\]/g, "").trim();
    if (text) content.push(text);
  });

  const images = [];
  $("#mw-content-text .mw-parser-output img").each((i, el) => {
    if (i >= 3) return false;
    const src = $(el).attr("src");
    if (src) images.push(src.startsWith("http") ? src : "https:" + src);
  });

  const infobox = {};
  $(".infobox tr").each((i, el) => {
    const th = $(el).find("th").first().text().trim();
    const tdEl = $(el).find("td").first();
    let td = "";
    if (tdEl.find("li").length) {
      td = tdEl
        .find("li")
        .map((i, li) => $(li).text().trim())
        .get()
        .join(", ");
    } else {
      td = tdEl.text().trim();
    }
    td = td.replace(/\[\w+\]/g, "");
    if (th && td) infobox[th] = td;
  });

  return { 
    title: contentTitle, 
    content: content.slice(0, 7), 
    images, 
    infobox 
  };
}

async function searchAndScrapeWikipedia(query, lang = "id") {
  // Search Wikipedia using API
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`;
  const data = await httpClient.get(searchUrl);
  
  if (!data[1] || data[1].length === 0) {
    throw new Error("No results found");
  }
  
  const firstResult = {
    title: data[1][0],
    description: data[2][0],
    url: data[3][0]
  };
  
  // Scrape the first result
  const scraped = await scrapeWikipedia(firstResult.url);
  
  return {
    search: firstResult,
    article: scraped
  };
}

// Combined search and scrape endpoint
router.get("/api/wikipedia", asyncHandler(async (req, res) => {
  const { query, lang = "id" } = req.query;
  
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ 
      success: false, 
      error: "Query is required",
      errorType: "ValidationError",
      hint: "Please provide a search query"
    });
  }
  
  const result = await searchAndScrapeWikipedia(query, lang);
  res.json({ success: true, data: result });
}));

router.post("/api/wikipedia", asyncHandler(async (req, res) => {
  const { query, lang = "id" } = req.body;
  
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ 
      success: false, 
      error: "Query is required",
      errorType: "ValidationError",
      hint: "Please provide a search query"
    });
  }
  
  const result = await searchAndScrapeWikipedia(query, lang);
  res.json({ success: true, data: result });
}));

export const metadata = {
  name: "Wikipedia Search & Scrape",
  path: "/api/wikipedia",
  method: "GET, POST",
  description: "Search Wikipedia and get full article content in one request",
  category: "search",
  status: "free",
  params: [
    {
      name: "query",
      type: "text",
      required: true,
      placeholder: "Sepak bola",
      description: "Search query"
    },
    {
      name: "lang",
      type: "text",
      required: false,
      placeholder: "id",
      description: "Language code (id, en, etc)"
    }
  ]
};

export default router;