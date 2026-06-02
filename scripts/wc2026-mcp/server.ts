import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

interface Team {
  name: string;
  code: string;
  country: string;
}

interface Venue {
  stadium: string;
  city: string;
  country: string;
}

interface BrazilMatch {
  matchId: string;
  matchDay: number | null;
  stage: string;
  group: string;
  dateUtc: string;
  dateLocal: string;
  home: Team;
  away: Team;
  venue: Venue;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const MATCHES_PATH = resolve(__dirname, "../../apps/web/public/wc2026/brazil-matches.json");

function loadMatches(): BrazilMatch[] {
  const raw = readFileSync(MATCHES_PATH, "utf-8");
  return JSON.parse(raw) as BrazilMatch[];
}

function getOpponent(match: BrazilMatch): Team {
  return match.home.name === "Brazil" ? match.away : match.home;
}

function formatMatch(match: BrazilMatch): string {
  return [
    `${match.home.name} vs ${match.away.name}`,
    `  Stage: ${match.stage}${match.group ? ` (${match.group})` : ""}`,
    `  Kickoff (UTC): ${match.dateUtc}`,
    `  Venue: ${match.venue.stadium}, ${match.venue.city}, ${match.venue.country}`,
  ].join("\n");
}

const server = new McpServer({
  name: "wc2026-brazil-matches",
  version: "1.0.0",
});

server.registerTool(
  "list_matches",
  {
    title: "List Brazil World Cup 2026 matches",
    description:
      "List Brazil's matches at the 2026 World Cup. Optionally filter by opponent (team name or code) or host city. Matching is case-insensitive substring.",
    inputSchema: {
      opponent: z.string().optional().describe("Filter by opponent team name or code, e.g. 'Haiti' or 'HAI'"),
      city: z.string().optional().describe("Filter by host city, e.g. 'Miami'"),
    },
  },
  async ({ opponent, city }) => {
    let matches = loadMatches();

    if (opponent) {
      const needle = opponent.toLowerCase();
      matches = matches.filter((match) => {
        const team = getOpponent(match);
        return team.name.toLowerCase().includes(needle) || team.code.toLowerCase().includes(needle);
      });
    }

    if (city) {
      const needle = city.toLowerCase();
      matches = matches.filter((match) => match.venue.city.toLowerCase().includes(needle));
    }

    if (matches.length === 0) {
      return {
        content: [{ type: "text", text: "No matches found for the given filters." }],
        structuredContent: { matches: [] },
      };
    }

    const text = matches.map(formatMatch).join("\n\n");
    return {
      content: [{ type: "text", text }],
      structuredContent: { matches },
    };
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is reserved for the JSON-RPC protocol; diagnostics must go to stderr.
  console.error("wc2026-brazil-matches MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting wc2026-brazil-matches MCP server:", error);
  process.exit(1);
});
