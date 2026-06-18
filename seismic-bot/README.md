# Seismic Discord Bot & Stats API

This is a companion Discord Bot for the **Seismic Card Generator**. It tracks user stats (total messages, tweet/content shares, events, and arts) inside the Discord server and exposes them via an HTTP API to auto-fill card generators.

## Features
- **Total Messages**: Tracks all messages sent by users dynamically.
- **Content Count**: Counts messages sent by users in the `#content` channel (tweets shared).
- **Auto-Stats Scraper**: Listens to the `#stats` channel. When the main stats bot prints user stats (e.g. via "Show My Stats" button), this bot parses `Events` and `Arts` counts automatically.
- **Express HTTP API**: Exposes a CORS-enabled HTTP endpoint for the profile card generator.

## Requirements
- Node.js v16.x or higher

## Setup & Running

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file or export the following variables:
   - `DISCORD_TOKEN`: Your Discord Bot Token (from Discord Developer Portal -> Bot -> Copy Token).
   - `CONTENT_CHANNEL_ID`: ID of the channel where users submit content/tweets (e.g. `1234567890abcdef`).
   - `STATS_CHANNEL_ID`: ID of the channel where the stats bot prints user stats.
   - `PORT`: Port to run the HTTP API server (default is `3000`).

   *Example `.env` file:*
   ```env
   DISCORD_TOKEN=MTEyMzQ1Njc4OTAxMjM0NTY3OA.G...
   CONTENT_CHANNEL_ID=1343751435711414380
   STATS_CHANNEL_ID=1343751435711414390
   PORT=3000
   ```

3. **Run the Bot**:
   ```bash
   npm start
   ```

## Bot Scraper Regex Guide
The bot automatically reads message embeds inside the `STATS_CHANNEL_ID` and parses:
- `Events` via: `/events?\s*(?:joined|completed)?\s*[:\-=]?\s*(\d+)/i`
- `Arts` via: `/arts?\s*(?:count|created)?\s*[:\-=]?\s*(\d+)/i`

Whenever a user triggers the main server stats bot, this bot captures and caches those values to expose them to the website card generator.

## API Endpoint
- **Get Stats**: `GET http://localhost:3000/api/stats/<discord_user_id>`
  *Response:*
  ```json
  {
    "messages": 1540,
    "tweets": 184,
    "events": 12,
    "arts": 4
  }
  ```
