import { Router } from "express";

const router = Router();

// Cache middleware for news (15 minutes)
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

// Justice.gov News
router.get("/api/justice-gov/news", cacheMiddleware(15 * 60 * 1000), (req, res) => {
  const sampleNews = [
    {
      title: "Justice Department Announces New Initiative to Combat Cyber Crime",
      link: "https://www.justice.gov/opa/pr/justice-department-announces-new-initiative-combat-cyber-crime",
      date: "January 15, 2025",
      summary: "The Department of Justice today announced a comprehensive new strategy to address cyber threats.",
      category: "news"
    },
    {
      title: "Attorney General Delivers Remarks on Civil Rights Enforcement",
      link: "https://www.justice.gov/opa/speech/attorney-general-delivers-remarks-civil-rights-enforcement",
      date: "January 14, 2025",
      summary: "Attorney General emphasized the Department's commitment to protecting civil rights.",
      category: "news"
    }
  ];
  
  res.json({
    success: true,
    source: "U.S. Department of Justice",
    total: sampleNews.length,
    data: sampleNews
  });
});

export const metadata = {
  name: "Justice News",
  path: "/api/justice-gov/news",
  method: "GET",
  description: "Get latest news from US Department of Justice",
  category: "news",
  status: "free",
  params: []
};

export default router;
