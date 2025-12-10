import { Router } from "express";
import axios from "axios";
import ytSearch from "yt-search";
import { validate, unifiedHandler } from "../utils/validation.js";

const router = Router();

router.all("/api/youtube/search", unifiedHandler(async (params, req, res) => {
  const { query } = params;
  
  if (!validate.notEmpty(query)) {
    return res.status(200).json({ 
      success: false, 
      error: "Query is required", 
      errorType: "ValidationError", 
      hint: "Please provide a search query" 
    });
  }
  
  const results = await ytSearch(query);
  const videos = results.videos.slice(0, 10).map(v => ({
    id: v.videoId,
    title: v.title,
    url: v.url,
    thumbnail: v.thumbnail,
    duration: v.timestamp,
    views: v.views,
    channel: v.author.name
  }));
  
  res.json({ success: true, count: videos.length, data: videos });
}));

router.all("/api/youtube/download", unifiedHandler(async (params, req, res) => {
  const { url } = params;
  
  if (!validate.url(url) || (!url.includes("youtube.com") && !url.includes("youtu.be"))) {
    return res.status(200).json({ 
      success: false, 
      error: "Invalid YouTube URL", 
      errorType: "ValidationError", 
      hint: "Please provide a valid YouTube video URL" 
    });
  }
  
  const apiUrl = `https://www.a2zconverter.com/api/files/new-proxy?url=${encodeURIComponent(url)}`;
  const { data } = await axios.get(apiUrl, {
    headers: {
      "Referer": "https://www.a2zconverter.com/youtube-video-downloader",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  });
  
  res.json({ success: true, data });
}));

export const metadata = [
  {
    name: "YouTube Search",
    path: "/api/youtube/search",
    method: "GET, POST",
    description: "Search videos on YouTube",
    category: "social-media",
    status: "free",
    params: [
      {
        name: "query",
        type: "text",
        required: true,
        placeholder: "funny cats",
        description: "Search query"
      }
    ]
  },
  {
    name: "YouTube Download",
    path: "/api/youtube/download",
    method: "GET, POST",
    description: "Download YouTube videos in various qualities",
    category: "social-media",
    status: "free",
    params: [
      {
        name: "url",
        type: "text",
        required: true,
        placeholder: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        description: "YouTube video URL"
      }
    ]
  }
];

export default router;
