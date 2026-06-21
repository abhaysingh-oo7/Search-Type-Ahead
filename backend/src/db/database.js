'use strict';

// in-memory store with JSON file persistence
// wanted to use SQLite but better-sqlite3 doesn't compile on Node 26 (V8 API changed)
// this does the same job — Map in RAM, flush to disk every so often

const fs   = require('fs');
const path = require('path');

const DATA_DIR  = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'query_count.csv');

class DataStore {
  constructor() {
    this.data       = new Map(); // query -> { query, count, trendingScore, lastSearched }
    this._saveTimer = null;

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    this._load();
  }

  _load() {
    try {
      const raw  = fs.readFileSync(DATA_FILE, 'utf8');
      const lines = raw.split('\n');
      let isFirst = true;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (isFirst) { isFirst = false; continue; } // Skip header

        // Simple CSV parsing assuming last column is count (and possibly trendingScore/lastSearched if saved by us)
        const parts = line.split(',');
        if (parts.length >= 2) {
          let q, c, t = 0, l = 0;
          if (parts.length === 4) {
            l = parseInt(parts.pop() || '0', 10);
            t = parseFloat(parts.pop() || '0');
            c = parseInt(parts.pop() || '0', 10);
            q = parts.join(',');
          } else {
            c = parseInt(parts.pop() || '0', 10);
            q = parts.join(',');
          }
          
          q = q.replace(/^"|"$/g, ''); // remove surrounding quotes
          if (q) {
            this.data.set(q, { query: q, count: c || 0, trendingScore: t || 0, lastSearched: l || 0 });
          }
        }
      }
      console.log(`[DataStore] Loaded ${this.data.size.toLocaleString()} queries from CSV.`);
    } catch (e) {
      console.log('[DataStore] Could not load CSV file:', e.message);
    }
  }

  save() {
    const rows = Array.from(this.data.values());
    let csv = "query,count\n";
    for (const r of rows) {
      let q = r.query.includes(',') ? `"${r.query}"` : r.query;
      csv += `${q},${r.count}\n`;
    }
    fs.writeFileSync(DATA_FILE, csv);
  }

  // debounce saves so we're not writing to disk constantly
  scheduleSave() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this.save();
      this._saveTimer = null;
    }, 200);
  }

  countAll()    { return this.data.size; }
  getAllRows()   { return Array.from(this.data.values()); }
  getRow(query) { return this.data.get(query.toLowerCase()) || null; }

  upsert(query, countDelta, lastSearched) {
    const q   = query.toLowerCase();
    const row = this.data.get(q);
    if (row) {
      row.count += countDelta;
      if (lastSearched > (row.lastSearched || 0)) row.lastSearched = lastSearched;
    } else {
      this.data.set(q, { query: q, count: countDelta, trendingScore: 0, lastSearched: lastSearched || 0 });
    }
    return this.data.get(q);
  }

  updateTrendingScore(query, score) {
    const row = this.data.get(query.toLowerCase());
    if (row) row.trendingScore = score;
  }

  // skip-insert for seed data — don't overwrite existing entries
  bulkInsert(rows) {
    for (const r of rows) {
      const q = r.query.toLowerCase().trim();
      if (!q || this.data.has(q)) continue;
      this.data.set(q, { query: q, count: r.count, trendingScore: 0, lastSearched: 0 });
    }
  }

  getTopTrending(limit = 10) {
    const userSearched = [];
    for (const row of this.data.values()) {
      if (row.lastSearched > 0) userSearched.push(row);
    }
    return userSearched
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);
  }
}

module.exports = new DataStore();
