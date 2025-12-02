import { Router } from "express";
import { validate, asyncHandler } from "../utils/validation.js";

const router = Router();

class StoryGenerator {
  constructor() {
    this.apiKey = "1234Test";
    this.baseUrl = "https://responsedh.mycdnpro.com";
    this.endpoint = '/api/Text/Generate';
  }

  async generate(params) {
    const {
      text,
      client = 'DongtubeAPI',
      mode = 'Any genre',
      length = 'Short',
      creative = 'Medium',
      language = null,
      syllable = null
    } = params;

    if (!text) {
      throw new Error('Text parameter is required');
    }

    const validModes = [
      'Any genre', 'Action', 'Sci-fi', 'Mystery', 'Biography',
      'Young Adult', 'Crime', 'Horror', 'Thriller', 'Children Books',
      'Non-fiction', 'Humor', 'Historical Fiction'
    ];

    const validLengths = ['Short', 'Novel'];
    const validCreative = ['Medium', 'High'];

    if (!validModes.includes(mode)) {
      throw new Error(`Invalid mode. Must be one of: ${validModes.join(', ')}`);
    }

    if (!validLengths.includes(length)) {
      throw new Error(`Invalid length. Must be one of: ${validLengths.join(', ')}`);
    }

    if (!validCreative.includes(creative)) {
      throw new Error(`Invalid creative level. Must be one of: ${validCreative.join(', ')}`);
    }

    const requestBody = {
      text,
      client,
      toolName: '_storygenerator',
      mode,
      length,
      language,
      syllable,
      creative
    };

    const response = await fetch(`${this.baseUrl}${this.endpoint}`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Dart/3.8 (dart:io)',
        'Content-Type': 'application/json',
        'dhp-api-key': this.apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.isSuccess) {
      throw new Error(`API error: ${data.errorMessages?.join(', ') || 'Unknown error'}`);
    }

    return data.response;
  }
}

const generator = new StoryGenerator();

router.get("/ai/story", asyncHandler(async (req, res) => {
  const { text, mode, length, creative, language, syllable } = req.query;
  
  if (!validate.notEmpty(text)) {
    return res.status(200).json({
      success: false,
      error: "Text parameter is required",
      errorType: "ValidationError",
      hint: "Please provide a story prompt or theme"
    });
  }
  
  const story = await generator.generate({
    text,
    mode,
    length,
    creative,
    language,
    syllable
  });
  
  res.json({
    success: true,
    data: {
      prompt: text,
      mode: mode || 'Any genre',
      length: length || 'Short',
      creative: creative || 'Medium',
      story
    }
  });
}));

router.post("/ai/story", asyncHandler(async (req, res) => {
  const { text, mode, length, creative, language, syllable } = req.body;
  
  if (!validate.notEmpty(text)) {
    return res.status(200).json({
      success: false,
      error: "Text parameter is required",
      errorType: "ValidationError",
      hint: "Please provide a story prompt or theme"
    });
  }
  
  const story = await generator.generate({
    text,
    mode,
    length,
    creative,
    language,
    syllable
  });
  
  res.json({
    success: true,
    data: {
      prompt: text,
      mode: mode || 'Any genre',
      length: length || 'Short',
      creative: creative || 'Medium',
      story
    }
  });
}));

export const metadata = {
  name: "AI Story Generator",
  path: "/ai/story",
  method: "GET, POST",
  description: "Generate creative stories using AI based on your prompt",
  category: "ai",
  status: "free",
  params: [
    {
      name: "text",
      type: "text",
      required: true,
      placeholder: "A little boy and a cat",
      description: "Story prompt or theme"
    },
    {
      name: "mode",
      type: "text",
      required: false,
      placeholder: "Any genre",
      description: "Genre: Any genre, Action, Sci-fi, Mystery, Horror, etc"
    },
    {
      name: "length",
      type: "text",
      required: false,
      placeholder: "Short",
      description: "Story length: Short or Novel"
    },
    {
      name: "creative",
      type: "text",
      required: false,
      placeholder: "Medium",
      description: "Creativity level: Medium or High"
    }
  ]
};

export default router;