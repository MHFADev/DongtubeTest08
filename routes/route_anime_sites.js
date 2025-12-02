import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import FormData from "form-data";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

// === HELPER: GET SAMEHADAKU BASE URL ===
async function getSamehadakuBase() {
  const { data } = await axios.get("https://samehadaku.care/", { timeout: 30000 });
  const $ = cheerio.load(data);
  const script = $('script').filter((_, el) => $(el).html().includes("window.location.href")).html();
  const match = script.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
  if (!match) throw new Error("Base URL not found");
  return match[1];
}

// === SAMEHADAKU ===
async function searchSamehadaku(query) {
  const baseUrl = await getSamehadakuBase();
  const { data } = await axios.get(`${baseUrl}/?s=${query}`, {
    timeout: 30000,
    headers: { "user-agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);
  return $("main#main article.animpost").map((_, el) => ({
    title: $(el).find("img").attr("title")?.trim(),
    id: $(el).attr("id")?.split("-")[1] || "",
    thumbnail: $(el).find("img").attr("src") || "",
    description: $(el).find("div.ttls").text().trim(),
    genre: $(el).find("div.genres > .mta > a").map((i, e) => $(e).text().trim()).get(),
    type: $(el).find("div.type").map((i, e) => $(e).text().trim()).get(),
    star: $(el).find("div.score").text().trim(),
    views: $(el).find("div.metadata > span").eq(2).text().trim(),
    link: $(el).find("a").attr("href") || "",
  })).get();
}

async function getSamehadakuLatest() {
  const baseUrl = await getSamehadakuBase();
  const url = baseUrl + "/anime-terbaru/";
  const { data } = await axios.get(url, {
    timeout: 30000,
    headers: { "user-agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);
  const ul = $("div.post-show > ul").children("li");
  const animeList = [];
  
  ul.each((i, el) => {
    animeList.push({
      title: $(el).find("h2.entry-title").text().trim().split(" Episode")[0],
      thumbnail: $(el).find("div.thumb > a > img").attr("src") || "",
      postedBy: $(el).find("span[itemprop='author'] > author").text().trim(),
      episode: $(el).find("span").eq(0).find("author").text().trim(),
      release: $(el).find("span[itemprop='author']").next().contents().eq(3).text().split(": ")[1]?.trim(),
      link: $(el).find("a").attr("href") || "",
    });
  });
  
  return { total: animeList.length, anime: animeList };
}

async function getSamehadakuRelease() {
  const baseUrl = await getSamehadakuBase();
  const data = {
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: []
  };
  
  for (const day of Object.keys(data)) {
    try {
      const res = await axios.get(`${baseUrl}/wp-json/custom/v1/all-schedule?perpage=20&day=${day}&type=schtml`, {
        timeout: 30000,
        headers: { "user-agent": "Mozilla/5.0" }
      });
      data[day] = res.data;
    } catch (e) {
      data[day] = [];
    }
  }
  
  return data;
}

async function getSamehadakuDetail(link) {
  const { data } = await axios.get(link, {
    timeout: 30000,
    headers: { "user-agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);
  
  return {
    title: $("h1[itemprop='name']").text().trim(),
    thumbnail: $(".infoanime .thumb > img").attr("src") || "",
    published: $(".infoanime time[itemprop='datePublished']").attr("datetime") || "",
    rating: `${$(".infoanime span[itemprop='ratingValue']").text().trim()}/10`,
    description: $(".infox .desc").text().trim(),
    genres: $(".infox .genre-info > a").map((_, el) => $(el).text().trim()).get(),
    episodes: $(".lstepsiode > ul > li").map((_, el) => ({
      title: $(el).find(".lchx > a").text().trim(),
      date: $(el).find(".date").text().trim(),
      link: $(el).find(".eps > a").attr("href"),
    })).get(),
  };
}

async function getSamehadakuDownload(url) {
  const baseUrl = await getSamehadakuBase();
  if (!/samehadaku\.\w+\/[\w-]+episode/gi.test(url)) {
    throw new Error("Invalid URL!");
  }

  const { data } = await axios.get(url, {
    timeout: 30000,
    headers: { "user-agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);
  
  const result = {
    title: $('h1[itemprop="name"]').text().trim(),
    link: url,
    downloads: []
  };

  const downloadItems = $('div#server > ul > li').toArray();
  result.downloads = await Promise.all(
    downloadItems.map(async (el) => {
      const v = {
        name: $(el).find('span').text().trim(),
        post: $(el).find('div').attr('data-post') || '',
        nume: $(el).find('div').attr('data-nume') || '',
        type: $(el).find('div').attr('data-type') || '',
        link: "",
      };

      const formData = new FormData();
      formData.append("action", "player_ajax");
      formData.append("post", v.post);
      formData.append("nume", v.nume);
      formData.append("type", v.type);

      try {
        const res = await axios.post(`${baseUrl}/wp-admin/admin-ajax.php`, formData, {
          headers: {
            ...formData.getHeaders(),
            "user-agent": "Mozilla/5.0"
          },
          timeout: 30000,
        });
        const iframe = cheerio.load(res.data)("iframe").attr("src");
        v.link = iframe || "";
      } catch (e) {
        v.link = "";
      }

      return v;
    })
  );

  return result;
}

// === OTAKUDESU ===
async function searchOtakudesu(query) {
  const url = `https://otakudesu.cloud/?s=${query}&post_type=anime`;
  const { data } = await axios.get(url, { timeout: 30000 });
  const $ = cheerio.load(data);
  return $(".chivsrc li").map((_, el) => ({
    title: $(el).find("h2 a").text().trim(),
    link: $(el).find("h2 a").attr("href"),
    imageUrl: $(el).find("img").attr("src"),
    genres: $(el).find(".set").first().text().replace("Genres : ", "").trim(),
    status: $(el).find(".set").eq(1).text().replace("Status : ", "").trim(),
    rating: $(el).find(".set").eq(2).text().replace("Rating : ", "").trim() || "N/A",
  })).get();
}

async function getOtakudesuOngoing() {
  const { data } = await axios.get("https://otakudesu.cloud/", { timeout: 30000 });
  const $ = cheerio.load(data);
  return $(".venz ul li").map((_, el) => ({
    episode: $(el).find(".epz").text().trim(),
    type: $(el).find(".epztipe").text().trim(),
    date: $(el).find(".newnime").text().trim(),
    title: $(el).find(".jdlflm").text().trim(),
    link: $(el).find("a").attr("href"),
    image: $(el).find("img").attr("src"),
  })).get();
}

// === AURATAIL ===
async function searchAuratail(query) {
  const url = `https://auratail.vip/?s=${encodeURIComponent(query)}`;
  const { data } = await axios.get(url, {
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);
  return $('#content .listupd article').map((_, el) => ({
    title: $(el).find('.tt h2').text().trim(),
    link: $(el).find('a').attr('href'),
    image: $(el).find('.lazyload').attr('data-src') || $(el).find('noscript img').attr('src'),
    status: $(el).find('.status').text().trim() || $(el).find('.bt .epx').text().trim()
  })).get();
}

async function getAuratailLatest() {
  const { data } = await axios.get('https://auratail.vip/anime/?status=&type=&order=update', {
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);
  return $('.listupd .bsx').map((_, el) => ({
    title: $(el).find('.tt h2').text().trim(),
    episode: $(el).find('.bt .epx').text().trim(),
    link: $(el).find('a').attr('href'),
    image: $(el).find('img').attr('data-src') || $(el).find('img').attr('src')
  })).get();
}

async function getAuratailPopular() {
  const { data } = await axios.get('https://auratail.vip', {
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);
  return $('div.listupd.normal').first().find('article.bs').map((_, el) => ({
    title: $(el).find('div.tt h2').text().trim(),
    link: $(el).find('a').attr('href')?.trim()
  })).get().filter(item => item.title && item.link);
}

async function getAuratailDetail(url) {
  const { data } = await axios.get(url, {
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);
  
  return {
    title: $('.entry-title[itemprop="name"]').text().trim(),
    image: $('.thumb img[itemprop="image"]').attr('data-src') || $('.thumb img[itemprop="image"]').attr('src'),
    status: $('span:contains("Status:")').text().replace('Status:', '').trim(),
    studio: $('span:contains("Studio:")').text().replace('Studio:', '').trim(),
    episodes: $('span:contains("Episodes:")').text().replace('Episodes:', '').trim(),
    duration: $('span:contains("Duration:")').text().replace('Duration:', '').trim(),
    type: $('span:contains("Type:")').text().replace('Type:', '').trim(),
    releaseYear: $('span:contains("Released:")').text().replace('Released:', '').trim(),
    producers: $('span:contains("Producers:")').nextUntil('span').map((_, el) => $(el).text().trim()).get().join(', '),
    genres: $('.genxed a').map((_, el) => $(el).text().trim()).get().join(', '),
    synopsis: $('.entry-content[itemprop="description"] p').map((_, el) => $(el).text().trim()).get().join('\n'),
  };
}

// ========== ROUTES ==========

// SAMEHADAKU
router.get("/api/samehadaku/search", asyncHandler(async (req, res) => {
  const { query } = req.query;
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ success: false, error: "Query is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await searchSamehadaku(query.trim());
  res.json({ success: true, count: data.length, data });
}));

router.post("/api/samehadaku/search", asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ success: false, error: "Query is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await searchSamehadaku(query.trim());
  res.json({ success: true, count: data.length, data });
}));

router.get("/api/samehadaku/latest", asyncHandler(async (req, res) => {
  const data = await getSamehadakuLatest();
  res.json({ success: true, data });
}));

router.post("/api/samehadaku/latest", asyncHandler(async (req, res) => {
  const data = await getSamehadakuLatest();
  res.json({ success: true, data });
}));

router.get("/api/samehadaku/release", asyncHandler(async (req, res) => {
  const data = await getSamehadakuRelease();
  res.json({ success: true, data });
}));

router.post("/api/samehadaku/release", asyncHandler(async (req, res) => {
  const data = await getSamehadakuRelease();
  res.json({ success: true, data });
}));

router.get("/api/samehadaku/detail", asyncHandler(async (req, res) => {
  const { link } = req.query;
  if (!validate.notEmpty(link)) {
    return res.status(200).json({ success: false, error: "Link is required", errorType: "ValidationError", hint: "Please provide a link" });
  }
  const data = await getSamehadakuDetail(link.trim());
  res.json({ success: true, data });
}));

router.post("/api/samehadaku/detail", asyncHandler(async (req, res) => {
  const { link } = req.body;
  if (!validate.notEmpty(link)) {
    return res.status(200).json({ success: false, error: "Link is required", errorType: "ValidationError", hint: "Please provide a link" });
  }
  const data = await getSamehadakuDetail(link.trim());
  res.json({ success: true, data });
}));

router.get("/api/samehadaku/download", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.notEmpty(url)) {
    return res.status(200).json({ success: false, error: "URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await getSamehadakuDownload(url.trim());
  res.json({ success: true, data });
}));

router.post("/api/samehadaku/download", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.notEmpty(url)) {
    return res.status(200).json({ success: false, error: "URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await getSamehadakuDownload(url.trim());
  res.json({ success: true, data });
}));

// OTAKUDESU
router.get("/api/otakudesu/search", asyncHandler(async (req, res) => {
  const { s } = req.query;
  if (!validate.notEmpty(s)) {
    return res.status(200).json({ success: false, error: "Query 's' is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await searchOtakudesu(s.trim());
  res.json({ success: true, count: data.length, data });
}));

router.post("/api/otakudesu/search", asyncHandler(async (req, res) => {
  const { s } = req.body;
  if (!validate.notEmpty(s)) {
    return res.status(200).json({ success: false, error: "Query 's' is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await searchOtakudesu(s.trim());
  res.json({ success: true, count: data.length, data });
}));

router.get("/api/otakudesu/ongoing", asyncHandler(async (req, res) => {
  const data = await getOtakudesuOngoing();
  res.json({ success: true, count: data.length, data });
}));

// AURATAIL
router.get("/api/auratail/search", asyncHandler(async (req, res) => {
  const { query } = req.query;
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ success: false, error: "Query is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await searchAuratail(query.trim());
  res.json({ success: true, count: data.length, data });
}));

router.post("/api/auratail/search", asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ success: false, error: "Query is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await searchAuratail(query.trim());
  res.json({ success: true, count: data.length, data });
}));

router.get("/api/auratail/latest", asyncHandler(async (req, res) => {
  const data = await getAuratailLatest();
  res.json({ success: true, count: data.length, data });
}));

router.post("/api/auratail/latest", asyncHandler(async (req, res) => {
  const data = await getAuratailLatest();
  res.json({ success: true, count: data.length, data });
}));

router.get("/api/auratail/popular", asyncHandler(async (req, res) => {
  const data = await getAuratailPopular();
  res.json({ success: true, count: data.length, data });
}));

router.post("/api/auratail/popular", asyncHandler(async (req, res) => {
  const data = await getAuratailPopular();
  res.json({ success: true, count: data.length, data });
}));

router.get("/api/auratail/detail", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.notEmpty(url)) {
    return res.status(200).json({ success: false, error: "URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await getAuratailDetail(url.trim());
  res.json({ success: true, data });
}));

router.post("/api/auratail/detail", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.notEmpty(url)) {
    return res.status(200).json({ success: false, error: "URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await getAuratailDetail(url.trim());
  res.json({ success: true, data });
}));

export const metadata = [
  // SAMEHADAKU
  {
    name: "Samehadaku Search",
    path: "/api/samehadaku/search",
    method: "GET, POST",
    description: "Search anime on Samehadaku with genres, ratings, and views",
    category: "entertainment",
    status: "free",
    params: [{ name: "query", type: "text", required: true, placeholder: "naruto", description: "Anime search query" }]
  },
  {
    name: "Samehadaku Latest",
    path: "/api/samehadaku/latest",
    method: "GET, POST",
    description: "Get latest released anime episodes from Samehadaku",
    category: "entertainment",
    status: "free",
    params: []
  },
  {
    name: "Samehadaku Release Schedule",
    path: "/api/samehadaku/release",
    method: "GET, POST",
    description: "Get anime release schedule by day of the week",
    category: "entertainment",
    status: "free",
    params: []
  },
  {
    name: "Samehadaku Detail",
    path: "/api/samehadaku/detail",
    method: "GET, POST",
    description: "Get detailed information about a specific anime",
    category: "entertainment",
    status: "free",
    params: [{ name: "link", type: "text", required: true, placeholder: "https://samehadaku.email/anime/blue-lock-season-2/", description: "Anime detail URL" }]
  },
  {
    name: "Samehadaku Download",
    path: "/api/samehadaku/download",
    method: "GET, POST",
    description: "Get download links for a specific anime episode",
    category: "entertainment",
    status: "free",
    params: [{ name: "url", type: "text", required: true, placeholder: "https://samehadaku.email/episode-url", description: "Episode URL" }]
  },
  // OTAKUDESU
  {
    name: "Otakudesu Search",
    path: "/api/otakudesu/search",
    method: "GET, POST",
    description: "Search anime on Otakudesu with status and ratings",
    category: "entertainment",
    status: "free",
    params: [{ name: "s", type: "text", required: true, placeholder: "naruto", description: "Anime search query" }]
  },
  {
    name: "Otakudesu Ongoing",
    path: "/api/otakudesu/ongoing",
    method: "GET",
    description: "Get currently airing anime from Otakudesu",
    category: "entertainment",
    status: "free",
    params: []
  },
  // AURATAIL
  {
    name: "Auratail Search",
    path: "/api/auratail/search",
    method: "GET, POST",
    description: "Search anime on Auratail website",
    category: "entertainment",
    status: "free",
    params: [{ name: "query", type: "text", required: true, placeholder: "war", description: "Anime search query" }]
  },
  {
    name: "Auratail Latest",
    path: "/api/auratail/latest",
    method: "GET, POST",
    description: "Get latest updated anime from Auratail",
    category: "entertainment",
    status: "free",
    params: []
  },
  {
    name: "Auratail Popular",
    path: "/api/auratail/popular",
    method: "GET, POST",
    description: "Get popular anime from Auratail",
    category: "entertainment",
    status: "free",
    params: []
  },
  {
    name: "Auratail Detail",
    path: "/api/auratail/detail",
    method: "GET, POST",
    description: "Get detailed information about a specific anime from Auratail",
    category: "entertainment",
    status: "free",
    params: [{ name: "url", type: "text", required: true, placeholder: "https://auratail.vip/the-war-of-cards/", description: "Anime detail URL" }]
  }
];

export default router;