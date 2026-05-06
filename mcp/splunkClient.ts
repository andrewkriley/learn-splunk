import axios, { AxiosInstance } from "axios";
import https from "https";
import * as querystring from "querystring";

export class SplunkAPIError extends Error {
  public statusCode?: number;
  public details: unknown;

  constructor(message: string, statusCode?: number, details: unknown = {}) {
    super(message);
    this.name = "SplunkAPIError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

interface SplunkConfig {
  splunk_host: string;
  splunk_port: number;
  splunk_username?: string;
  splunk_password?: string;
  splunk_token?: string;
  verify_ssl: boolean;
}

export class SplunkClient {
  private config: SplunkConfig;
  private baseURL: string;
  private client?: AxiosInstance;

  constructor(config: SplunkConfig) {
    this.config = {
      splunk_host: config.splunk_host,
      splunk_port: config.splunk_port || 8089,
      splunk_username: config.splunk_username,
      splunk_password: config.splunk_password,
      splunk_token: config.splunk_token,
      verify_ssl: config.verify_ssl || false,
    };
    this.baseURL = `https://${this.config.splunk_host}:${this.config.splunk_port}`;
  }

  async connect(): Promise<void> {
    const headers: Record<string, string> = {};
    let auth = undefined;

    if (this.config.splunk_token) {
      headers.Authorization = `Splunk ${this.config.splunk_token}`;
    } else if (this.config.splunk_username && this.config.splunk_password) {
      auth = {
        username: this.config.splunk_username,
        password: this.config.splunk_password,
      };
    } else {
      throw new SplunkAPIError(
        "No valid authentication configured. Set either SPLUNK_TOKEN or SPLUNK_USERNAME/SPLUNK_PASSWORD.",
      );
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      auth,
      headers,
      timeout: parseInt(process.env.SPLUNK_TIMEOUT_MS || "120000", 10),
      httpsAgent: new https.Agent({
        rejectUnauthorized: this.config.verify_ssl,
      }),
    });

    await this.getServerInfo();
  }

  async disconnect(): Promise<void> {
    this.client = undefined;
  }

  private ensureConnected(): void {
    if (!this.client) {
      throw new SplunkAPIError("Client not connected. Call connect() first.");
    }
  }

  private parseEvents(responseData: unknown): Record<string, unknown>[] {
    if (typeof responseData === "object" && responseData !== null) {
      const data = responseData as {
        results?: Record<string, unknown>[];
        result?: Record<string, unknown>;
      };
      if (Array.isArray(data.results)) {
        return data.results;
      }
      if (data.result) {
        return [data.result];
      }
    }

    const text = typeof responseData === "string" ? responseData : JSON.stringify(responseData);
    const events: Record<string, unknown>[] = [];
    for (const line of text.trim().split("\n")) {
      if (!line.trim()) {
        continue;
      }
      try {
        const parsed = JSON.parse(line) as {
          result?: Record<string, unknown>;
          results?: Record<string, unknown>[];
        };
        if (parsed.result) {
          events.push(parsed.result);
        } else if (Array.isArray(parsed.results)) {
          events.push(...parsed.results);
        }
      } catch {
        continue;
      }
    }
    return events;
  }

  async getServerInfo(): Promise<Record<string, unknown>> {
    this.ensureConnected();
    try {
      const response = await this.client!.get("/services/server/info", {
        params: { output_mode: "json" },
      });
      return response.data?.entry?.[0]?.content || {};
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new SplunkAPIError("Failed to connect to Splunk", error.response?.status, {
          error: error.response?.data,
        });
      }
      throw new SplunkAPIError(`Failed to connect to Splunk: ${error}`);
    }
  }

  async searchOneshot(
    query: string,
    earliestTime = "-24h",
    latestTime = "now",
    maxCount = 100,
  ): Promise<Record<string, unknown>[]> {
    this.ensureConnected();
    const searchQuery = query.trim().startsWith("|") ? query : `search ${query}`;

    try {
      const response = await this.client!.post(
        "/services/search/jobs/oneshot",
        querystring.stringify({
          search: searchQuery,
          earliest_time: earliestTime,
          latest_time: latestTime,
          count: maxCount,
          output_mode: "json",
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );
      return this.parseEvents(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new SplunkAPIError("Search failed", error.response?.status, {
          error: error.response?.data,
        });
      }
      throw new SplunkAPIError(`Search failed: ${error}`);
    }
  }

  async searchExport(
    query: string,
    earliestTime = "-24h",
    latestTime = "now",
    maxCount = 100,
  ): Promise<Record<string, unknown>[]> {
    this.ensureConnected();
    const searchQuery = query.trim().startsWith("|") ? query : `search ${query}`;

    try {
      const response = await this.client!.post(
        "/services/search/jobs/export",
        querystring.stringify({
          search: searchQuery,
          earliest_time: earliestTime,
          latest_time: latestTime,
          count: maxCount,
          output_mode: "json",
          search_mode: "normal",
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );
      const events = this.parseEvents(response.data);
      return maxCount > 0 ? events.slice(0, maxCount) : events;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new SplunkAPIError("Export search failed", error.response?.status, {
          error: error.response?.data,
        });
      }
      throw new SplunkAPIError(`Export search failed: ${error}`);
    }
  }

  async getIndexes(): Promise<Record<string, unknown>[]> {
    this.ensureConnected();
    try {
      const response = await this.client!.get("/services/data/indexes", {
        params: { output_mode: "json" },
      });
      return (response.data.entry || []).map((entry: Record<string, unknown>) => {
        const content = (entry.content || {}) as Record<string, unknown>;
        return {
          name: entry.name || "",
          datatype: content.datatype || "event",
          totalEventCount: parseInt(String(content.totalEventCount || "0"), 10),
          currentDBSizeMB: parseFloat(String(content.currentDBSizeMB || "0")),
          maxDataSize: content.maxDataSize || "auto",
          maxTotalDataSizeMB: content.maxTotalDataSizeMB || "unknown",
          minTime: content.minTime || "",
          maxTime: content.maxTime || "",
          disabled: content.disabled || false,
        };
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new SplunkAPIError("Failed to get indexes", error.response?.status, {
          error: error.response?.data,
        });
      }
      throw new SplunkAPIError(`Failed to get indexes: ${error}`);
    }
  }

  async getSavedSearches(): Promise<Record<string, unknown>[]> {
    this.ensureConnected();
    try {
      const response = await this.client!.get("/services/saved/searches", {
        params: { output_mode: "json" },
      });
      return (response.data.entry || []).map((entry: Record<string, unknown>) => {
        const content = (entry.content || {}) as Record<string, unknown>;
        return {
          name: entry.name || "",
          search: content.search || "",
          description: content.description || "",
          is_scheduled: content.is_scheduled || false,
          cron_schedule: content.cron_schedule || "",
          next_scheduled_time: content.next_scheduled_time || "",
          actions: content.actions || "",
        };
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new SplunkAPIError("Failed to get saved searches", error.response?.status, {
          error: error.response?.data,
        });
      }
      throw new SplunkAPIError(`Failed to get saved searches: ${error}`);
    }
  }

  async runSavedSearch(searchName: string, triggerActions = false): Promise<Record<string, unknown>> {
    this.ensureConnected();
    try {
      const response = await this.client!.post(
        `/services/saved/searches/${encodeURIComponent(searchName)}/dispatch`,
        querystring.stringify({
          trigger_actions: triggerActions ? "1" : "0",
          output_mode: "json",
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
      );
      return response.data || {};
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new SplunkAPIError("Failed to run saved search", error.response?.status, {
          error: error.response?.data,
        });
      }
      throw new SplunkAPIError(`Failed to run saved search: ${error}`);
    }
  }
}
