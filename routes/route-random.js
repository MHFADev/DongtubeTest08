import { Router } from "express";
import axios from "axios";
import { asyncHandler } from "../utils/validation.js";

const router = Router();

// Helper function untuk response image
const sendImageResponse = (res, buffer) => {
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Content-Length", buffer.length);
  res.end(buffer);
};

// ========== RANDOM IMAGES ==========

// Random Blue Archive
router.get("/random/ba", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://raw.githubusercontent.com/rynxzyy/blue-archive-r-img/refs/heads/main/links.json", {
    timeout: 10000
  });
  const imgUrl = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(imgUrl, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

// Random Cat
router.get("/random/cat", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://api.sefinek.net/api/v2/random/animal/cat", {
    timeout: 10000
  });
  const imgRes = await axios.get(data.message, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

router.post("/random/cat", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://api.sefinek.net/api/v2/random/animal/cat", {
    timeout: 10000
  });
  const imgRes = await axios.get(data.message, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

// Random Cecan Vietnam
router.get("/random/cecan/vietnam", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://raw.githubusercontent.com/siputzx/Databasee/refs/heads/main/cecan/vietnam.json", {
    timeout: 10000
  });
  const imgUrl = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(imgUrl, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

router.post("/random/cecan/vietnam", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://raw.githubusercontent.com/siputzx/Databasee/refs/heads/main/cecan/vietnam.json", {
    timeout: 10000
  });
  const imgUrl = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(imgUrl, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

// Random Cecan Thailand
router.get("/random/cecan/thailand", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://raw.githubusercontent.com/siputzx/Databasee/refs/heads/main/cecan/thailand.json", {
    timeout: 10000
  });
  const imgUrl = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(imgUrl, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

router.post("/random/cecan/thailand", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://raw.githubusercontent.com/siputzx/Databasee/refs/heads/main/cecan/thailand.json", {
    timeout: 10000
  });
  const imgUrl = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(imgUrl, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

// Random Cecan Korea
router.get("/random/cecan/korea", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://raw.githubusercontent.com/siputzx/Databasee/refs/heads/main/cecan/korea.json", {
    timeout: 10000
  });
  const imgUrl = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(imgUrl, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

router.post("/random/cecan/korea", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://raw.githubusercontent.com/siputzx/Databasee/refs/heads/main/cecan/korea.json", {
    timeout: 10000
  });
  const imgUrl = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(imgUrl, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

// Random Cecan Japan
router.get("/random/cecan/japan", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://raw.githubusercontent.com/siputzx/Databasee/refs/heads/main/cecan/japan.json", {
    timeout: 10000
  });
  const imgUrl = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(imgUrl, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

router.post("/random/cecan/japan", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://raw.githubusercontent.com/siputzx/Databasee/refs/heads/main/cecan/japan.json", {
    timeout: 10000
  });
  const imgUrl = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(imgUrl, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

// Random Cecan Indonesia
router.get("/random/cecan/indonesia", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://raw.githubusercontent.com/siputzx/Databasee/refs/heads/main/cecan/indonesia.json", {
    timeout: 10000
  });
  const imgUrl = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(imgUrl, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

router.post("/random/cecan/indonesia", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://raw.githubusercontent.com/siputzx/Databasee/refs/heads/main/cecan/indonesia.json", {
    timeout: 10000
  });
  const imgUrl = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(imgUrl, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

// Random Cecan China
router.get("/random/cecan/china", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://raw.githubusercontent.com/siputzx/Databasee/refs/heads/main/cecan/china.json", {
    timeout: 10000
  });
  const imgUrl = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(imgUrl, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

router.post("/random/cecan/china", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://raw.githubusercontent.com/siputzx/Databasee/refs/heads/main/cecan/china.json", {
    timeout: 10000
  });
  const imgUrl = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(imgUrl, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

// Random China (Alternative)
router.get("/random/china", asyncHandler(async (req, res) => {
  const { data } = await axios.get("https://github.com/ArifzynXD/database/raw/master/asupan/china.json", {
    timeout: 10000
  });
  const rand = data[Math.floor(Math.random() * data.length)];
  const imgRes = await axios.get(rand.url, { 
    responseType: "arraybuffer",
    timeout: 15000
  });
  sendImageResponse(res, Buffer.from(imgRes.data));
}));

export const metadata = [
  {
    name: "Random Blue Archive",
    path: "/random/ba",
    method: "GET",
    description: "Get random Blue Archive character images",
    category: "entertainment",
    status: "free",
    responseBinary: true,
    params: []
  },
  {
    name: "Random Cat",
    path: "/random/cat",
    method: "GET, POST",
    description: "Get random cat images",
    category: "entertainment",
    status: "free",
    responseBinary: true,
    params: []
  },
  {
    name: "Random Cecan Vietnam",
    path: "/random/cecan/vietnam",
    method: "GET, POST",
    description: "Get random Vietnamese cecan images",
    category: "entertainment",
    status: "free",
    responseBinary: true,
    params: []
  },
  {
    name: "Random Cecan Thailand",
    path: "/random/cecan/thailand",
    method: "GET, POST",
    description: "Get random Thai cecan images",
    category: "entertainment",
    status: "free",
    responseBinary: true,
    params: []
  },
  {
    name: "Random Cecan Korea",
    path: "/random/cecan/korea",
    method: "GET, POST",
    description: "Get random Korean cecan images",
    category: "entertainment",
    status: "free",
    responseBinary: true,
    params: []
  },
  {
    name: "Random Cecan Japan",
    path: "/random/cecan/japan",
    method: "GET, POST",
    description: "Get random Japanese cecan images",
    category: "entertainment",
    status: "free",
    responseBinary: true,
    params: []
  },
  {
    name: "Random Cecan Indonesia",
    path: "/random/cecan/indonesia",
    method: "GET, POST",
    description: "Get random Indonesian cecan images",
    category: "entertainment",
    status: "free",
    responseBinary: true,
    params: []
  },
  {
    name: "Random Cecan China",
    path: "/random/cecan/china",
    method: "GET, POST",
    description: "Get random Chinese cecan images",
    category: "entertainment",
    status: "free",
    responseBinary: true,
    params: []
  },
  {
    name: "Random China (Alt)",
    path: "/random/china",
    method: "GET",
    description: "Get random China images (alternative source)",
    category: "entertainment",
    status: "free",
    responseBinary: true,
    params: []
  }
];

export default router;