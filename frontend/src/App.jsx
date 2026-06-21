import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Users, Activity, BarChart2, ArrowLeft } from 'lucide-react';
import SearchBox from './components/SearchBox.jsx';
import CountUp from './components/CountUp.jsx';
import TrendChart from './components/TrendChart.jsx';
import { getTrending } from './api.js';
import { generateChartData, generateRelatedSearches } from './utils/mockData.js';

export default function App() {
  const [selectedResult, setSelectedResult] = useState(null);
  const [trending, setTrending] = useState([]);
  
  // Analytics State
  const [chartData, setChartData] = useState([]);
  const [related, setRelated] = useState([]);

  useEffect(() => {
    // Fetch initial trending data for the grid
    getTrending(8).then(data => {
      setTrending(data?.trending || []);
    }).catch(console.error);
  }, []);

  const handleSelectResult = (result) => {
    setSelectedResult(result);
    setChartData(generateChartData(result.query, result.count));
    setRelated(generateRelatedSearches(result.query));
  };

  const clearSelection = () => {
    setSelectedResult(null);
    setChartData([]);
    setRelated([]);
  };

  // Main Layout Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen bg-background text-gray-100 font-sans overflow-x-hidden pb-20">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-panel border-b-0 border-surfaceBorder bg-background/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={clearSelection}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
              <SearchIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">SearchX</span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            <a href="http://localhost:3001/stats" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white transition-colors">
              Developers API
            </a>
            <div className="px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              Systems Operational
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-32 max-w-7xl mx-auto px-6">
        <AnimatePresence mode="wait">
          {!selectedResult ? (
            // ==========================================
            // LANDING PAGE VIEW
            // ==========================================
            <motion.div 
              key="landing"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center"
            >
              <motion.div variants={itemVariants} className="text-center mb-10 mt-10">
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6">
                  Discover What <br/> Everyone Is <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Searching</span>
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto font-medium">
                  Real-time search trends powered by millions of searches.
                </p>
              </motion.div>

              <motion.div variants={itemVariants} className="w-full relative z-40 mb-20">
                <SearchBox onSelectResult={handleSelectResult} />
              </motion.div>

              {/* Stats Banner */}
              <motion.div variants={itemVariants} className="w-full grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
                <StatCard icon={<Activity />} title="Total Searches Today" value={<CountUp end={12500000} suffix="+" />} />
                <StatCard icon={<Users />} title="Active Users" value={<CountUp end={350000} suffix="+" />} />
                <StatCard icon={<TrendingUp />} title="Trending Topics" value={<CountUp end={5000} suffix="+" />} />
                <StatCard icon={<BarChart2 />} title="Avg Searches/Min" value={<CountUp end={8200} />} />
              </motion.div>

              {/* Trending Grid */}
              <motion.div variants={itemVariants} className="w-full">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <TrendingUp className="text-primary w-6 h-6" /> Trending Now
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {trending.map((trend, idx) => (
                    <div 
                      key={trend.query}
                      onClick={() => handleSelectResult(trend)}
                      className="glass-panel rounded-2xl p-6 cursor-pointer hover:border-primary/50 hover:shadow-glow transition-all duration-300 group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-2xl font-bold text-white group-hover:text-primary transition-colors truncate pr-4">
                          {trend.query}
                        </span>
                        <span className="text-sm font-bold text-gray-500 bg-surfaceBorder px-2 py-1 rounded-md">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-gray-400 font-mono text-sm">
                          {(trend.count / 1000).toFixed(1)}K searches
                        </span>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          ) : (
            // ==========================================
            // SEARCH RESULTS VIEW
            // ==========================================
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full"
            >
              <button 
                onClick={clearSelection}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                Back to search
              </button>

              <div className="mb-10 max-w-3xl">
                <SearchBox onSelectResult={handleSelectResult} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Analytics Card */}
                <div className="lg:col-span-1 space-y-8">
                  <div className="glass-panel rounded-3xl p-8">
                    <h2 className="text-sm uppercase tracking-widest text-gray-400 font-bold mb-2">Keyword Overview</h2>
                    <h1 className="text-4xl font-extrabold text-white mb-8 truncate">{selectedResult.query}</h1>
                    
                    <div className="space-y-6">
                      <div>
                        <div className="text-gray-400 text-sm mb-1">Total Volume</div>
                        <div className="text-3xl font-mono text-white">
                          <CountUp end={selectedResult.count} />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-surfaceBorder/30 rounded-xl p-4">
                          <div className="text-gray-400 text-xs uppercase font-bold mb-1">Today</div>
                          <div className={`text-lg font-bold flex items-center gap-1 ${selectedResult.dailyGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {selectedResult.dailyGrowth >= 0 ? <TrendingUp className="w-4 h-4"/> : <TrendingDown className="w-4 h-4"/>}
                            {selectedResult.dailyGrowth >= 0 ? '+' : ''}{selectedResult.dailyGrowth}%
                          </div>
                        </div>
                        <div className="bg-surfaceBorder/30 rounded-xl p-4">
                          <div className="text-gray-400 text-xs uppercase font-bold mb-1">7 Days</div>
                          <div className={`text-lg font-bold flex items-center gap-1 ${selectedResult.weeklyGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {selectedResult.weeklyGrowth >= 0 ? <TrendingUp className="w-4 h-4"/> : <TrendingDown className="w-4 h-4"/>}
                            {selectedResult.weeklyGrowth >= 0 ? '+' : ''}{selectedResult.weeklyGrowth}%
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-surfaceBorder flex items-center justify-between">
                        <span className="text-gray-400">Category</span>
                        <span className="px-3 py-1 bg-white/10 rounded-full text-sm font-medium text-white">
                          {selectedResult.category || 'Technology'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel rounded-3xl p-8">
                    <h2 className="text-sm uppercase tracking-widest text-gray-400 font-bold mb-4">Related Searches</h2>
                    <div className="flex flex-wrap gap-2">
                      {related.map(r => (
                        <button 
                          key={r}
                          onClick={() => handleSelectResult({ query: r, count: Math.floor(selectedResult.count * 0.4) })}
                          className="px-4 py-2 rounded-full bg-surfaceBorder/50 hover:bg-surfaceBorder text-gray-300 hover:text-white transition-colors text-sm font-medium"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Chart */}
                <div className="lg:col-span-2">
                  <div className="glass-panel rounded-3xl p-8 h-full min-h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h2 className="text-xl font-bold text-white">Search Trend Analysis</h2>
                        <p className="text-gray-400 text-sm mt-1">Historical volume over the last 7 days</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 rounded-md bg-primary text-white text-xs font-bold">7D</button>
                        <button className="px-3 py-1 rounded-md bg-surfaceBorder/50 text-gray-400 hover:text-white text-xs font-bold">1M</button>
                        <button className="px-3 py-1 rounded-md bg-surfaceBorder/50 text-gray-400 hover:text-white text-xs font-bold">1Y</button>
                      </div>
                    </div>
                    
                    <div className="flex-1 w-full">
                      <TrendChart data={chartData} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Subcomponents
function StatCard({ icon, title, value }) {
  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
      <div className="w-10 h-10 rounded-full bg-surfaceBorder flex items-center justify-center text-primary">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-white font-mono">{value}</div>
        <div className="text-sm font-medium text-gray-400 mt-1">{title}</div>
      </div>
    </div>
  );
}

function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...props}>
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
  );
}
