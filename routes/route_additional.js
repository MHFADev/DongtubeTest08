import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import needle from "needle";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

// ========== DOWNLOADER ==========

// GOOGLE DRIVE
async function downloadGDrive(url) {
  if (!/drive\.google\.com\/file\/d\//gi.test(url)) {
    throw new Error("Invalid Google Drive URL");
  }
  const { data } = await axios.get(url, {
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);
  const id = url.split("/")[5];
  return {
    name: $("head").find("title").text().split("-")[0].trim(),
    download: `https://drive.usercontent.google.com/uc?id=${id}&export=download`,
    link: url,
  };
}

// LAHELU DOWNLOADER
async function downloadLahelu(url) {
  const postID = url.replace("https://lahelu.com/post/", "");
  const { data } = await axios.get("https://lahelu.com/api/post/get", {
    params: { postID },
    headers: { "user-agent": "Mozilla/5.0" },
    timeout: 30000
  });
  
  if (data && data.postInfo) {
    const { postID: extractedPostID, userID, title, media, sensitive, hashtags, createTime } = data.postInfo;
    return {
      user_id: userID,
      post_id: extractedPostID,
      title,
      media,
      sensitive,
      hashtags,
      create_time: new Date(createTime * 1000).toISOString(),
    };
  }
  return null;
}

// SPOTIFY DOWNLOADER
async function downloadSpotify(url) {
  const initialResponse = await axios.get(
    `https://api.fabdl.com/spotify/get?url=${encodeURIComponent(url)}`,
    {
      headers: {
        Referer: "https://spotifydownload.org/",
        "User-Agent": "Mozilla/5.0"
      },
      timeout: 30000
    }
  );

  const { result } = initialResponse.data;
  const trackId = result.type === "album" ? result.tracks[0].id : result.id;

  const convertResponse = await axios.get(
    `https://api.fabdl.com/spotify/mp3-convert-task/${result.gid}/${trackId}`,
    {
      headers: {
        Referer: "https://spotifydownload.org/",
        "User-Agent": "Mozilla/5.0"
      },
      timeout: 30000
    }
  );

  const tid = convertResponse.data.result.tid;
  const progressResponse = await axios.get(
    `https://api.fabdl.com/spotify/mp3-convert-progress/${tid}`,
    {
      headers: {
        Referer: "https://spotifydownload.org/",
        "User-Agent": "Mozilla/5.0"
      },
      timeout: 30000
    }
  );

  return {
    title: result.name,
    type: result.type,
    artists: result.artists,
    duration: result.type === "album" ? result.tracks[0].duration_ms : result.duration_ms,
    image: result.image,
    download: `https://api.fabdl.com${progressResponse.data.result.download_url}`,
    status: progressResponse.data.result.status,
  };
}

// ========== INFO ==========

// CUACA (Weather)
class WilayahService {
  constructor() {
    this.baseUrl = "https://raw.githubusercontent.com/kodewilayah/permendagri-72-2019/main/dist/base.csv";
    this.bmkgUrl = "https://api.bmkg.go.id/publik/prakiraan-cuaca";
  }

  determineBMKGUrl(code) {
    const dots = (code.match(/\./g) || []).length;
    const admLevel = dots + 1;
    return `${this.bmkgUrl}?adm${admLevel}=${code}`;
  }

  calculateSimilarity(searchQuery, targetText) {
    const query = searchQuery.toLowerCase();
    const target = targetText.toLowerCase();
    const queryWords = query.split(" ").filter((w) => w.length > 0);
    const targetWords = target.split(" ").filter((w) => w.length > 0);

    let wordMatchScore = 0;
    let exactMatchBonus = 0;

    for (const queryWord of queryWords) {
      let bestWordScore = 0;
      for (const targetWord of targetWords) {
        if (queryWord === targetWord) {
          bestWordScore = 1;
          exactMatchBonus += 0.2;
          break;
        }
        if (targetWord.includes(queryWord) || queryWord.includes(targetWord)) {
          const matchLength = Math.min(queryWord.length, targetWord.length);
          const maxLength = Math.max(queryWord.length, targetWord.length);
          const partialScore = matchLength / maxLength;
          bestWordScore = Math.max(bestWordScore, partialScore);
        }
      }
      wordMatchScore += bestWordScore;
    }

    const normalizedWordScore = wordMatchScore / queryWords.length;
    return normalizedWordScore + exactMatchBonus;
  }

  async searchWilayah(query) {
    const response = await axios.get(this.baseUrl);
    const rows = response.data.split("\n");
    const results = [];

    for (const row of rows) {
      if (!row.trim()) continue;
      const [kode, nama] = row.split(",");
      if (!nama) continue;

      const similarity = this.calculateSimilarity(query, nama);
      const threshold = query.length <= 4 ? 0.4 : 0.3;

      if (similarity > threshold) {
        results.push({
          kode,
          nama,
          score: similarity,
          bmkgUrl: this.determineBMKGUrl(kode),
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10);
  }

  async getWeatherData(wilayahCode) {
    const url = this.determineBMKGUrl(wilayahCode);
    const response = await axios.get(url, { timeout: 30000 });
    return response.data.data;
  }

  async scrape(query) {
    const wilayahResults = await this.searchWilayah(query);
    if (wilayahResults.length > 0) {
      const topResult = wilayahResults[0];
      const weatherData = await this.getWeatherData(topResult.kode);
      return { wilayah: topResult, weather: weatherData };
    }
    return null;
  }
}

// GEMPA (Earthquake)
async function getGempa() {
  const urls = {
    auto: "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json",
    terkini: "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json",
    dirasakan: "https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json",
  };

  const BASE_SHAKEMAP_URL = "https://data.bmkg.go.id/DataMKG/TEWS/";

  const responses = await Promise.all(
    Object.values(urls).map(url => axios.get(url, { timeout: 30000 }).then(r => r.data))
  );

  const addShakemapUrls = (data) => {
    if (!data || !data.Infogempa) return data;
    
    const addShakemap = (gempa) => {
      if (!gempa || !gempa.Shakemap) return gempa;
      return { ...gempa, downloadShakemap: `${BASE_SHAKEMAP_URL}${gempa.Shakemap}` };
    };

    if (data.Infogempa.gempa) {
      if (Array.isArray(data.Infogempa.gempa)) {
        return {
          ...data,
          Infogempa: {
            ...data.Infogempa,
            gempa: data.Infogempa.gempa.map(addShakemap)
          }
        };
      } else {
        return {
          ...data,
          Infogempa: {
            ...data.Infogempa,
            gempa: addShakemap(data.Infogempa.gempa)
          }
        };
      }
    }
    return data;
  };

  return {
    auto: addShakemapUrls(responses[0]),
    terkini: addShakemapUrls(responses[1]),
    dirasakan: addShakemapUrls(responses[2]),
  };
}

// JADWAL TV
async function getJadwalTV(channel) {
  const baseUrl = "https://www.jadwaltv.net";
  const url = channel 
    ? `${baseUrl}/channel/${channel}`.toLowerCase()
    : `${baseUrl}/channel/acara-tv-nasional-saat-ini`;

  const { data } = await axios.get(url, {
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);

  if (!channel) {
    const jadwal = [];
    let currentChannel = "";

    $("table.table-bordered tbody tr").each((_, element) => {
      const isChannelRow = $(element).find("td[colspan=2]").length > 0;
      if (isChannelRow) {
        currentChannel = $(element).find("a").text().trim();
      } else {
        const jam = $(element).find("td").first().text().trim();
        const acara = $(element).find("td").last().text().trim();
        if (jam && acara && currentChannel) {
          const existing = jadwal.find(j => j.channel === currentChannel);
          if (existing) {
            existing.jadwal.push({ jam, acara });
          } else {
            jadwal.push({ channel: currentChannel, jadwal: [{ jam, acara }] });
          }
        }
      }
    });
    return jadwal;
  } else {
    const jadwal = [];
    $("table.table-bordered tbody tr").each((_, element) => {
      const jam = $(element).find("td").first().text().trim();
      const acara = $(element).find("td").last().text().trim();
      if (jam && acara && jam !== "Jam" && acara !== "Acara") {
        jadwal.push({ jam, acara });
      }
    });
    return jadwal;
  }
}

// ========== SEARCH ==========

// LAHELU SEARCH
async function searchLahelu(query) {
  const encodedQuery = encodeURIComponent(query);
  const options = {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://lahelu.com",
      "Accept": "application/json, text/plain, */*",
    },
    timeout: 30000,
  };

  const response = await needle(
    "get",
    `https://lahelu.com/api/post/get-search?query=${encodedQuery}`,
    options,
  );

  if (response.statusCode === 200 && response.body && response.body.postInfos) {
    return response.body.postInfos.map(postInfo => ({
      ...postInfo,
      postID: `https://lahelu.com/post/${postInfo.postID}`,
      media: postInfo.media,
      mediaThumbnail: postInfo.mediaThumbnail ? `https://cache.lahelu.com/${postInfo.mediaThumbnail}` : null,
      userUsername: `https://lahelu.com/user/${postInfo.userUsername}`,
      userAvatar: `https://cache.lahelu.com/${postInfo.userAvatar}`,
      createTime: new Date(postInfo.createTime).toISOString(),
    }));
  }
  throw new Error("Failed to search Lahelu");
}

// LAHELU RANDOM
async function randomLahelu() {
  const options = {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://lahelu.com",
      "Accept": "application/json, text/plain, */*",
    },
    timeout: 30000,
  };

  const response = await needle(
    "get",
    "https://lahelu.com/api/post/get-posts?feed=1&page=1",
    options,
  );

  if (response.statusCode === 200 && response.body && response.body.postInfos) {
    const posts = response.body.postInfos;
    const randomPost = posts[Math.floor(Math.random() * posts.length)];
    
    return {
      ...randomPost,
      postID: `https://lahelu.com/post/${randomPost.postID}`,
      media: randomPost.media,
      mediaThumbnail: randomPost.mediaThumbnail ? `https://cache.lahelu.com/${randomPost.mediaThumbnail}` : null,
      userUsername: `https://lahelu.com/user/${randomPost.userUsername}`,
      userAvatar: `https://cache.lahelu.com/${randomPost.userAvatar}`,
      createTime: new Date(randomPost.createTime).toISOString(),
    };
  }
  throw new Error("Failed to get random Lahelu post");
}

// SPOTIFY SEARCH
function convertMs(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return minutes + ":" + (Number(seconds) < 10 ? "0" : "") + seconds;
}

async function spotifyCreds() {
  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from("7bbae52593da45c69a27c853cc22edff:88ae1f7587384f3f83f62a279e7f87af").toString("base64"),
      },
      timeout: 30000,
    }
  );
  return response.data.access_token;
}

async function searchSpotify(query, limit = 20) {
  const token = await spotifyCreds();
  const response = await axios.get("https://api.spotify.com/v1/search", {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      q: query,
      type: "track",
      limit: Math.min(limit, 50),
      market: "US",
    },
    timeout: 30000,
  });

  const tracks = response.data.tracks.items;
  if (!tracks.length) throw new Error("No tracks found");

  return {
    data: tracks.map(item => ({
      track_url: item.external_urls.spotify,
      thumbnail: item.album.images[0]?.url || "No thumbnail available",
      title: `${item.artists[0].name} - ${item.name}`,
      artist: item.artists[0].name,
      duration: convertMs(item.duration_ms),
      preview_url: item.preview_url || "No preview available",
      album: item.album.name,
      release_date: item.album.release_date,
    })),
    total_results: response.data.tracks.total,
  };
}

// ========== ROUTES ==========

// DOWNLOADER
router.get("/api/d/gdrive", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.notEmpty(url)) {
    return res.status(200).json({ success: false, error: "URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await downloadGDrive(url.trim());
  res.json({ success: true, data });
}));

router.post("/api/d/gdrive", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.notEmpty(url)) {
    return res.status(200).json({ success: false, error: "URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await downloadGDrive(url.trim());
  res.json({ success: true, data });
}));

router.get("/api/d/lahelu", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.notEmpty(url)) {
    return res.status(200).json({ success: false, error: "URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await downloadLahelu(url.trim());
  res.json({ success: true, data });
}));

router.post("/api/d/lahelu", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.notEmpty(url)) {
    return res.status(200).json({ success: false, error: "URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await downloadLahelu(url.trim());
  res.json({ success: true, data });
}));

router.get("/api/d/spotify", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.notEmpty(url)) {
    return res.status(200).json({ success: false, error: "URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await downloadSpotify(url.trim());
  res.json({ success: true, data });
}));

router.post("/api/d/spotify", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.notEmpty(url)) {
    return res.status(200).json({ success: false, error: "URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await downloadSpotify(url.trim());
  res.json({ success: true, data });
}));

// INFO
router.get("/api/info/cuaca", asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!validate.notEmpty(q)) {
    return res.status(200).json({ success: false, error: "Query 'q' is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await new WilayahService().scrape(q.trim());
  res.json({ success: true, data });
}));

router.post("/api/info/cuaca", asyncHandler(async (req, res) => {
  const { q } = req.body;
  if (!validate.notEmpty(q)) {
    return res.status(200).json({ success: false, error: "Query 'q' is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await new WilayahService().scrape(q.trim());
  res.json({ success: true, data });
}));

router.get("/api/info/gempa", asyncHandler(async (req, res) => {
  const data = await getGempa();
  res.json({ success: true, data });
}));

router.post("/api/info/gempa", asyncHandler(async (req, res) => {
  const data = await getGempa();
  res.json({ success: true, data });
}));

router.get("/api/info/jadwaltv", asyncHandler(async (req, res) => {
  const { channel } = req.query;
  const data = await getJadwalTV(channel);
  res.json({ success: true, data });
}));

router.post("/api/info/jadwaltv", asyncHandler(async (req, res) => {
  const { channel } = req.body;
  const data = await getJadwalTV(channel);
  res.json({ success: true, data });
}));

// SEARCH
router.get("/api/s/lahelu", asyncHandler(async (req, res) => {
  const { query } = req.query;
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ success: false, error: "Query is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await searchLahelu(query.trim());
  res.json({ success: true, count: data.length, data });
}));

router.post("/api/s/lahelu", asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ success: false, error: "Query is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await searchLahelu(query.trim());
  res.json({ success: true, count: data.length, data });
}));

router.get("/api/s/lahelu/random", asyncHandler(async (req, res) => {
  const data = await randomLahelu();
  res.json({ success: true, data });
}));

router.post("/api/s/lahelu/random", asyncHandler(async (req, res) => {
  const data = await randomLahelu();
  res.json({ success: true, data });
}));

router.get("/api/s/spotify", asyncHandler(async (req, res) => {
  const { query } = req.query;
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ success: false, error: "Query is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await searchSpotify(query.trim());
  res.json({ success: true, ...data });
}));

router.post("/api/s/spotify", asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ success: false, error: "Query is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await searchSpotify(query.trim());
  res.json({ success: true, ...data });
}));

export const metadata = [
  // DOWNLOADER
  {
    name: "Google Drive Downloader",
    path: "/api/d/gdrive",
    method: "GET, POST",
    description: "Get direct download link from Google Drive",
    category: "tools",
    status: "free",
    params: [{ name: "url", type: "text", required: true, placeholder: "https://drive.google.com/file/d/...", description: "Google Drive URL" }]
  },
  {
    name: "Lahelu Downloader",
    path: "/api/d/lahelu",
    method: "GET, POST",
    description: "Download post from Lahelu.com",
    category: "tools",
    status: "free",
    params: [{ name: "url", type: "text", required: true, placeholder: "https://lahelu.com/post/...", description: "Lahelu post URL" }]
  },
  {
    name: "Spotify Downloader",
    path: "/api/d/spotify",
    method: "GET, POST",
    description: "Download music from Spotify",
    category: "tools",
    status: "free",
    params: [{ name: "url", type: "text", required: true, placeholder: "https://open.spotify.com/track/...", description: "Spotify track URL" }]
  },
  // INFO
  {
    name: "Weather Info",
    path: "/api/info/cuaca",
    method: "GET, POST",
    description: "Get weather information by location",
    category: "tools",
    status: "free",
    params: [{ name: "q", type: "text", required: true, placeholder: "Jakarta", description: "Location name" }]
  },
  {
    name: "Earthquake Info",
    path: "/api/info/gempa",
    method: "GET, POST",
    description: "Get latest earthquake information from BMKG",
    category: "tools",
    status: "free",
    params: []
  },
  {
    name: "TV Schedule",
    path: "/api/info/jadwaltv",
    method: "GET, POST",
    description: "Get Indonesian TV schedule",
    category: "tools",
    status: "free",
    params: [{ name: "channel", type: "text", required: false, placeholder: "sctv", description: "TV channel (optional)" }]
  },
  // SEARCH
  {
    name: "Lahelu Search",
    path: "/api/s/lahelu",
    method: "GET, POST",
    description: "Search posts on Lahelu.com",
    category: "tools",
    status: "free",
    params: [{ name: "query", type: "text", required: true, placeholder: "meme", description: "Search query" }]
  },
  {
    name: "Lahelu Random",
    path: "/api/s/lahelu/random",
    method: "GET, POST",
    description: "Get random post from Lahelu.com",
    category: "tools",
    status: "free",
    params: []
  },
  {
    name: "Spotify Search",
    path: "/api/s/spotify",
    method: "GET, POST",
    description: "Search music on Spotify",
    category: "tools",
    status: "free",
    params: [{ name: "query", type: "text", required: true, placeholder: "song name", description: "Search query" }]
  }
];

export default router;