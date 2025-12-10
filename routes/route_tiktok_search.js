import { Router } from "express";
import axios from "axios";
import { validate, unifiedHandler } from "../utils/validation.js";

const router = Router();

class TikTokSearch {
  async search(query, count = 15) {
    if (!query) {
      throw new Error("Query is required");
    }

    const json = { keywords: query, count, cursor: 0, web: 1, hd: 1 };
    const { data } = await axios.post(
      "https://tikwm.com/api/feed/search",
      json,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
        },
        timeout: 30000
      }
    );

    if (!data || !data.data || !data.data.videos.length) {
      throw new Error("No videos found");
    }

    return data.data.videos.map((video) => ({
      id: video.id,
      title: video.title,
      author: {
        name: video.author.nickname,
        username: video.author.unique_id,
      },
      stats: {
        play_count: video.play_count,
        like_count: video.digg_count,
        comment_count: video.comment_count,
        share_count: video.share_count,
      },
      music: video.music_info,
      media: {
        no_watermark: "https://tikwm.com" + video.play,
        watermark: "https://tikwm.com" + video.wmplay,
        music: "https://tikwm.com" + video.music,
        cover: "https://tikwm.com" + video.cover,
      },
    }));
  }
}

const tiktokSearch = new TikTokSearch();

router.all("/api/tiktok/search", unifiedHandler(async (params, req, res) => {
  const { q, query, count = 15 } = params;
  const searchQuery = q || query;
  
  if (!validate.notEmpty(searchQuery)) {
    return res.status(200).json({
      success: false,
      error: "Query is required",
      errorType: "ValidationError",
      hint: "Please provide a search query (use 'q' for GET or 'query' for POST)"
    });
  }
  
  if (!validate.number(count, 1, 50)) {
    return res.status(200).json({
      success: false,
      error: "Count must be between 1 and 50",
      errorType: "ValidationError"
    });
  }
  
  const result = await tiktokSearch.search(searchQuery, parseInt(count));
  res.json({
    success: true,
    query: searchQuery,
    count: result.length,
    data: result
  });
}));

export const metadata = {
  name: "TikTok Search",
  path: "/api/tiktok/search",
  method: "GET, POST",
  description: "Search TikTok videos with download links (no watermark available)",
  category: "social-media",
  status: "free",
  params: [
    {
      name: "q",
      type: "text",
      required: true,
      placeholder: "funny cats",
      description: "Search query (POST: use 'query' instead)"
    },
    {
      name: "count",
      type: "number",
      required: false,
      placeholder: "15",
      description: "Number of results (1-50, default: 15)"
    }
  ]
};

export default router;
