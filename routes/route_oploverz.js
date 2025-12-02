import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();
const baseUrl = "https://oploverz.org";

// Search
async function searchOploverz(query) {
  const searchUrl = `${baseUrl}/?q=${encodeURIComponent(query)}`;
  const { data } = await axios.get(searchUrl, {
    timeout: 30000,
    headers: { "user-agent": "Mozilla/5.0" }
  });
  
  const $ = cheerio.load(data);
  return $(".bg-white.shadow.xrelated.relative").map((_, el) => ({
    title: $(el).find(".titlelist.tublok").text().trim(),
    link: $(el).find("a").attr("href"),
    image: $(el).find("img").attr("src"),
    episodes: $(el).find(".eplist").text().trim(),
    rating: $(el).find(".starlist").text().trim() || "N/A",
  })).get();
}

// Ongoing
async function getOngoing() {
  const { data } = await axios.get(`${baseUrl}/ongoing/`, {
    timeout: 30000,
    headers: { "user-agent": "Mozilla/5.0" }
  });
  
  const $ = cheerio.load(data);
  return $(".bg-white.shadow.xrelated.relative").map((_, el) => ({
    title: $(el).find(".titlelist.tublok").text().trim(),
    url: $(el).find("a").attr("href"),
    imgSrc: $(el).find("img").attr("src"),
    episodes: $(el).find(".eplist").text().trim(),
    rating: $(el).find(".starlist").text().trim() || "N/A",
  })).get();
}

// Episode List
async function getEpisodes(animeUrl) {
  const { data } = await axios.get(animeUrl + "/", {
    timeout: 30000,
    headers: { "user-agent": "Mozilla/5.0" }
  });
  
  const $ = cheerio.load(data);
  return {
    cover: $(".main-col .cover").attr("src"),
    title: $(".main-col .cover").attr("alt"),
    synopsis: $(".sinops").text().trim(),
    information: (() => {
      const info = {};
      $(".infopost li").each((i, el) => {
        const key = $(el).find("b").text().replace(":", "").trim();
        const value = $(el).text().replace(`${key}:`, "").trim();
        info[key] = value;
      });
      return info;
    })(),
    episodeList: $(".othereps").map((i, el) => ({
      episode: $(el).text().trim(),
      link: $(el).attr("href"),
    })).get(),
  };
}

// Download Links
async function getDownload(episodeUrl) {
  const { data } = await axios.get(episodeUrl + "/", {
    timeout: 30000,
    headers: { "user-agent": "Mozilla/5.0" }
  });
  
  const $ = cheerio.load(data);
  const downloadLinks = $("#contdl .links_table tbody tr").map((_, row) => {
    const server = $(row).find("td").eq(0).text().trim().toLowerCase();
    const quality = $(row).find("td").eq(1).text().trim().toLowerCase().split(" ")[0];
    const link = baseUrl + ($(row).find("td").eq(2).find("a").attr("href") || "");
    return { server, quality, link };
  }).get();

  const formattedLinks = downloadLinks.reduce((acc, { server, quality, link }) => {
    acc[server] = { ...acc[server], [quality]: link };
    return acc;
  }, {});

  return {
    title: $("h1.title-post").text().trim(),
    date: $(".date").text().trim(),
    iframeSrc: $("#istream").attr("src"),
    downloadLinks: formattedLinks,
  };
}

// Routes
router.get("/api/oploverz/search", asyncHandler(async (req, res) => {
  const { query } = req.query;
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ success: false, error: "Query is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const results = await searchOploverz(query.trim());
  res.json({ success: true, count: results.length, data: results });
}));

router.post("/api/oploverz/search", asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ success: false, error: "Query is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const results = await searchOploverz(query.trim());
  res.json({ success: true, count: results.length, data: results });
}));

router.get("/api/oploverz/ongoing", asyncHandler(async (req, res) => {
  const results = await getOngoing();
  res.json({ success: true, count: results.length, data: results });
}));

router.get("/api/oploverz/episode", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.url(url, "oploverz.org")) {
    return res.status(200).json({ success: false, error: "Valid Oploverz URL is required", errorType: "ValidationError", hint: "Please provide a valid Oploverz series URL" });
  }
  const result = await getEpisodes(url.trim());
  res.json({ success: true, data: result });
}));

router.post("/api/oploverz/episode", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.url(url, "oploverz.org")) {
    return res.status(200).json({ success: false, error: "Valid Oploverz URL is required", errorType: "ValidationError", hint: "Please provide a valid Oploverz series URL" });
  }
  const result = await getEpisodes(url.trim());
  res.json({ success: true, data: result });
}));

router.get("/api/oploverz/download", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.url(url, "oploverz.org")) {
    return res.status(200).json({ success: false, error: "Valid Oploverz URL is required", errorType: "ValidationError", hint: "Please provide a valid Oploverz episode URL" });
  }
  const result = await getDownload(url.trim());
  res.json({ success: true, data: result });
}));

router.post("/api/oploverz/download", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.url(url, "oploverz.org")) {
    return res.status(200).json({ success: false, error: "Valid Oploverz URL is required", errorType: "ValidationError", hint: "Please provide a valid Oploverz episode URL" });
  }
  const result = await getDownload(url.trim());
  res.json({ success: true, data: result });
}));

export const metadata = [
  {
    name: "Oploverz Search",
    path: "/api/oploverz/search",
    method: "GET, POST",
    description: "Search anime on Oploverz with ratings and episode count",
    category: "entertainment",
    status: "free",
    params: [{ name: "query", type: "text", required: true, placeholder: "romance", description: "Anime search query" }]
  },
  {
    name: "Oploverz Ongoing",
    path: "/api/oploverz/ongoing",
    method: "GET",
    description: "Get list of currently airing anime on Oploverz",
    category: "entertainment",
    status: "free",
    params: []
  },
  {
    name: "Oploverz Episodes",
    path: "/api/oploverz/episode",
    method: "GET, POST",
    description: "Get anime details and complete episode list",
    category: "entertainment",
    status: "free",
    params: [{ name: "url", type: "text", required: true, placeholder: "https://oploverz.org/mushoku-tensei-s2/", description: "Anime series URL" }]
  },
  {
    name: "Oploverz Download",
    path: "/api/oploverz/download",
    method: "GET, POST",
    description: "Get download links for anime episode (multiple servers & qualities)",
    category: "entertainment",
    status: "free",
    params: [{ name: "url", type: "text", required: true, placeholder: "https://oploverz.org/anime/captain-tsubasa-episode-30/", description: "Episode URL" }]
  }
];

export default router;