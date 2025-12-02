import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

// AN1.com Search
async function searchAN1(search) {
  const response = await axios.get(
    `https://an1.com/?story=${search}&do=search&subaction=search`,
    {
      timeout: 30000,
      headers: { "User-Agent": "Mozilla/5.0" }
    }
  );
  
  const $ = cheerio.load(response.data);
  const applications = [];
  
  $(".item").each((index, element) => {
    const $element = $(element);
    const app = {
      title: $element.find(".name a span").text().trim(),
      link: $element.find(".name a").attr("href"),
      developer: $element.find(".developer").text().trim(),
      image: $element.find(".img img").attr("src"),
      rating: {
        value: parseFloat($element.find(".current-rating").text()) || null,
        percentage: parseInt(
          $element.find(".current-rating").attr("style")?.replace("width:", "").replace("%;", "") || "0"
        ),
      },
      type: $element.find(".item_app").hasClass("mod") ? "MOD" : "Original",
    };
    applications.push(app);
  });
  
  return applications;
}

// Play Store Search
async function searchPlayStore(search) {
  const { data } = await axios.get(
    `https://play.google.com/store/search?q=${search}&c=apps`,
    {
      timeout: 30000,
      headers: { "User-Agent": "Mozilla/5.0" }
    }
  );
  
  const hasil = [];
  const $ = cheerio.load(data);
  
  $(".ULeU3b > .VfPpkd-WsjYwc.VfPpkd-WsjYwc-OWXEXe-INsAgc.KC1dQ.Usd1Ac.AaN0Dd.Y8RQXd > .VfPpkd-aGsRMb > .VfPpkd-EScbFb-JIbuQc.TAQqTe > a").each((i, u) => {
    const linkk = $(u).attr("href");
    const nama = $(u).find(".j2FCNc > .cXFu1 > .ubGTjb > .DdYX5").text();
    const developer = $(u).find(".j2FCNc > .cXFu1 > .ubGTjb > .wMUdtb").text();
    let img = $(u).find(".j2FCNc > img").attr("src");

    if (img && img.includes("=s64")) {
      img = img.replace("=s64", "=w480-h960-rw");
    }

    const rate = $(u).find(".j2FCNc > .cXFu1 > .ubGTjb > div").attr("aria-label");
    const rate2 = $(u).find(".j2FCNc > .cXFu1 > .ubGTjb > div > span.w2kbF").text();
    const link = `https://play.google.com${linkk}`;

    hasil.push({
      link: link,
      name: nama || "No name",
      developer: developer || "No Developer",
      image: img || "https://i.ibb.co/G7CrCwN/404.png",
      rating: rate || "No Rate",
      rating_count: rate2 || "No Rate",
      developer_link: `https://play.google.com/store/apps/developer?id=${developer.split(" ").join("+")}`,
    });
  });
  
  if (hasil.every((x) => x === undefined)) {
    throw new Error("No result found!");
  }
  
  return hasil;
}

// OpenAPK Search
async function searchOpenAPK(query) {
  const searchUrl = `https://www.openapk.net/search/?q=${encodeURIComponent(query)}`;

  const response = await axios.get(searchUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: 30000,
  });

  const $ = cheerio.load(response.data);
  const results = [];

  $("#search_results .content-list .list-item").each((index, element) => {
    const $item = $(element);
    const href = 'https://www.openapk.net' + $item.attr("href");
    const title = $item.attr("title");
    const iconSrc = 'https://www.openapk.net' + $item.find("img").attr("src");
    const name = $item.find(".name").text().trim();
    const descriptions = $item.find(".desc").map((i, el) => $(el).text().trim()).get();
    const description = descriptions.find(desc => !desc.startsWith("★")) || "";
    const rating = descriptions.find(desc => desc.startsWith("★")) || "";

    results.push({
      href,
      title,
      icon: iconSrc,
      name,
      description,
      rating,
    });
  });

  return results;
}

// Routes
router.get("/api/apk/an1", asyncHandler(async (req, res) => {
  const { search } = req.query;
  
  if (!validate.notEmpty(search)) {
    return res.status(200).json({
      success: false,
      error: "Search parameter is required"
    });
  }
  
  if (search.length > 255) {
    return res.status(200).json({
      success: false,
      error: "Search must be less than 255 characters"
    });
  }
  
  const data = await searchAN1(search.trim());
  res.json({ success: true, source: "AN1.com", count: data.length, data });
}));

router.post("/api/apk/an1", asyncHandler(async (req, res) => {
  const { search } = req.body;
  
  if (!validate.notEmpty(search)) {
    return res.status(200).json({
      success: false,
      error: "Search parameter is required"
    });
  }
  
  if (search.length > 255) {
    return res.status(200).json({
      success: false,
      error: "Search must be less than 255 characters"
    });
  }
  
  const data = await searchAN1(search.trim());
  res.json({ success: true, source: "AN1.com", count: data.length, data });
}));

router.get("/api/apk/playstore", asyncHandler(async (req, res) => {
  const { query } = req.query;
  
  if (!validate.notEmpty(query)) {
    return res.status(200).json({
      success: false,
      error: "Query parameter is required"
    });
  }
  
  if (query.length > 255) {
    return res.status(200).json({
      success: false,
      error: "Query must be less than 255 characters"
    });
  }
  
  const data = await searchPlayStore(query.trim());
  res.json({ success: true, source: "Google Play Store", count: data.length, data });
}));

router.post("/api/apk/playstore", asyncHandler(async (req, res) => {
  const { query } = req.body;
  
  if (!validate.notEmpty(query)) {
    return res.status(200).json({
      success: false,
      error: "Query parameter is required"
    });
  }
  
  if (query.length > 255) {
    return res.status(200).json({
      success: false,
      error: "Query must be less than 255 characters"
    });
  }
  
  const data = await searchPlayStore(query.trim());
  res.json({ success: true, source: "Google Play Store", count: data.length, data });
}));

router.get("/api/apk/openapk", asyncHandler(async (req, res) => {
  const { query } = req.query;
  
  if (!validate.notEmpty(query)) {
    return res.status(200).json({
      success: false,
      error: "Query parameter is required"
    });
  }
  
  if (query.length > 255) {
    return res.status(200).json({
      success: false,
      error: "Query must be less than 255 characters"
    });
  }
  
  const data = await searchOpenAPK(query.trim());
  res.json({ success: true, source: "OpenAPK.net", count: data.length, data });
}));

router.post("/api/apk/openapk", asyncHandler(async (req, res) => {
  const { query } = req.body;
  
  if (!validate.notEmpty(query)) {
    return res.status(200).json({
      success: false,
      error: "Query parameter is required"
    });
  }
  
  if (query.length > 255) {
    return res.status(200).json({
      success: false,
      error: "Query must be less than 255 characters"
    });
  }
  
  const data = await searchOpenAPK(query.trim());
  res.json({ success: true, source: "OpenAPK.net", count: data.length, data });
}));

export const metadata = [
  {
    name: "AN1 APK Search",
    path: "/api/apk/an1",
    method: "GET, POST",
    description: "Search for Android apps and MODs on AN1.com with ratings and developer info",
    category: "search",
    status: "free",
    params: [
      {
        name: "search",
        type: "text",
        required: true,
        placeholder: "pou",
        description: "App name to search (POST: use 'search' in body)"
      }
    ]
  },
  {
    name: "Play Store Search",
    path: "/api/apk/playstore",
    method: "GET, POST",
    description: "Search Google Play Store for apps with detailed info and ratings",
    category: "search",
    status: "free",
    params: [
      {
        name: "query",
        type: "text",
        required: true,
        placeholder: "free fire",
        description: "App name to search"
      }
    ]
  },
  {
    name: "OpenAPK Search",
    path: "/api/apk/openapk",
    method: "GET, POST",
    description: "Search OpenAPK.net for Android applications with ratings",
    category: "search",
    status: "free",
    params: [
      {
        name: "query",
        type: "text",
        required: true,
        placeholder: "minecraft",
        description: "App name to search"
      }
    ]
  }
];

export default router;