import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { asyncHandler } from "../utils/validation.js";

const router = Router();

class MemeAggregator {
  constructor() {
    this.sources = {
      reddit: "https://meme-api.com/gimme",
      imgflip: "https://api.imgflip.com/get_memes"
    };
  }

  // Reddit Meme API (paling reliable)
  async getRedditMeme(subreddit = "memes") {
    try {
      const response = await axios.get(`https://meme-api.com/gimme/${subreddit}`, {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      if (!response.data) {
        throw new Error("No meme data received");
      }

      return {
        id: response.data.postLink?.split("/").pop() || Date.now().toString(),
        title: response.data.title,
        media: response.data.url,
        mediaType: response.data.url?.endsWith('.mp4') || response.data.url?.endsWith('.gif') ? 'video/gif' : 'image',
        upvotes: response.data.ups || 0,
        author: response.data.author,
        subreddit: response.data.subreddit,
        nsfw: response.data.nsfw || false,
        spoiler: response.data.spoiler || false,
        postLink: response.data.postLink,
        preview: response.data.preview || []
      };
    } catch (error) {
      throw new Error(`Reddit meme API failed: ${error.message}`);
    }
  }

  // ImgFlip Memes
  async getImgflipMemes() {
    try {
      const response = await axios.get("https://api.imgflip.com/get_memes", {
        timeout: 10000
      });

      if (!response.data?.success || !response.data?.data?.memes) {
        throw new Error("Failed to fetch Imgflip memes");
      }

      return response.data.data.memes.map(meme => ({
        id: meme.id,
        title: meme.name,
        media: meme.url,
        mediaType: 'image',
        width: meme.width,
        height: meme.height,
        boxCount: meme.box_count
      }));
    } catch (error) {
      throw new Error(`Imgflip API failed: ${error.message}`);
    }
  }

  async getRandomImgflipMeme() {
    const memes = await this.getImgflipMemes();
    return memes[Math.floor(Math.random() * memes.length)];
  }


}

const memeAgg = new MemeAggregator();

// Random meme from Reddit (most reliable)
router.get("/api/meme/random", asyncHandler(async (req, res) => {
  const { subreddit } = req.query;
  const meme = await memeAgg.getRedditMeme(subreddit || "memes");
  res.json({
    success: true,
    source: "reddit",
    data: meme
  });
}));

router.post("/api/meme/random", asyncHandler(async (req, res) => {
  const { subreddit } = req.body;
  const meme = await memeAgg.getRedditMeme(subreddit || "memes");
  res.json({
    success: true,
    source: "reddit",
    data: meme
  });
}));

// Random meme from Imgflip
router.get("/api/meme/imgflip", asyncHandler(async (req, res) => {
  const meme = await memeAgg.getRandomImgflipMeme();
  res.json({
    success: true,
    source: "imgflip",
    data: meme
  });
}));

// Get all Imgflip meme templates
router.get("/api/meme/imgflip/all", asyncHandler(async (req, res) => {
  const memes = await memeAgg.getImgflipMemes();
  res.json({
    success: true,
    source: "imgflip",
    total: memes.length,
    data: memes
  });
}));




export const metadata = [
  {
    name: "Random Meme",
    path: "/api/meme/random",
    method: "GET, POST",
    description: "Get random meme from Reddit (most reliable)",
    category: "entertainment",
    status: "free",
    params: [
      {
        name: "subreddit",
        type: "text",
        required: false,
        placeholder: "memes",
        description: "Subreddit name (default: memes). Try: memes, dankmemes, wholesomememes, me_irl, funny, ProgrammerHumor"
      }
    ]
  },
  {
    name: "Imgflip Random Meme",
    path: "/api/meme/imgflip",
    method: "GET",
    description: "Get random meme template from Imgflip",
    category: "entertainment",
    status: "free",
    params: []
  },
  {
    name: "Imgflip All Templates",
    path: "/api/meme/imgflip/all",
    method: "GET",
    description: "Get all meme templates from Imgflip (100+ templates)",
    category: "entertainment",
    status: "free",
    params: []
  }
];

export default router;