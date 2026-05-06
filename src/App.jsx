import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

const App = () => {
  const [words, setWords] = useState([]);
  const [pastedText, setPastedText] = useState('');
  const [extractedWords, setExtractedWords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All'); // Estado para el filtro
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWords();
  }, []);

  const fetchWords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vocabulario')
        .select('*')
        .order('order_num', { ascending: true });

      if (error) throw error;
      if (data) setWords(data);
    } catch (error) {
      console.error("Error cargando palabras:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Extraer tipos únicos para los botones de filtro automáticamente
  const categories = ['All', ...new Set(words.map(w => w.grammar_type).filter(Boolean))];

  const parsePastedText = () => {
    if (!pastedText.trim()) return;
    const lines = pastedText.trim().split('\n');
    const newExtractedWords = [];

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('español') || !line.trim()) return;
      let parts = line.includes('\t') ? line.split('\t') : 
                  line.includes(' - ') ? line.split(' - ') : 
                  line.split('|');
      parts = parts.map(p => p.trim());

      if (parts.length >= 2) {
        newExtractedWords.push({
          id: Date.now() + index,
          spanish: parts[0] || '',
          english: parts[1] || '',
          pronunciation: parts[2] || '',
          grammar_type: parts.length >= 5 ? parts[3] : '',
          mnemonic: parts.length >= 5 ? parts[4] : (parts.length === 4 ? parts[3] : '')
        });
      }
    });
    setExtractedWords(newExtractedWords);
  };

  const saveExtractedWords = async () => {
    const currentEnglishWords = new Set(words.map(w => w.english.toLowerCase()));
    const filtered = extractedWords.filter(w => !currentEnglishWords.has(w.english.toLowerCase()));
    
    if (filtered.length === 0) {
      setExtractedWords([]);
      setPastedText('');
      return;
    }

    const startCount = words.length + 1;
    const wordsToInsert = filtered.map((w, index) => ({
      spanish: w.spanish,
      english: w.english,
      pronunciation: w.pronunciation,
      grammar_type: w.grammar_type,
      mnemonic: w.mnemonic,
      order_num: startCount + index
    }));

    try {
      const { data, error } = await supabase.from('vocabulario').insert(wordsToInsert).select();
      if (error) throw error;
      if (data) setWords([...words, ...data]);
      setExtractedWords([]);
      setPastedText('');
    } catch (error) {
      console.error("Error:", error.message);
    }
  };

  // Lógica de filtrado combinada (Búsqueda + Categoría)
  const filteredWords = words.filter(w => {
    const matchesSearch = w.english.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          w.spanish.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'All' || w.grammar_type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getActiveMilestone = () => {
    const count = words.length;
    return count < 1200 ? 1200 : count < 3000 ? 3000 : 5000;
  };

  const currentMilestone = getActiveMilestone();
  const progressPercent = Math.min((words.length / currentMilestone) * 100, 100);

  return (
    <div className="min-h-screen bg-black text-slate-200 p-4 md:p-6 lg:p-8 font-sans selection:bg-cyan-500/30">
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6">
        
        <div className="flex-1 flex flex-col gap-6">
          {/* Header & Input */}
          <header className="bg-slate-900/40 p-5 rounded-2xl border border-cyan-500/20 flex flex-col xl:flex-row gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-black text-cyan-400 mb-3 tracking-tighter flex items-center gap-2">
                DATA ANALYZER // <span className="text-slate-500 font-medium">Cloud Database</span>
                {loading && <span className="text-xs ml-2 text-cyan-600 animate-pulse">Cargando...</span>}
              </h1>
              <textarea
                className="w-full h-24 p-3 bg-slate-950 border border-slate-800 rounded-xl text-cyan-50 font-mono text-sm outline-none focus:border-cyan-500 transition resize-none"
                placeholder="Pega el bloque de Gemini aquí..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
            </div>
            <div className="xl:w-48 flex items-end">
              <button onClick={parsePastedText} disabled={loading} className="w-full h-12 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white rounded-xl font-bold transition text-sm">
                PROCESAR
              </button>
            </div>
          </header>

          {/* Listado de palabras y Filtros */}
          <div className="bg-slate-900/20 border border-slate-800/50 rounded-2xl p-5 flex-1 flex flex-col">
            
            {/* Buscador y Controles */}
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-slate-500 font-bold text-xs tracking-widest uppercase">
                  Database Records ({filteredWords.length})
                </h2>
                <div className="relative w-full sm:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Buscar palabra..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-200 outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>

              {/* Filtros de Categoría - Adaptado a Móvil */}
              <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterType(cat)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap ${
                      filterType === cat 
                      ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]' 
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 auto-rows-max">
              {[...filteredWords].reverse().map((w) => (
                <div key={w.id} className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col gap-3 group hover:border-cyan-500/40 transition">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-slate-500 flex items-center justify-center group-hover:text-cyan-500">
                        {w.order_num}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <h3 className="text-xl font-bold text-white leading-none">{w.english}</h3>
                          {w.grammar_type && (
                            <span className="bg-blue-900/40 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">
                              {w.grammar_type}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-400 mt-0.5">{w.spanish}</p>
                      </div>
                    </div>
                    {w.pronunciation && (
                      <span className="px-3 py-1.5 rounded-md bg-cyan-950/40 border border-cyan-800/50 text-cyan-400 font-mono text-sm font-bold">
                        {w.pronunciation}
                      </span>
                    )}
                  </div>
                  {w.mnemonic && (
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-purple-900/20 ml-11">
                      <p className="text-purple-300/90 text-xs flex gap-2 items-start">
                        <span className="text-purple-500/80 mt-0.5">💡</span>
                        <span>{w.mnemonic}</span>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Status */}
        <aside className="w-full lg:w-72 flex-shrink-0">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 sticky top-6">
            <h2 className="text-slate-500 font-black text-xs mb-5 uppercase tracking-widest text-center">System Status</h2>
            <div className="space-y-6">
              <div className="text-center bg-slate-950/50 py-6 rounded-xl border border-slate-800/50">
                <p className="text-6xl font-black text-white tracking-tighter">{words.length}</p>
                <p className="text-cyan-500 font-bold text-[10px] mt-2 uppercase tracking-widest">Words Tracked</p>
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-2">
                  <span>GOAL: {currentMilestone}</span>
                  <span className="text-cyan-400">{Math.round(progressPercent)}%</span>
                </div>
                <div className="h-2 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 shadow-[0_0_10px_#22d3ee] transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
};

export default App;
