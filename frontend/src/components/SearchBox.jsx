import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSuggestions, submitSearch } from '../api.js';
import { enrichSuggestion } from '../utils/mockData.js';

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function formatCount(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return n.toLocaleString();
}

function highlightPrefix(text, prefix) {
  if (!prefix || !text.toLowerCase().startsWith(prefix.toLowerCase())) {
    return <span className="text-gray-300">{text}</span>;
  }
  return (
    <>
      <span className="text-white font-bold">{text.slice(0, prefix.length)}</span>
      <span className="text-gray-400">{text.slice(prefix.length)}</span>
    </>
  );
}

export default function SearchBox({ onSelectResult }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [open, setOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchSuggestions = useCallback(
    debounce(async (prefix) => {
      if (!prefix.trim()) {
        setSuggestions([]);
        setOpen(false);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getSuggestions(prefix);
        const enriched = (data.suggestions || []).map(enrichSuggestion);
        setSuggestions(enriched);
        setOpen(true);
      } catch (e) {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 200),
    []
  );

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIdx(-1);
    fetchSuggestions(val);
  };

  const handleSubmit = async (selectedItem = null) => {
    const item = selectedItem || (activeIdx >= 0 ? suggestions[activeIdx] : null);
    if (!item && !query.trim()) return;
    
    const finalItem = item || enrichSuggestion({ query: query, count: 0 });
    
    setOpen(false);
    setQuery(finalItem.query);
    inputRef.current?.blur();
    
    // Fire off the API call to update the backend count
    try {
      await submitSearch(finalItem.query);
      // Increment the count locally so the UI updates immediately
      finalItem.count += 1;
    } catch (e) {
      console.error("Failed to submit search to backend", e);
    }
    
    if (onSelectResult) onSelectResult(finalItem);
  };

  const handleKeyDown = (e) => {
    if (!open || !suggestions.length) {
      if (e.key === 'Enter') handleSubmit();
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        handleSubmit();
        break;
      case 'Escape':
        setOpen(false);
        setActiveIdx(-1);
        break;
      default:
        break;
    }
  };

  // Scroll active item
  useEffect(() => {
    if (activeIdx >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll('.suggestion-row');
      items[activeIdx]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIdx]);

  // Click outside
  useEffect(() => {
    const handler = (e) => {
      if (!inputRef.current?.parentElement?.parentElement?.contains(e.target)) {
        setOpen(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getRankBadge = (idx) => {
    if (idx === 0) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (idx === 1) return 'bg-slate-300/20 text-slate-300 border-slate-300/30';
    if (idx === 2) return 'bg-amber-700/20 text-amber-500 border-amber-700/30';
    return 'bg-surfaceBorder text-gray-400 border-transparent';
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto z-50">
      <motion.div 
        className={`relative flex items-center bg-surface/80 backdrop-blur-xl border rounded-2xl px-6 py-4 transition-all duration-300 ${
          isFocused || open ? 'border-primary shadow-glow bg-surface/95' : 'border-surfaceBorder shadow-glass'
        }`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {loading ? (
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-4 flex-shrink-0" />
        ) : (
          <Search className={`w-6 h-6 mr-4 flex-shrink-0 transition-colors ${isFocused ? 'text-primary' : 'text-gray-400'}`} />
        )}
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            if (suggestions.length) setOpen(true);
          }}
          placeholder="Search anything..."
          className="flex-1 bg-transparent border-none outline-none text-xl text-white placeholder:text-gray-500"
          autoFocus
        />

        {query && (
          <button 
            onClick={() => { setQuery(''); setSuggestions([]); setOpen(false); inputRef.current?.focus(); }}
            className="p-2 text-gray-400 hover:text-white bg-surfaceBorder/50 hover:bg-surfaceBorder rounded-full transition-all ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </motion.div>

      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.div
            key="suggestions-dropdown"
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute top-[calc(100%+12px)] left-0 right-0 glass-dropdown rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto"
          >
            {suggestions.map((s, i) => {
              const isActive = i === activeIdx;
              const isPositive = s.dailyGrowth >= 0;
              
              return (
                <div
                  key={s.query}
                  className={`suggestion-row flex items-center justify-between p-4 cursor-pointer border-b border-white/5 transition-colors duration-150 ${
                    isActive ? 'bg-primary/10' : 'hover:bg-white/5'
                  }`}
                  onMouseDown={(e) => { e.preventDefault(); handleSubmit(s); }}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${getRankBadge(i)}`}>
                      #{i + 1}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="text-lg truncate">
                        {highlightPrefix(s.query, query)}
                      </div>
                      <div className="flex items-center gap-3 text-sm mt-1">
                        <span className="text-gray-400 font-mono">{formatCount(s.count)} Searches</span>
                        <span className={`flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isPositive ? '+' : ''}{s.dailyGrowth}% today
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-gray-300">
                      {s.category}
                    </span>
                    <ChevronRight className={`w-5 h-5 transition-all ${isActive ? 'text-primary translate-x-1' : 'text-gray-600'}`} />
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Empty State */}
      <AnimatePresence>
        {open && query && suggestions.length === 0 && !loading && (
          <motion.div
            key="empty-state"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-[calc(100%+12px)] left-0 right-0 glass-dropdown rounded-2xl p-8 text-center"
          >
            <div className="w-16 h-16 bg-surfaceBorder rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No matching searches found</h3>
            <p className="text-gray-400 text-sm">Try adjusting your terms or browse the trending searches below.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
