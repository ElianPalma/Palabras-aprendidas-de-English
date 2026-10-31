import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

// Categorías generales para simplificar los filtros (Requerimiento 3).
// Cualquier valor guardado en grammar_type se agrupa en una de estas categorías
// para efectos de filtrado, sin necesidad de reescribir los datos existentes.
const GRAMMAR_CATEGORIES = [
  'Sustantivo',
  'Adjetivo',
  'Verbo',
  'Adverbio',
  'Preposición',
  'Pronombre',
  'Conjunción',
  'Interjección',
  'Artículo',
  'Otro'
];

const normalizeGrammarType = (type) => {
  if (!type || !type.trim()) return 'Otro';
  const t = type.trim().toLowerCase();
  if (t.includes('sustantivo') || t.includes('nombre')) return 'Sustantivo';
  if (t.includes('adjetivo')) return 'Adjetivo';
  if (t.includes('verbo')) return 'Verbo';
  if (t.includes('adverbio')) return 'Adverbio';
  if (t.includes('preposici')) return 'Preposición';
  if (t.includes('pronombre')) return 'Pronombre';
  if (t.includes('conjunci')) return 'Conjunción';
  if (t.includes('interjecci')) return 'Interjección';
  if (t.includes('articulo') || t.includes('artículo')) return 'Artículo';
  return 'Otro';
};

const emptyFormData = { english: '', grammar_type: '', spanish: '', pronunciation: '', mnemonic: '' };

const App = () => {
  const [words, setWords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [loading, setLoading] = useState(true);

  // Estado del formulario manual de creación/edición (Requerimiento 1)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create'); // 'create' | 'edit'
  const [editingWord, setEditingWord] = useState(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  // Prevención de duplicados (Requerimiento 2): comparación case-insensitive
  // e ignorando espacios, contra la palabra en inglés.
  const isDuplicateEnglish = (value, excludeId = null) => {
    const normalized = value.trim().toLowerCase();
    return words.some(w => w.english.trim().toLowerCase() === normalized && w.id !== excludeId);
  };

  const openCreateForm = () => {
    setFormMode('create');
    setFormData(emptyFormData);
    setFormError('');
    setEditingWord(null);
    setIsFormOpen(true);
  };

  const openEditForm = (word) => {
    setFormMode('edit');
    setFormData({
      english: word.english || '',
      grammar_type: word.grammar_type || '',
      spanish: word.spanish || '',
      pronunciation: word.pronunciation || '',
      mnemonic: word.mnemonic || ''
    });
    setFormError('');
    setEditingWord(word);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setFormError('');
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const englishTrimmed = formData.english.trim();
    const spanishTrimmed = formData.spanish.trim();
    const grammarTrimmed = formData.grammar_type.trim();
    const pronunciationTrimmed = formData.pronunciation.trim();
    const mnemonicTrimmed = formData.mnemonic.trim();

    if (!englishTrimmed || !spanishTrimmed || !grammarTrimmed) {
      setFormError('Palabra en inglés, tipo gramatical y traducción son obligatorios.');
      return;
    }

    const excludeId = formMode === 'edit' && editingWord ? editingWord.id : null;
    if (isDuplicateEnglish(englishTrimmed, excludeId)) {
      setFormError(`"${englishTrimmed}" ya existe en la base de datos.`);
      return;
    }

    setIsSaving(true);
    try {
      if (formMode === 'create') {
        const nextOrder = words.length > 0
          ? Math.max(...words.map(w => w.order_num || 0)) + 1
          : 1;

        const { data, error } = await supabase
          .from('vocabulario')
          .insert([{
            english: englishTrimmed,
            grammar_type: grammarTrimmed,
            spanish: spanishTrimmed,
            pronunciation: pronunciationTrimmed,
            mnemonic: mnemonicTrimmed,
            order_num: nextOrder
          }])
          .select();

        if (error) throw error;
        if (data) setWords(prev => [...prev, ...data]);
      } else {
        const { data, error } = await supabase
          .from('vocabulario')
          .update({
            english: englishTrimmed,
            grammar_type: grammarTrimmed,
            spanish: spanishTrimmed,
            pronunciation: pronunciationTrimmed,
            mnemonic: mnemonicTrimmed
          })
          .eq('id', editingWord.id)
          .select();

        if (error) throw error;
        if (data && data[0]) {
          setWords(prev => prev.map(w => (w.id === editingWord.id ? data[0] : w)));
        }
      }
      setIsFormOpen(false);
    } catch (error) {
      console.error('Error guardando la palabra:', error.message);
      setFormError('Hubo un error al guardar en la nube. Revisa la consola.');
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminación manual (Requerimiento 2)
  const handleDelete = async (word) => {
    const confirmed = window.confirm(`¿Eliminar "${word.english}" (${word.spanish})? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('vocabulario')
        .delete()
        .eq('id', word.id);

      if (error) throw error;
      setWords(prev => prev.filter(w => w.id !== word.id));
    } catch (error) {
      console.error('Error eliminando la palabra:', error.message);
      alert('Hubo un error al eliminar. Revisa la consola.');
    }
  };

  const getActiveMilestone = () => {
    const count = words.length;
    if (count < 1200) return 1200;
    if (count < 3000) return 3000;
    return 5000;
  };

  // Audio (Requerimiento 4): sin cambios respecto al original.
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

  // Filtros simplificados (Requerimiento 3): solo se muestran las categorías
  // generales que realmente tienen palabras asociadas.
  const categories = ['All', ...GRAMMAR_CATEGORIES.filter(cat =>
    words.some(w => normalizeGrammarType(w.grammar_type) === cat)
  )];

  const filteredWords = words.filter(w => {
    const matchesSearch = w.english.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          w.spanish.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'All' || normalizeGrammarType(w.grammar_type) === filterType;
    return matchesSearch && matchesFilter;
  });

  const currentMilestone = getActiveMilestone();
  const progressPercent = Math.min((words.length / currentMilestone) * 100, 100);

  return (
    <div className="min-h-screen bg-black text-slate-200 p-4 md:p-6 lg:p-8 font-sans selection:bg-cyan-500/30">
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6">

        <div className="flex-1 flex flex-col gap-6">
          <header className="bg-slate-900/40 p-5 rounded-2xl border border-cyan-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-xl font-black text-cyan-400 tracking-tighter flex items-center gap-2">
              DATA ANALYZER // <span className="text-slate-500 font-medium">Cloud Database</span>
              {loading && <span className="text-xs ml-2 text-cyan-600 animate-pulse">Cargando datos...</span>}
            </h1>
            <button
              onClick={openCreateForm}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-cyan-900/20 transition"
            >
              + Nueva Palabra
            </button>
          </header>

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

                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                      {w.pronunciation && (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-950/40 border border-cyan-800/50 text-cyan-400 font-mono text-sm uppercase font-bold">
                          <span className="text-cyan-500 opacity-70 text-xs">▶</span> {w.pronunciation}
                        </span>
                      )}

                      <div className="flex items-center bg-cyan-900/30 rounded-md border border-cyan-800/50 overflow-hidden mt-1">
                        <button
                          onClick={() => playAudio(w.english, 1.0)}
                          className="px-3 py-1.5 hover:bg-cyan-700/50 text-cyan-400 transition-colors cursor-pointer border-r border-cyan-800/50 text-xs font-bold flex items-center gap-1"
                          title="Velocidad normal"
                        >
                          🔊 Normal
                        </button>
                        <button
                          onClick={() => playAudio(w.english, 0.6)}
                          className="px-3 py-1.5 hover:bg-cyan-700/50 text-cyan-400 transition-colors cursor-pointer border-r border-cyan-800/50 text-xs font-bold"
                          title="Lento"
                        >
                          Lento
                        </button>
                        <button
                          onClick={() => playAudio(w.english, 0.3)}
                          className="px-3 py-1.5 hover:bg-cyan-700/50 text-cyan-400 transition-colors cursor-pointer text-xs font-bold"
                          title="Muy lento"
                        >
                          Muy Lento
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => openEditForm(w)}
                          className="px-2.5 py-1 rounded-md border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-600 text-[10px] font-bold uppercase tracking-wide transition-colors"
                          title="Editar palabra"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleDelete(w)}
                          className="px-2.5 py-1 rounded-md border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-600 text-[10px] font-bold uppercase tracking-wide transition-colors"
                          title="Eliminar palabra"
                        >
                          🗑️ Eliminar
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

              {!loading && words.length === 0 && (
                <div className="col-span-full text-center py-10 text-slate-500 text-sm">
                  Todavía no hay palabras. Usa "+ Nueva Palabra" para agregar la primera.
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

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={closeForm}>
          <div
            className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-cyan-400 font-black text-lg mb-4 tracking-tight">
              {formMode === 'create' ? 'Nueva Palabra' : 'Editar Palabra'}
            </h2>

            <form onSubmit={handleFormSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Palabra en inglés
                </label>
                <input
                  type="text"
                  value={formData.english}
                  onChange={(e) => handleFormChange('english', e.target.value)}
                  placeholder="Designer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Tipo gramatical (manual)
                </label>
                <input
                  type="text"
                  list="grammar-type-suggestions"
                  value={formData.grammar_type}
                  onChange={(e) => handleFormChange('grammar_type', e.target.value)}
                  placeholder="Sustantivo"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 transition"
                />
                <datalist id="grammar-type-suggestions">
                  {GRAMMAR_CATEGORIES.map(cat => <option key={cat} value={cat} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Traducción al español
                </label>
                <input
                  type="text"
                  value={formData.spanish}
                  onChange={(e) => handleFormChange('spanish', e.target.value)}
                  placeholder="Diseñador"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Pronunciación (manual, sin automatización)
                </label>
                <input
                  type="text"
                  value={formData.pronunciation}
                  onChange={(e) => handleFormChange('pronunciation', e.target.value)}
                  placeholder="Disainerr"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Recordatorio / mnemotecnia
                </label>
                <textarea
                  value={formData.mnemonic}
                  onChange={(e) => handleFormChange('mnemonic', e.target.value)}
                  placeholder="Como un Diseño con motor err"
                  className="w-full h-20 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 transition resize-none"
                />
              </div>

              {formError && (
                <p className="text-red-400 text-xs font-bold bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm hover:border-slate-500 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition disabled:bg-slate-800 disabled:text-slate-500"
                >
                  {isSaving ? 'Guardando...' : (formMode === 'create' ? 'Guardar' : 'Actualizar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
