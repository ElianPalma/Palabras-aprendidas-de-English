import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

const App = () => {
  const [words, setWords] = useState([]);
  const [pastedText, setPastedText] = useState('');
  const [extractedWords, setExtractedWords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
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

  const parsePastedText = () => {
    if (!pastedText.trim()) return;
    
    const lines = pastedText.trim().split('\n');
    const newExtractedWords = [];

    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('español') || !line.trim()) return;

      let parts = [];
      if (line.includes('\t')) parts = line.split('\t');
      else if (line.includes(' - ')) parts = line.split(' - ');
      else if (line.includes('|')) parts = line.split('|');

      parts = parts.map(p => p.trim());

      if (parts.length >= 2) {
        let grammar_type = '';
        let mnemonic = '';

        if (parts.length >= 5) {
          grammar_type = parts[3] || '';
          mnemonic = parts[4] || '';
        } else if (parts.length === 4) {
          mnemonic = parts[3] || ''; 
        }

        newExtractedWords.push({
          id: Date.now() + index, 
          spanish: parts[0] || '',
          english: parts[1] || '',
          pronunciation: parts[2] || '',
          grammar_type: grammar_type,
          mnemonic: mnemonic
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
      const { data, error } = await supabase
        .from('vocabulario')
        .insert(wordsToInsert)
        .select();

      if (error) throw error;

      if (data) {
        setWords([...words, ...data]);
      }
      
      setExtractedWords([]);
      setPastedText('');
    } catch (error) {
      console.error("Error guardando palabras:", error.message);
      alert("Hubo un error al guardar en la nube. Revisa la consola.");
    }
  };

  const getActiveMilestone = () => {
    const count = words.length;
    if (count < 1200) return 1200;
    if (count < 3000) return 3000;
    return 5000;
  };

  const playAudio = (text, rate = 1.0) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = rate;
      window.speechSynthesis.speak(utterance);
    } else {
      console.error("La síntesis de voz no está soportada en este navegador.");
    }
  };

  const categories = ['All', ...new Set(words.map(w => w.grammar_type).filter(Boolean))];

  const filteredWords = words.filter(w => {
    const matchesSearch = w.english.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          w.spanish.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'All' || w.grammar_type === filterType;
    return matchesSearch && matchesFilter;
  });

  const currentMilestone = getActiveMilestone();
  const progressPercent = Math.min((words.length / currentMilestone) * 100, 100);

  return (
    <div className="min-h-screen bg-black text-slate-200 p-4 md:p-6 lg:p-8 font-sans selection:bg-cyan-500/30">
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6">
        
        <div className="flex-1 flex flex-col gap-6">
          <header className="bg-slate-900/40 p-5 rounded-2xl border border-cyan-500/20 flex flex-col xl:flex-row gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-black text-cyan-400 mb-3 tracking-tighter flex items-center gap-2">
                DATA ANALYZER // <span className="text-slate-500 font-medium">Cloud Database</span>
                {loading && <span className="text-xs ml-2 text-cyan-600 animate-pulse">Cargando datos...</span>}
              </h1>
              <textarea
                className="w-full h-24 p-3 bg-slate-950 border border-slate-800 rounded-xl text-cyan-50 font-mono text-sm outline-none focus:border-cyan-500 transition resize-none"
                placeholder="Pega el bloque de Gemini aquí (ahora con 5 columnas)..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
            </div>
            <div className="xl:w-48 flex items-end">
              <button 
                onClick={parsePastedText}
                disabled={loading}
                className="w-full h-12 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold transition shadow-lg shadow-cyan-900/20 text-sm tracking-wide"
              >
                PROCESAR
              </button>
            </div>
          </header>

          {extractedWords.length > 0 && (
            <div className="bg-slate-900 p-5 rounded-2xl border border-purple-500/40">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-purple-400 font-bold text-sm">DETECTADAS: {extractedWords.length}</h2>
                <button onClick={saveExtractedWords} className="bg-purple-600 px-4 py-1.5 rounded-lg text-sm font-black text-white hover:bg-purple-500 transition">
                  CONFIRMAR CARGA A NUBE
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {extractedWords.map(w => (
                  <div key={w.id} className="text-xs flex gap-2 text-slate-400 border-b border-slate-800/50 pb-1">
                    <span className="text-cyan-400 font-bold w-24 truncate">{w.english}</span> 
                    <span className="truncate">{w.spanish}</span>
                    {w.grammar_type && <span className="text-blue-400 italic">({w.grammar_type})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-900/20 border border-slate-800/50 rounded-2xl p-5 flex-1 flex flex-col">
            <div className="flex flex-col gap-4 mb-5">
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

              <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
                <div key={w.id} className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 flex flex-col gap-3 group hover:border-cyan-500/40 transition hover:bg-slate-800/80">
                  
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-slate-500 flex items-center justify-center group-hover:text-cyan-500 transition-colors">
                        {w.order_num}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-xl font-bold text-white leading-none">{w.english}</h3>
                          {w.grammar_type && (
                            <span className="bg-blue-900/40 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">
                              {w.grammar_type}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-400 leading-tight mt-0.5">{w.spanish}</p>
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2">
                      {w.pronunciation && (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-950/40 border border-cyan-800/50 text-cyan-400 font-mono text-sm uppercase font-bold">
                          <span className="text-cyan-500 opacity-70 text-xs">▶</span> {w.pronunciation}
                        </span>
                      )}
                      
                      <div className="flex items-center bg-cyan-900/30 rounded-md border border-cyan-800/50 overflow-hidden">
                        <button
                          onClick={() => playAudio(w.english, 1.0)}
                          className="px-2.5 py-1.5 hover:bg-cyan-700/50 text-cyan-400 transition-colors cursor-pointer border-r border-cyan-800/50 text-xs font-bold flex items-center gap-1"
                          title="Velocidad normal"
                        >
                          🔊 <span className="hidden sm:inline">1x</span>
                        </button>
                        <button
                          onClick={() => playAudio(w.english, 0.6)}
                          className="px-2.5 py-1.5 hover:bg-cyan-700/50 text-cyan-400 transition-colors cursor-pointer border-r border-cyan-800/50 text-xs font-bold"
                          title="Lento"
                        >
                          0.6x
                        </button>
                        <button
                          onClick={() => playAudio(w.english, 0.3)}
                          className="px-2.5 py-1.5 hover:bg-cyan-700/50 text-cyan-400 transition-colors cursor-pointer text-xs font-bold"
                          title="Muy lento"
                        >
                          0.3x
                        </button>
                      </div>

                    </div>
                  </div>

                  {w.mnemonic && (
                    <div className="bg-slate-950/60 p-2.5 rounded-lg border border-purple-900/20 ml-11">
                      <p className="text-purple-300/90 text-xs flex gap-2 items-start leading-relaxed">
                        <span className="text-purple-500/80 mt-0.5 text-[10px]">💡</span>
                        <span>{w.mnemonic}</span>
                      </p>
                    </div>
                  )}
                </div>
              ))}
              
              {!loading && filteredWords.length === 0 && words.length > 0 && (
                <div className="col-span-full text-center py-10 text-slate-500 text-sm">
                  No se encontraron palabras.
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="w-full lg:w-72 flex-shrink-0">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 sticky top-6 shadow-2xl">
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
                  <div 
                    className="h-full bg-cyan-500 shadow-[0_0_10px_#22d3ee] transition-all duration-1000" 
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-3">
                {[1200, 3000, 5000].map(m => (
                  <div key={m} className={`flex justify-between items-center text-xs font-bold p-2.5 rounded-lg border ${words.length >= m ? 'text-cyan-300 bg-cyan-900/20 border-cyan-800/30' : 'text-slate-600 border-transparent'}`}>
                    <span>MILESTONE {m}</span>
                    <span>{words.length >= m ? 'OK' : 'LOCKED'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
};

export default App;
