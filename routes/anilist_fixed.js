import { Router } from "express";
import axios from "axios";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

class AniList {
  constructor() {
    this.apiUrl = "https://graphql.anilist.co";
  }

  async query(query, variables = {}) {
    try {
      const response = await axios.post(this.apiUrl, {
        query,
        variables
      }, {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        timeout: 15000
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      return response.data.data;
    } catch (error) {
      throw new Error(`AniList API error: ${error.message}`);
    }
  }

  // Search dengan detail yang lebih sederhana dan aman
  async searchFull(query, type = "ANIME", page = 1, perPage = 10) {
    const gql = `
      query ($search: String, $type: MediaType, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
          }
          media(search: $search, type: $type, sort: POPULARITY_DESC) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              extraLarge
              large
              medium
              color
            }
            bannerImage
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
            description
            season
            seasonYear
            type
            format
            status
            episodes
            duration
            chapters
            volumes
            genres
            synonyms
            source
            averageScore
            meanScore
            popularity
            favourites
            trending
            tags {
              name
              rank
            }
            studios {
              nodes {
                id
                name
                isAnimationStudio
              }
            }
            isAdult
            nextAiringEpisode {
              airingAt
              timeUntilAiring
              episode
            }
          }
        }
      }
    `;

    const data = await this.query(gql, { search: query, type, page, perPage });
    return data.Page;
  }

  // Get Trending dengan detail lengkap
  async getTrending(type = "ANIME", page = 1, perPage = 20) {
    const gql = `
      query ($type: MediaType, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
          }
          media(type: $type, sort: TRENDING_DESC) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              medium
              color
            }
            bannerImage
            startDate {
              year
              month
              day
            }
            description
            type
            format
            status
            episodes
            chapters
            genres
            averageScore
            popularity
            trending
            studios {
              nodes {
                name
              }
            }
            isAdult
            nextAiringEpisode {
              episode
              airingAt
              timeUntilAiring
            }
          }
        }
      }
    `;

    const data = await this.query(gql, { type, page, perPage });
    return data.Page;
  }

  // Get Popular dengan detail lengkap
  async getPopular(type = "ANIME", page = 1, perPage = 20) {
    const gql = `
      query ($type: MediaType, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
          }
          media(type: $type, sort: POPULARITY_DESC) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              medium
              color
            }
            bannerImage
            startDate {
              year
              month
              day
            }
            description
            type
            format
            status
            episodes
            chapters
            genres
            averageScore
            popularity
            studios {
              nodes {
                name
              }
            }
            isAdult
          }
        }
      }
    `;

    const data = await this.query(gql, { type, page, perPage });
    return data.Page;
  }

  // Get Seasonal Anime dengan detail lengkap
  async getSeasonal(season, year, page = 1, perPage = 20) {
    const gql = `
      query ($season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
          }
          media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              medium
              color
            }
            bannerImage
            startDate {
              year
              month
              day
            }
            description
            format
            status
            episodes
            genres
            averageScore
            popularity
            studios {
              nodes {
                name
              }
            }
            nextAiringEpisode {
              episode
              airingAt
              timeUntilAiring
            }
          }
        }
      }
    `;

    const data = await this.query(gql, { season: season.toUpperCase(), seasonYear: parseInt(year), page, perPage });
    return data.Page;
  }

  // Search Character dengan detail yang disederhanakan
  async searchCharacter(query, page = 1, perPage = 10) {
    const gql = `
      query ($search: String, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
          }
          characters(search: $search, sort: FAVOURITES_DESC) {
            id
            name {
              full
              native
            }
            image {
              large
              medium
            }
            description
            gender
            dateOfBirth {
              year
              month
              day
            }
            age
            favourites
            media(perPage: 5, sort: POPULARITY_DESC) {
              nodes {
                id
                title {
                  romaji
                  english
                }
                type
                format
                coverImage {
                  medium
                }
                averageScore
              }
            }
          }
        }
      }
    `;

    const data = await this.query(gql, { search: query, page, perPage });
    return data.Page;
  }

  // Get Random Anime/Manga dengan detail
  async getRandom(type = "ANIME") {
    const randomPage = Math.floor(Math.random() * 50) + 1;
    const gql = `
      query ($type: MediaType, $page: Int) {
        Page(page: $page, perPage: 1) {
          media(type: $type, sort: POPULARITY_DESC) {
            id
            title {
              romaji
              english
              native
            }
            coverImage {
              large
              color
            }
            bannerImage
            description
            format
            status
            episodes
            chapters
            genres
            averageScore
            popularity
            studios {
              nodes {
                name
              }
            }
          }
        }
      }
    `;

    const data = await this.query(gql, { type, page: randomPage });
    return data.Page.media[0];
  }

  // Get Airing Schedule dengan detail
  async getAiringSchedule(page = 1, perPage = 20) {
    const gql = `
      query ($page: Int, $perPage: Int, $airingAt_greater: Int, $airingAt_lesser: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            currentPage
            lastPage
            hasNextPage
          }
          airingSchedules(
            airingAt_greater: $airingAt_greater
            airingAt_lesser: $airingAt_lesser
            sort: TIME
          ) {
            id
            airingAt
            timeUntilAiring
            episode
            media {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                large
                color
              }
              bannerImage
              description
              status
              genres
              averageScore
              studios {
                nodes {
                  name
                }
              }
            }
          }
        }
      }
    `;

    const now = Math.floor(Date.now() / 1000);
    const oneWeek = 7 * 24 * 60 * 60;

    const data = await this.query(gql, {
      page,
      perPage,
      airingAt_greater: now,
      airingAt_lesser: now + oneWeek
    });
    return data.Page;
  }
}

const anilist = new AniList();

// Search Anime
router.get("/api/anilist/anime/search", asyncHandler(async (req, res) => {
  const { query, page = 1, perPage = 10 } = req.query;
  
  if (!validate.notEmpty(query)) {
    return res.status(200).json({
      success: false,
      error: "Query parameter is required",
      errorType: "ValidationError",
      hint: "Please provide a search query"
    });
  }
  
  const result = await anilist.searchFull(query, "ANIME", parseInt(page), parseInt(perPage));
  res.json({ success: true, data: result });
}));

// Search Manga
router.get("/api/anilist/manga/search", asyncHandler(async (req, res) => {
  const { query, page = 1, perPage = 10 } = req.query;
  
  if (!validate.notEmpty(query)) {
    return res.status(200).json({
      success: false,
      error: "Query parameter is required",
      errorType: "ValidationError",
      hint: "Please provide a search query"
    });
  }
  
  const result = await anilist.searchFull(query, "MANGA", parseInt(page), parseInt(perPage));
  res.json({ success: true, data: result });
}));

// Trending Anime
router.get("/api/anilist/anime/trending", asyncHandler(async (req, res) => {
  const { page = 1, perPage = 20 } = req.query;
  const result = await anilist.getTrending("ANIME", parseInt(page), parseInt(perPage));
  res.json({ success: true, data: result });
}));

// Trending Manga
router.get("/api/anilist/manga/trending", asyncHandler(async (req, res) => {
  const { page = 1, perPage = 20 } = req.query;
  const result = await anilist.getTrending("MANGA", parseInt(page), parseInt(perPage));
  res.json({ success: true, data: result });
}));

// Popular Anime
router.get("/api/anilist/anime/popular", asyncHandler(async (req, res) => {
  const { page = 1, perPage = 20 } = req.query;
  const result = await anilist.getPopular("ANIME", parseInt(page), parseInt(perPage));
  res.json({ success: true, data: result });
}));

// Popular Manga
router.get("/api/anilist/manga/popular", asyncHandler(async (req, res) => {
  const { page = 1, perPage = 20 } = req.query;
  const result = await anilist.getPopular("MANGA", parseInt(page), parseInt(perPage));
  res.json({ success: true, data: result });
}));

// Seasonal Anime
router.get("/api/anilist/anime/season", asyncHandler(async (req, res) => {
  const { season, year, page = 1, perPage = 20 } = req.query;
  
  if (!season || !year) {
    return res.status(200).json({
      success: false,
      error: "Season and year parameters are required",
      errorType: "ValidationError",
      hint: "Please provide both season and year",
      validSeasons: ["WINTER", "SPRING", "SUMMER", "FALL"]
    });
  }
  
  const result = await anilist.getSeasonal(season, year, parseInt(page), parseInt(perPage));
  res.json({ success: true, data: result });
}));

// Random Anime
router.get("/api/anilist/anime/random", asyncHandler(async (req, res) => {
  const result = await anilist.getRandom("ANIME");
  res.json({ success: true, data: result });
}));

// Random Manga
router.get("/api/anilist/manga/random", asyncHandler(async (req, res) => {
  const result = await anilist.getRandom("MANGA");
  res.json({ success: true, data: result });
}));

// Search Character
router.get("/api/anilist/character/search", asyncHandler(async (req, res) => {
  const { query, page = 1, perPage = 10 } = req.query;
  
  if (!validate.notEmpty(query)) {
    return res.status(200).json({
      success: false,
      error: "Query parameter is required",
      errorType: "ValidationError",
      hint: "Please provide a character name to search"
    });
  }
  
  const result = await anilist.searchCharacter(query, parseInt(page), parseInt(perPage));
  res.json({ success: true, data: result });
}));

// Airing Schedule
router.get("/api/anilist/airing", asyncHandler(async (req, res) => {
  const { page = 1, perPage = 20 } = req.query;
  const result = await anilist.getAiringSchedule(parseInt(page), parseInt(perPage));
  res.json({ success: true, data: result });
}));

export const metadata = [
  {
    name: "AniList Search Anime",
    path: "/api/anilist/anime/search",
    method: "GET",
    description: "Search anime with details",
    category: "search",
    status: "free",
    params: [
      { name: "query", type: "text", required: true, placeholder: "Naruto", description: "Search query" },
      { name: "page", type: "number", required: false, placeholder: "1", description: "Page number" },
      { name: "perPage", type: "number", required: false, placeholder: "10", description: "Results per page" }
    ]
  },
  {
    name: "AniList Search Manga",
    path: "/api/anilist/manga/search",
    method: "GET",
    description: "Search manga with details",
    category: "search",
    status: "free",
    params: [
      { name: "query", type: "text", required: true, placeholder: "One Piece", description: "Search query" },
      { name: "page", type: "number", required: false, placeholder: "1", description: "Page number" },
      { name: "perPage", type: "number", required: false, placeholder: "10", description: "Results per page" }
    ]
  },
  {
    name: "AniList Trending Anime",
    path: "/api/anilist/anime/trending",
    method: "GET",
    description: "Get trending anime with details",
    category: "entertainment",
    status: "free",
    params: [
      { name: "page", type: "number", required: false, placeholder: "1", description: "Page number" },
      { name: "perPage", type: "number", required: false, placeholder: "20", description: "Results per page" }
    ]
  },
  {
    name: "AniList Trending Manga",
    path: "/api/anilist/manga/trending",
    method: "GET",
    description: "Get trending manga with details",
    category: "entertainment",
    status: "free",
    params: [
      { name: "page", type: "number", required: false, placeholder: "1", description: "Page number" },
      { name: "perPage", type: "number", required: false, placeholder: "20", description: "Results per page" }
    ]
  },
  {
    name: "AniList Popular Anime",
    path: "/api/anilist/anime/popular",
    method: "GET",
    description: "Get popular anime with details",
    category: "entertainment",
    status: "free",
    params: [
      { name: "page", type: "number", required: false, placeholder: "1", description: "Page number" },
      { name: "perPage", type: "number", required: false, placeholder: "20", description: "Results per page" }
    ]
  },
  {
    name: "AniList Popular Manga",
    path: "/api/anilist/manga/popular",
    method: "GET",
    description: "Get popular manga with details",
    category: "entertainment",
    status: "free",
    params: [
      { name: "page", type: "number", required: false, placeholder: "1", description: "Page number" },
      { name: "perPage", type: "number", required: false, placeholder: "20", description: "Results per page" }
    ]
  },
  {
    name: "AniList Seasonal Anime",
    path: "/api/anilist/anime/season",
    method: "GET",
    description: "Get anime by season and year with details",
    category: "entertainment",
    status: "free",
    params: [
      { name: "season", type: "text", required: true, placeholder: "WINTER", description: "Season: WINTER, SPRING, SUMMER, FALL" },
      { name: "year", type: "number", required: true, placeholder: "2025", description: "Year" },
      { name: "page", type: "number", required: false, placeholder: "1", description: "Page number" },
      { name: "perPage", type: "number", required: false, placeholder: "20", description: "Results per page" }
    ]
  },
  {
    name: "AniList Random Anime",
    path: "/api/anilist/anime/random",
    method: "GET",
    description: "Get random anime with details",
    category: "entertainment",
    status: "free",
    params: []
  },
  {
    name: "AniList Random Manga",
    path: "/api/anilist/manga/random",
    method: "GET",
    description: "Get random manga with details",
    category: "entertainment",
    status: "free",
    params: []
  },
  {
    name: "AniList Search Character",
    path: "/api/anilist/character/search",
    method: "GET",
    description: "Search characters with details",
    category: "search",
    status: "free",
    params: [
      { name: "query", type: "text", required: true, placeholder: "Nezuko", description: "Character name" },
      { name: "page", type: "number", required: false, placeholder: "1", description: "Page number" },
      { name: "perPage", type: "number", required: false, placeholder: "10", description: "Results per page" }
    ]
  },
  {
    name: "AniList Airing Schedule",
    path: "/api/anilist/airing",
    method: "GET",
    description: "Get anime airing schedule (next 7 days) with details",
    category: "entertainment",
    status: "free",
    params: [
      { name: "page", type: "number", required: false, placeholder: "1", description: "Page number" },
      { name: "perPage", type: "number", required: false, placeholder: "20", description: "Results per page" }
    ]
  }
];

export default router;