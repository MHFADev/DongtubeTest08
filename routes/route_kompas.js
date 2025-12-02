import { Router } from "express";
import axios from "axios";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

class Author {
  constructor(rawData = {}) {
    this.id = rawData.id || null;
    this.name = rawData.name || 'N/A';
    this.jobTitle = rawData.jobtitle ? rawData.jobtitle.trim() : '';
  }
}

class ArticleSummary {
  constructor(rawData = {}) {
    this.guid = rawData.guid || '';
    this.title = rawData.title || 'No Title';
    this.url = rawData.url || '';
    this.imageUrl = rawData.image || rawData.img || '';
    this.channel = rawData.channel || 'N/A';
    this.section = rawData.section || 'N/A';
    this.publishedDate = rawData.date ? new Date(rawData.date) : null;
  }
}

class Article {
  constructor(rawData, guid) {
    this.guid = guid;
    this.title = rawData.title || 'No Title';
    this.url = rawData.urlpage || '';
    this.description = rawData.description || '';
    this.channel = rawData.kanal || 'N/A';
    this.tags = rawData.tags || [];
    this.publishedDate = new Date(rawData.date);
    
    this.author = new Author(rawData.author);
    this.editor = new Author(rawData.editor);
    
    this.images = this._processMedia(rawData.photoblock, 'image');
    this.videos = this._processMedia(rawData.videoblock, 'video');
    
    const { html, text } = this._processContent(rawData.content);
    this.contentHtml = html;
    this.contentText = text;
  }

  _processMedia(mediaBlock = [], type) {
    return mediaBlock.map(item => ({
      url: item.block,
      author: item.author || null,
      caption: item.caption || null,
      order: parseInt(item.orderid, 10),
    }));
  }

  _processContent(contentArray = []) {
    let fullHtml = contentArray
      .map(htmlString => {
        if (htmlString.includes('[video.1]')) {
          const videoUrl = this.videos[0]?.url;
          return videoUrl ? `<p><strong>[Embedded Video]</strong> <a href="${videoUrl}" target="_blank">${videoUrl}</a></p>` : '';
        }
        return htmlString;
      })
      .join('');

    const plainText = fullHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|ul|ol)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n* ')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .split('\n').map(line => line.trim()).join('\n')
      .trim();
    
    return {
      html: fullHtml,
      text: plainText,
    };
  }
}

class Kompas {
  constructor() {
    this.baseUrl = 'https://api.kompas.com/apps';
    this.recommendationUrl = 'https://recommendation.kgdata.dev/rec/kompascom/api/v2';
    this.defaultHeaders = {
      'User-Agent': 'kompascom-android',
      'Accept-Encoding': 'gzip',
    };
    this.client = axios.create({ headers: this.defaultHeaders });
  }

  async getLatestNews(page = 1) {
    const url = `${this.baseUrl}/home?pages=${page}`;
    const response = await this.client.get(url);
    const rawArticles = response.data.latest || [];
    return rawArticles.map(articleData => new ArticleSummary(articleData));
  }

  async getArticleDetail(guid) {
    if (!guid) throw new Error('GUID must be provided.');
    const url = `${this.baseUrl}/v1/detail?guid=${guid}`;
    const response = await this.client.get(url);
    return new Article(response.data.result, guid);
  }

  async getRelatedArticles(pageUrl) {
    if (!pageUrl) throw new Error('Page URL must be provided.');
    const url = `${this.recommendationUrl}/recommendation/item`;
    const payload = { pageurl: pageUrl, pagetype: 'read', ukid: '' };
    const headers = { ...this.defaultHeaders, 'Content-Type': 'application/json; charset=UTF-8' };

    const response = await this.client.post(url, payload, { headers });
    const rawItems = response.data.items || [];
    return rawItems.map(itemData => new ArticleSummary(itemData));
  }
}

const kompas = new Kompas();

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

router.get("/api/kompas/latest", cacheMiddleware(5 * 60 * 1000), asyncHandler(async (req, res) => {
  const { page = 1 } = req.query;
  const result = await kompas.getLatestNews(parseInt(page));
  res.json({ 
    success: true, 
    page: parseInt(page),
    count: result.length, 
    data: result 
  });
}));

router.get("/api/kompas/detail", asyncHandler(async (req, res) => {
  const { guid } = req.query;
  
  if (!validate.notEmpty(guid)) {
    return res.status(200).json({
      success: false,
      error: "GUID is required",
      errorType: "ValidationError",
      hint: "Please provide an article GUID"
    });
  }
  
  const result = await kompas.getArticleDetail(guid);
  res.json({ success: true, data: result });
}));

router.post("/api/kompas/detail", asyncHandler(async (req, res) => {
  const { guid } = req.body;
  
  if (!validate.notEmpty(guid)) {
    return res.status(200).json({
      success: false,
      error: "GUID is required",
      errorType: "ValidationError",
      hint: "Please provide an article GUID"
    });
  }
  
  const result = await kompas.getArticleDetail(guid);
  res.json({ success: true, data: result });
}));

router.get("/api/kompas/related", asyncHandler(async (req, res) => {
  const { url } = req.query;
  
  if (!validate.url(url)) {
    return res.status(200).json({
      success: false,
      error: "Valid URL is required",
      errorType: "ValidationError",
      hint: "Please provide a valid article URL"
    });
  }
  
  const result = await kompas.getRelatedArticles(url);
  res.json({ success: true, count: result.length, data: result });
}));

router.post("/api/kompas/related", asyncHandler(async (req, res) => {
  const { url } = req.body;
  
  if (!validate.url(url)) {
    return res.status(200).json({
      success: false,
      error: "Valid URL is required",
      errorType: "ValidationError",
      hint: "Please provide a valid article URL"
    });
  }
  
  const result = await kompas.getRelatedArticles(url);
  res.json({ success: true, count: result.length, data: result });
}));

export const metadata = [
  {
    name: "Kompas Latest News",
    path: "/api/kompas/latest",
    method: "GET",
    description: "Get latest news articles from Kompas",
    category: "news",
    status: "free",
    params: [
      {
        name: "page",
        type: "number",
        required: false,
        placeholder: "1",
        description: "Page number (default: 1)"
      }
    ]
  },
  {
    name: "Kompas Article Detail",
    path: "/api/kompas/detail",
    method: "GET, POST",
    description: "Get full article content including text, images, and metadata",
    category: "news",
    status: "free",
    params: [
      {
        name: "guid",
        type: "text",
        required: true,
        placeholder: ".xml.2025.10.17.06302947",
        description: "Article GUID from latest news"
      }
    ]
  },
  {
    name: "Kompas Related Articles",
    path: "/api/kompas/related",
    method: "GET, POST",
    description: "Get related articles based on article URL",
    category: "news",
    status: "free",
    params: [
      {
        name: "url",
        type: "text",
        required: true,
        placeholder: "http://tekno.kompas.com/read/2025/10/17/06302947/article",
        description: "Article URL"
      }
    ]
  }
];

export default router;