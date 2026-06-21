# SearchAhead - Typeahead System (HLD Assignment)

Hi! This is my submission for the High Level Design assignment. I built a full-stack search typeahead system, similar to the suggestions dropdown you see on Google, Netflix, or Amazon when you start typing a query. 

The main goal of this assignment was to design a backend data system that can serve search suggestions extremely fast (low latency reads), manage a distributed cache properly, and reduce the write pressure on the primary database when lots of users are searching at the exact same time.

## Tech Stack Used

* **Backend:** Node.js, Express.js
* **Frontend:** React, Vite, Vanilla CSS (using a dark glassmorphism UI theme)
* **Storage Layer:** Custom in-memory DataStore backed by a JSON file (more on this below)
* **Algorithms/Data Structures:** Trie, Consistent Hashing (MD5), Least Recently Used (LRU) Cache, Exponential Time-Decay Formula

---

## How to Run It Locally

You will need Node.js installed on your machine.

### 1. Start the Backend Server

Open your terminal and run:
```bash
cd backend
npm install
npm run dev
```

**Important note about the first run:**
When you run the backend for the first time, it checks if the database file exists. If it doesn't, it will automatically run my dataset generation script (`generateDataset.js`). This script creates over 104,000 dummy queries using a mathematical Zipf distribution. This means rank 1 queries (like "iphone 15") get simulated as having 1 million searches, and rank 100k queries have maybe 10 searches. It takes about 10-15 seconds to generate all this data and build the in-memory Trie.

### 2. Start the Frontend App

In a second terminal window, run:
```bash
cd frontend
npm install
npm run dev
```
Then just open `http://localhost:5173` in your web browser. 

---

## Project Structure

Here is a quick overview of how I organized the code:

```
TypeAhead_Project/
├── backend/
│   ├── src/
│   │   ├── index.js              // Main Express server and startup logic
│   │   ├── trie.js               // The Trie data structure for O(L) lookups
│   │   ├── batchWriter.js        // Buffers db writes to save load
│   │   ├── trending.js           // Calculates exponential decay scores
│   │   ├── db/database.js        // My custom JSON-backed DataStore
│   │   ├── cache/
│   │   │   ├── consistentHash.js // MD5 ring with 50 virtual nodes
│   │   │   └── cacheCluster.js   // Simulates 3 cache nodes with LRU/TTL
│   │   └── routes/               // Express API endpoints
│   │       ├── suggest.js        
│   │       ├── search.js         
│   │       ├── cacheDebug.js     
│   │       ├── trendingRoute.js  
│   │       └── stats.js          
│   ├── scripts/
│   │   ├── generateDataset.js    // Generates the 100k+ Zipf distribution queries
│   │   └── seed.js               // Bulk inserts the data
│   └── data/                     // Where queries.json gets saved
├── frontend/
│   ├── src/
│   │   ├── App.jsx               // Main React layout
│   │   ├── api.js                // Fetch calls to backend
│   │   └── components/
│   │       ├── SearchBox.jsx     // The main input with 200ms debounce
│   │       ├── TrendingPanel.jsx // Shows live trending searches
│   │       ├── CacheDebugPanel.jsx // Shows which node handled the prefix
│   │       └── StatsPanel.jsx    // Live performance metrics dashboard
```

---

## Deep Dive into the Architecture & Features

I tried to follow all the assignment requirements closely and make sure the system could handle scale. Here is how I implemented the main parts:

### 1. The Trie Index (For ultra-fast prefix searches)
I implemented an in-memory Trie data structure. Instead of running a SQL `LIKE 'prefix%'` query against the database (which requires full table scans and is super slow), the backend loads all the queries into the Trie on startup. 
To make it even faster, I optimized it so that *every single node* in the Trie stores an array of its top 10 suggestions. This means when a user types "ip", the server just travels to the "p" node under "i" and immediately returns the pre-sorted top 10 list. It doesn't have to search all the child nodes below it! The lookups are basically `O(L)` where L is the length of what the user typed.

### 2. Distributed Cache with Consistent Hashing
To simulate a distributed caching layer (like running multiple Redis instances), I created a `CacheCluster` with 3 logical nodes running in memory (`node-0`, `node-1`, `node-2`). 
To decide which node stores the cached suggestions for a specific prefix, I implemented **Consistent Hashing** using an MD5 hash ring. 
If we just used normal hashing (`hash % N`), adding a new server would force almost all the keys to remap to different servers, causing a massive cache miss spike. Consistent hashing fixes this.
I also used 50 "virtual nodes" per physical node so the hash ring is perfectly balanced. Each cache node has an LRU (Least Recently Used) eviction policy and a 60-second TTL so the data doesn't get stale.

### 3. Trending Searches (Time-Decay Scoring)
The assignment asked for a trending searches feature that doesn't just rank queries by their all-time popularity. I implemented an exponential decay formula for the scoring:
`score = count * e^(-0.1 * hours_since_last_search)`
This means if a query was super viral a week ago but nobody is searching for it today, its score will drop massively. But a query that is getting searched right now keeps its full weight. This stops old viral searches from staying at the top forever. I even have a background job that recomputes these scores every 5 minutes.

### 4. Batching Database Writes
If a thousand users search for "iphone 15" at the exact same time, we absolutely shouldn't send 1,000 separate `UPDATE` queries to the database. That would crash it under load. 
Instead, my `POST /search` route just pushes the incoming query into an in-memory array (a buffer) and immediately returns success to the user so they aren't waiting. 
I wrote a `BatchWriter` class that runs every 5 seconds. It takes everything in the buffer, aggregates all the duplicates (e.g., it realizes "iphone 15" was searched 1,000 times), and then does a single write to the database to add `+1000` to the count. This gives a massive write reduction (which you can actually see working live in the stats panel).

## Why I used a Custom JSON DataStore instead of SQLite

Originally, I planned to use the `better-sqlite3` library for the persistence layer. However, I ran into huge issues compiling the native C++ bindings for it on Node 26 (it seems the V8 engine APIs changed). 
Instead of fighting with `node-gyp` compilation errors and risking the project not running on the grader's machine, I built a custom `DataStore` class. 
It loads the queries into a JavaScript `Map` on startup, handles the upserts in RAM, and asynchronously flushes the changes to a `queries.json` file using debounced writes. 
Functionally, this acts just like a real database for this assignment: the Trie and Cache handle the heavy read loads in memory, while the DataStore handles the disk persistence in the background.

## Frontend UI details

I built the frontend using React and Vite, styling it with plain CSS. I went with a modern "glassmorphism" dark mode aesthetic to make it look premium. 
- **Debouncing:** The search box has a `200ms` debounce so it waits until you stop typing for a split second before hitting the `/suggest` API. This saves unnecessary network calls.
- **Keyboard Navigation:** You can use the up and down arrow keys to navigate the suggestions dropdown, and hit Enter to submit.
- **Live Dashboards:** I added a dashboard at the bottom with three tabs so you can see the Cache Hits, the Trending Searches, and the System Latencies updating in real-time.

## API Endpoints List

If you want to test the backend directly via Postman or Curl, here are the endpoints:
- `GET /suggest?q=<prefix>` : Checks the cache first. If it's a miss, gets the top 10 from the Trie, saves to the cache node, and returns it.
- `POST /search` : Submits a search. Just returns a dummy success message but adds the query to the batch write buffer in the background.
- `GET /trending` : Returns the top queries based on the recency decay score.
- `GET /cache/debug?prefix=<prefix>` : This is a debug route that shows you exactly which of the 3 cache nodes the prefix was routed to by the consistent hash ring.
- `GET /stats` : Returns the p95 latency, cache hit rates, and the batch writer efficiency stats that feed the UI dashboard.

## Future Improvements I'd Make

If I had more time, I would:
1. Add a persistent message queue (like Kafka or RabbitMQ) in front of the BatchWriter so that if the server crashes, we don't lose the searches that were sitting in the 5-second buffer.
2. Implement a proper database like Redis for the cache layer instead of simulating it in-memory.
3. Add spelling correction using Edit Distance algorithms so if a user types "iphnoe", it still suggests "iphone".

Thanks for reading!
