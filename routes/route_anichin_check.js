import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

// === ANICHIN ===
async function getAnichinRedirect() {
  const { data } = await axios.get("https://anichin.team/", { timeout: 30000 });
  const $ = cheerio.load(data);
  const script = $("script").filter((_, el) => $(el).html()?.includes("setTimeout")).html();
  const match = script.match(/location\.href = '(https:\/\/[^']+)'/);
  if (!match) throw new Error("Redirect URL not found");
  return match[1];
}

async function searchAnichin(query) {
  const url = `https://anichin.cafe/?s=${encodeURIComponent(query)}`;
  const { data } = await axios.get(url, {
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);
  return $(".listupd article").map((_, el) => ({
    title: $(el).find(".tt h2").text().trim(),
    type: $(el).find(".typez").text().trim(),
    status: $(el).find(".bt .epx").text().trim(),
    link: $(el).find("a").attr("href"),
    image: $(el).find("img").attr("src"),
  })).get();
}

async function getAnichinLatest() {
  const redirectUrl = await getAnichinRedirect();
  const { data } = await axios.get(redirectUrl, {
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);
  return $(".listupd.normal .bs").map((_, el) => ({
    title: $(el).find("a").attr("title"),
    url: $(el).find("a").attr("href"),
    episode: $(el).find(".bt .epx").text().trim(),
    thumbnail: $(el).find("img").attr("src"),
    type: $(el).find(".typez").text().trim(),
  })).get();
}

async function getAnichinDetail(url) {
  const { data } = await axios.get(url, {
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);
  return {
    title: $(".entry-title").text().trim(),
    thumbnail: $(".thumb img").attr("src"),
    rating: $(".rating strong").text().replace("Rating ", "").trim(),
    followers: $(".bmc").text().replace("Followed ", "").replace(" people", "").trim(),
    synopsis: $(".synp .entry-content").text().trim(),
    alternativeTitles: $(".alter").text().trim(),
    status: $('.info-content .spe span:contains("Status")').text().replace("Status:", "").trim(),
    network: $('.info-content .spe span:contains("Network") a').text().trim(),
    studio: $('.info-content .spe span:contains("Studio") a').text().trim(),
    released: $('.info-content .spe span:contains("Released")').text().replace("Released:", "").trim(),
    duration: $('.info-content .spe span:contains("Duration")').text().replace("Duration:", "").trim(),
    season: $('.info-content .spe span:contains("Season") a').text().trim(),
    country: $('.info-content .spe span:contains("Country") a').text().trim(),
    type: $('.info-content .spe span:contains("Type")').text().replace("Type:", "").trim(),
    episodes: $('.info-content .spe span:contains("Episodes")').text().replace("Episodes:", "").trim(),
    genres: $(".genxed a").map((_, el) => $(el).text().trim()).get(),
  };
}

async function getAnichinDownload(url) {
  const { data } = await axios.get(url, {
    timeout: 30000,
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const $ = cheerio.load(data);
  return $(".mctnx .soraddlx").map((_, el) => {
    const resolution = $(el).find(".soraurlx strong").first().text().trim();
    const links = $(el).find(".soraurlx a").map((_, link) => ({
      host: $(link).text().trim(),
      link: $(link).attr("href"),
    })).get();
    return { resolution, links };
  }).get();
}

// === CHECK UTILITIES ===
async function checkTagihanPLN(nopel) {
  const { data } = await axios.get(`https://listrik.okcek.com/dd.php?nopel=${nopel}`, {
    headers: {
      "referer": `https://listrik.okcek.com/hasil.php?nopel=${nopel}`,
      "x-requested-with": "XMLHttpRequest",
    },
    timeout: 10000
  });
  
  if (data?.data?.status !== "success") throw new Error("Data tidak ditemukan");
  
  return {
    jenis_tagihan: data.data[0][2],
    no_pelanggan: data.data[1][2],
    nama_pelanggan: data.data[2][2],
    tarif_daya: data.data[3][2],
    bulan_tahun: data.data[4][2],
    stand_meter: data.data[5][2],
    total_tagihan: data.data[6][2],
  };
}

async function checkResi(resi, courier) {
  // Get courier list
  const { data: courierData } = await axios.get("https://loman.id/resapp/getdropdown.php", {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    timeout: 5000
  });
  
  if (courierData?.status !== "berhasil") throw new Error("Failed to get courier list");
  
  const normalize = (text) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const ni = normalize(courier);
  const mc = courierData.data.find(c => {
    const nc = normalize(c.title);
    return nc.includes(ni) || ni.includes(nc);
  });
  
  if (!mc) throw new Error(`Courier "${courier}" not found`);
  
  // Track package
  const { data: trackData } = await axios.post("https://loman.id/resapp/", 
    `resi=${resi}&ex=${mc.title}`,
    {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      timeout: 10000
    }
  );
  
  if (trackData?.status !== "berhasil") throw new Error("Failed to track package");
  
  const history = Array.isArray(trackData.history) ? trackData.history.map(item => ({
    datetime: item.tanggal,
    description: item.details,
    timestamp: new Date(item.tanggal.replace("Pukul", "")).getTime() || null,
  })) : [];
  
  return {
    courier: mc.title,
    resi,
    status: trackData.details?.status || "Unknown",
    message: trackData.details?.infopengiriman || "",
    tips: trackData.details?.ucapan || "",
    history: history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)),
  };
}

async function checkNPM(packageName) {
  const { data } = await axios.get(`https://registry.npmjs.org/${packageName}`, { timeout: 10000 });
  const versions = data.versions;
  const allver = Object.keys(versions);
  const verLatest = allver[allver.length - 1];
  const verPublish = allver[0];
  const packageLatest = versions[verLatest];
  
  return {
    name: packageName,
    versionLatest: verLatest,
    versionPublish: verPublish,
    versionUpdate: allver.length,
    latestDependencies: Object.keys(packageLatest.dependencies || {}).length,
    publishDependencies: Object.keys(versions[verPublish].dependencies || {}).length,
    publishTime: data.time.created,
    latestPublishTime: data.time[verLatest],
  };
}

// ROUTES - ANICHIN
router.get("/api/anichin/search", asyncHandler(async (req, res) => {
  const { query } = req.query;
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ success: false, error: "Query is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await searchAnichin(query.trim());
  res.json({ success: true, count: data.length, data });
}));

router.post("/api/anichin/search", asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ success: false, error: "Query is required", errorType: "ValidationError", hint: "Please provide a search query" });
  }
  const data = await searchAnichin(query.trim());
  res.json({ success: true, count: data.length, data });
}));

router.get("/api/anichin/latest", asyncHandler(async (req, res) => {
  const data = await getAnichinLatest();
  res.json({ success: true, count: data.length, data });
}));

router.get("/api/anichin/detail", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.url(url)) {
    return res.status(200).json({ success: false, error: "Valid URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await getAnichinDetail(url.trim());
  res.json({ success: true, data });
}));

router.post("/api/anichin/detail", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.url(url)) {
    return res.status(200).json({ success: false, error: "Valid URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await getAnichinDetail(url.trim());
  res.json({ success: true, data });
}));

router.get("/api/anichin/download", asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!validate.url(url)) {
    return res.status(200).json({ success: false, error: "Valid URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await getAnichinDownload(url.trim());
  res.json({ success: true, count: data.length, data });
}));

router.post("/api/anichin/download", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!validate.url(url)) {
    return res.status(200).json({ success: false, error: "Valid URL is required", errorType: "ValidationError", hint: "Please provide a valid URL" });
  }
  const data = await getAnichinDownload(url.trim());
  res.json({ success: true, count: data.length, data });
}));

// ROUTES - CHECK
router.get("/api/check/pln", asyncHandler(async (req, res) => {
  const { nopel } = req.query;
  if (!validate.notEmpty(nopel)) {
    return res.status(200).json({ success: false, error: "Nopel is required", errorType: "ValidationError", hint: "Please provide episode number" });
  }
  const data = await checkTagihanPLN(nopel.trim());
  res.json({ success: true, data });
}));

router.post("/api/check/pln", asyncHandler(async (req, res) => {
  const { nopel } = req.body;
  if (!validate.notEmpty(nopel)) {
    return res.status(200).json({ success: false, error: "Nopel is required", errorType: "ValidationError", hint: "Please provide episode number" });
  }
  const data = await checkTagihanPLN(nopel.trim());
  res.json({ success: true, data });
}));

router.get("/api/check/resi", asyncHandler(async (req, res) => {
  const { resi, courier } = req.query;
  if (!validate.notEmpty(resi) || !validate.notEmpty(courier)) {
    return res.status(200).json({ success: false, error: "Resi and courier are required", errorType: "ValidationError", hint: "Please provide tracking number and courier name" });
  }
  const data = await checkResi(resi.trim(), courier.trim());
  res.json({ success: true, data });
}));

router.post("/api/check/resi", asyncHandler(async (req, res) => {
  const { resi, courier } = req.body;
  if (!validate.notEmpty(resi) || !validate.notEmpty(courier)) {
    return res.status(200).json({ success: false, error: "Resi and courier are required", errorType: "ValidationError", hint: "Please provide tracking number and courier name" });
  }
  const data = await checkResi(resi.trim(), courier.trim());
  res.json({ success: true, data });
}));

router.get("/api/check/npm", asyncHandler(async (req, res) => {
  const { packageName } = req.query;
  if (!validate.notEmpty(packageName)) {
    return res.status(200).json({ success: false, error: "Package name is required", errorType: "ValidationError", hint: "Please provide package name" });
  }
  const data = await checkNPM(packageName.trim());
  res.json({ success: true, data });
}));

router.post("/api/check/npm", asyncHandler(async (req, res) => {
  const { packageName } = req.body;
  if (!validate.notEmpty(packageName)) {
    return res.status(200).json({ success: false, error: "Package name is required", errorType: "ValidationError", hint: "Please provide package name" });
  }
  const data = await checkNPM(packageName.trim());
  res.json({ success: true, data });
}));

export const metadata = [
  {
    name: "Anichin Search",
    path: "/api/anichin/search",
    method: "GET, POST",
    description: "Search anime on Anichin with type and status info",
    category: "entertainment",
    status: "free",
    params: [{ name: "query", type: "text", required: true, placeholder: "naga", description: "Anime search query" }]
  },
  {
    name: "Anichin Latest",
    path: "/api/anichin/latest",
    method: "GET",
    description: "Get latest anime updates from Anichin",
    category: "entertainment",
    status: "free",
    params: []
  },
  {
    name: "Anichin Detail",
    path: "/api/anichin/detail",
    method: "GET, POST",
    description: "Get detailed anime info including synopsis, rating, and genres",
    category: "entertainment",
    status: "free",
    params: [{ name: "url", type: "text", required: true, placeholder: "https://anichin.forum/renegade-immortal/", description: "Anime page URL" }]
  },
  {
    name: "Anichin Download",
    path: "/api/anichin/download",
    method: "GET, POST",
    description: "Get download links for anime episode (multiple resolutions & hosts)",
    category: "entertainment",
    status: "free",
    params: [{ name: "url", type: "text", required: true, placeholder: "https://anichin.forum/renegade-immortal-episode-69/", description: "Episode URL" }]
  },
  {
    name: "Check PLN Bill",
    path: "/api/check/pln",
    method: "GET, POST",
    description: "Check PLN electricity bill using customer number (Indonesia only)",
    category: "tools",
    status: "free",
    params: [{ name: "nopel", type: "text", required: true, placeholder: "443100003506", description: "PLN customer number" }]
  },
  {
    name: "Check Resi",
    path: "/api/check/resi",
    method: "GET, POST",
    description: "Track package shipment using tracking number and courier name",
    category: "tools",
    status: "free",
    params: [
      { name: "resi", type: "text", required: true, placeholder: "1234567890", description: "Tracking number" },
      { name: "courier", type: "text", required: true, placeholder: "JNE", description: "Courier name (JNE, J&T, SiCepat, etc)" }
    ]
  },
  {
    name: "Check NPM Package",
    path: "/api/check/npm",
    method: "GET, POST",
    description: "Get detailed NPM package info including versions and dependencies",
    category: "tools",
    status: "free",
    params: [{ name: "packageName", type: "text", required: true, placeholder: "axios", description: "NPM package name" }]
  }
];

export default router;