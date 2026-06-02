# WC2026 Brazil Matches MCP Server

A small [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
Brazil's 2026 World Cup matches (sourced from
`apps/web/public/wc2026/brazil-matches.json`) to MCP clients such as Claude Desktop or
Claude Code.

It communicates over **stdio** and exposes a single tool.

## Tools

### `list_matches`

Lists Brazil's matches. Both arguments are optional and matched case-insensitively as
substrings:

| Argument   | Type     | Description                                            |
| ---------- | -------- | ------------------------------------------------------ |
| `opponent` | `string` | Filter by opponent team name or code (e.g. `Haiti`).   |
| `city`     | `string` | Filter by host city (e.g. `Miami`).                    |

Returns a human-readable summary plus `structuredContent.matches` with the raw match objects.

## Run locally

```bash
yarn wc2026-mcp
```

The server runs on stdio. To explore it interactively, use the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector yarn wc2026-mcp
```

## Register with an MCP client

Add the following to your client's MCP configuration (e.g. `claude_desktop_config.json`),
using an absolute path to this repository as the working directory:

```json
{
  "mcpServers": {
    "wc2026-brazil": {
      "command": "yarn",
      "args": ["wc2026-mcp"],
      "cwd": "/absolute/path/to/cal.diy"
    }
  }
}
```
