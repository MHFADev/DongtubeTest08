import axios from "axios";

class HTTPClient {
  constructor(baseURL = "", options = {}) {
    this.client = axios.create({
      baseURL,
      timeout: options.timeout || 30000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ...options.headers
      }
    });
    
    this.client.interceptors.response.use(null, async (error) => {
      const config = error.config;
      if (!config || !config.retry) config.retry = 0;
      if (config.retry >= 2) return Promise.reject(error);
      
      config.retry++;
      await new Promise(resolve => setTimeout(resolve, config.retry * 1000));
      return this.client(config);
    });
  }
  
  async get(url, config = {}) {
    const { data } = await this.client.get(url, config);
    return data;
  }
  
  async post(url, payload, config = {}) {
    const { data } = await this.client.post(url, payload, config);
    return data;
  }
}

export default HTTPClient;