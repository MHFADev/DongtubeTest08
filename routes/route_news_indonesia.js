import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { asyncHandler } from "../utils/validation.js";
import https from "https";

const router = Router();

// Axios instance with better headers and SSL bypass
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  }),
  timeout: 30000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1"
  }
});

// Cache middleware
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

// Tribunnews - Updated selectors
async function scrapeTribunNews() {
  const response = await axiosInstance.get("https://www.tribunnews.com");
  const $ = cheerio.load(response.data);
  const result = [];

  // Try multiple selectors
  $("li.art-list, article.txt-article, .latest__item").each((i, e) => {
    let title = $(e).find("h3 a, h2 a, .latest__title a").first().text().trim();
    let link = $(e).find("h3 a, h2 a, .latest__title a").first().attr("href");
    let image_thumbnail = $(e).find("img").first().attr("src") || $(e).find("img").first().attr("data-src");
    let time = $(e).find("time").attr("title") || $(e).find(".grey time").text().trim();

    if (title && link) {
      result.push({ title, link, image_thumbnail, time });
    }
  });

  return result;
}

// CNN Indonesia
async function scrapeCNNIndonesia() {
  const response = await axiosInstance.get("https://www.cnnindonesia.com");
  const $ = cheerio.load(response.data);
  const result = [];

  $("article, .media_rows, .media__item").each((i, e) => {
    const tagA = $(e).find("a").first();
    let title = tagA.attr("dtr-ttl") || tagA.find("h2, h3").text().trim() || tagA.attr("title");
    let image = $(e).find("img").attr("src") || $(e).find("img").attr("data-src");
    let link = tagA.attr("href");

    if (title && link) {
      if (!link.startsWith("http")) link = "https://www.cnnindonesia.com" + link;
      result.push({ title, image, link });
    }
  });

  return result;
}

// Liputan6 - Updated selectors
async function scrapeLiputan6() {
  const response = await axiosInstance.get("https://www.liputan6.com");
  const $ = cheerio.load(response.data);
  const result = [];

  $("article, .articles--rows--item, .ui--card, .articles--iridescent-list article").each((i, e) => {
    let title = $(e).find("h4 a, h3 a, .title a, [class*='title'] a").first().text().trim();
    let link = $(e).find("h4 a, h3 a, .title a, [class*='title'] a").first().attr("href");
    let image = $(e).find("img").first().attr("src") || $(e).find("img").first().attr("data-src");
    let time = $(e).find("time, [class*='time']").first().text().trim();

    if (title && link) {
      if (!link.startsWith("http")) link = "https://www.liputan6.com" + link;
      result.push({ title, link, image, time });
    }
  });

  return result;
}

// Sindonews
async function scrapeSindonews() {
  const response = await axiosInstance.get("https://www.sindonews.com/");
  const $ = cheerio.load(response.data);
  const articles = [];

  $(".list-article, .homelist, article").each((index, element) => {
    const title = $(element).find(".title-article, h2 a, h3 a").first().text().trim();
    const link = $(element).find("a").first().attr("href");
    const category = $(element).find(".sub-kanal, .category").first().text().trim();
    const timestamp = $(element).find(".date-article, time").first().text().trim();
    const imageUrl = $(element).find("img").first().attr("data-src") || $(element).find("img").first().attr("src");

    if (title && link) {
      articles.push({ title, link, category, timestamp, imageUrl });
    }
  });

  return articles;
}

// Merdeka
async function scrapeMerdeka() {
  const response = await axiosInstance.get("https://www.merdeka.com/peristiwa/");
  const $ = cheerio.load(response.data);
  const results = [];

  $(".box-headline ul li.item, article, .list-news li").each((_, element) => {
    const title = $(element).find(".item-title a, h3 a, h2 a").first().text().trim();
    let link = $(element).find(".item-title a, h3 a, h2 a").first().attr("href");
    let image = $(element).find("img").first().attr("src") || $(element).find("img").first().attr("data-src");
    const category = $(element).find(".item-tag, .category").first().text().trim();
    const date = $(element).find(".item-date, time").first().text().trim();

    if (image && !image.startsWith("http")) image = "https://www.merdeka.com" + image;
    if (link && !link.startsWith("http")) link = "https://www.merdeka.com" + link;

    if (title && link) {
      results.push({ title, link, image, category, date });
    }
  });

  return results;
}

// Suara
async function scrapeSuara() {
  const response = await axiosInstance.get("https://www.suara.com/news");
  const $ = cheerio.load(response.data);
  const results = [];

  $(".list-item-x .item, article, .news-item").each((_, element) => {
    const title = $(element).find("h2 a, h3 a, .title a").first().text().trim();
    const link = $(element).find("h2 a, h3 a, .title a").first().attr("href");
    const image = $(element).find("img").first().attr("src") || $(element).find("img").first().attr("data-src");
    const category = $(element).find(".c-default, .category").first().text().trim();

    if (title && link) {
      results.push({ title, link, image, category });
    }
  });

  return results;
}

// Antara
async function scrapeAntara() {
  const response = await axiosInstance.get("https://www.antaranews.com");
  const $ = cheerio.load(response.data);
  const results = [];

  $("#editor_picks .item, article, .post").each((_, element) => {
    const title = $(element).find(".post_title a, h3 a, h2 a").first().text().trim();
    const link = $(element).find(".post_title a, h3 a, h2 a").first().attr("href");
    const image = $(element).find("img").first().data("src") || $(element).find("img").first().attr("src");
    const category = $(element).find(".text-primary, .category").first().text().trim();

    if (title && link) {
      results.push({ title, link, image, category });
    }
  });

  return results;
}

// CNBC Indonesia
async function scrapeCNBC() {
  const response = await axiosInstance.get("https://www.cnbcindonesia.com/news");
  const $ = cheerio.load(response.data);
  const results = [];

  $("article, .list, .gtm_list_article").each((_, element) => {
    const $link = $(element).find("a").first();
    const link = $link.attr("href");
    const image = $(element).find("img").first().attr("src") || $(element).find("img").first().attr("data-src");
    const title = $link.find("h2, h3, h4").first().text().trim() || $link.attr("title");
    const category = $(element).find(".text-cnbc-support-orange, .category").first().text().trim().replace("Video", "").trim();
    const date = $(element).find(".text-gray, time").first().text().trim();

    if (title && link) {
      results.push({ title, link, image, category, date });
    }
  });

  return results;
}

// JKT48 - With more aggressive headers
async function scrapeJKT48() {
  const response = await axiosInstance.get("https://jkt48.com/news/list?lang=id", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Referer": "https://jkt48.com/",
      "DNT": "1",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Cache-Control": "max-age=0"
    }
  });

  const $ = cheerio.load(response.data);
  const results = [];

  $(".entry-news__list, .news-item, article").each((_, element) => {
    if ($(element).hasClass("entry-news__list--pagination")) return;

    let title = $(element).find("h3 a, h2 a, .title a").first().text().trim();
    let link = $(element).find("h3 a, h2 a, .title a").first().attr("href");
    const date = $(element).find("time").first().text().trim();
    let icon = $(element).find(".entry-news__list--label img, img").first().attr("src");

    if (link && !link.startsWith("http")) link = "https://jkt48.com" + link;
    if (icon && !icon.startsWith("http")) icon = "https://jkt48.com" + icon;

    if (title && link) {
      results.push({ title, link, date, icon });
    }
  });

  return results;
}

// Register routes


router.get("/api/news/cnn", cacheMiddleware(10 * 60 * 1000), asyncHandler(async (req, res) => {
  const data = await scrapeCNNIndonesia();
  res.json({ success: true, source: "CNN Indonesia", count: data.length, data });
}));


router.get("/api/news/sindonews", cacheMiddleware(10 * 60 * 1000), asyncHandler(async (req, res) => {
  const data = await scrapeSindonews();
  res.json({ success: true, source: "Sindonews", count: data.length, data });
}));

router.get("/api/news/merdeka", cacheMiddleware(10 * 60 * 1000), asyncHandler(async (req, res) => {
  const data = await scrapeMerdeka();
  res.json({ success: true, source: "Merdeka", count: data.length, data });
}));

router.get("/api/news/suara", cacheMiddleware(10 * 60 * 1000), asyncHandler(async (req, res) => {
  const data = await scrapeSuara();
  res.json({ success: true, source: "Suara.com", count: data.length, data });
}));

router.get("/api/news/antara", cacheMiddleware(10 * 60 * 1000), asyncHandler(async (req, res) => {
  const data = await scrapeAntara();
  res.json({ success: true, source: "Antara News", count: data.length, data });
}));

router.get("/api/news/cnbc", cacheMiddleware(10 * 60 * 1000), asyncHandler(async (req, res) => {
  const data = await scrapeCNBC();
  res.json({ success: true, source: "CNBC Indonesia", count: data.length, data });
}));


export const metadata = [
  {
    name: "CNN Indonesia",
    path: "/api/news/cnn",
    method: "GET",
    description: "Breaking news from CNN Indonesia",
    category: "news",
    status: "free",
    params: []
  },
  {
    name: "Sindonews",
    path: "/api/news/sindonews",
    method: "GET",
    description: "Latest headlines from Sindonews with categories",
    category: "news",
    status: "free",
    params: []
  },
  {
    name: "Merdeka News",
    path: "/api/news/merdeka",
    method: "GET",
    description: "Breaking news and events from Merdeka.com",
    category: "news",
    status: "free",
    params: []
  },
  {
    name: "Suara News",
    path: "/api/news/suara",
    method: "GET",
    description: "News covering politics, business, lifestyle from Suara.com",
    category: "news",
    status: "free",
    params: []
  },
  {
    name: "Antara News",
    path: "/api/news/antara",
    method: "GET",
    description: "Official news from Indonesia's leading news agency",
    category: "news",
    status: "free",
    params: []
  },
  {
    name: "CNBC Indonesia",
    path: "/api/news/cnbc",
    method: "GET",
    description: "Business and financial news from CNBC Indonesia",
    category: "news",
    status: "free",
    params: []
  }
];

export default router;