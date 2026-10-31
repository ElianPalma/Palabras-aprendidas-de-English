import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

const PERSONS = [
  { key: 'yo', es: 'Yo', en: 'I', pron: 'ai' },
  { key: 'el', es: 'Él / Ella', en: 'He / She', pron: 'ji / shi' },
  { key: 'nosotros', es: 'Nosotros', en: 'We', pron: 'uí' },
  { key: 'ellos', es: 'Ellos / Ellas', en: 'They', pron: 'dei' },
];

const TENSES = [
  { key: 'past', label: 'Pasado' },
  { key: 'present', label: 'Presente' },
  { key: 'future', label: 'Futuro' },
];

// Genera los 4 ítems (una por persona) de un tiempo verbal a partir del JSON `forms`.
// Si forms.notes_items[tiempo][persona] existe, esa nota tiene prioridad sobre la nota general del tiempo.
const buildItems = (forms, tense) =>
  PERSONS.map((p, i) => {
    let en, pron;
    if (tense === 'present') {
      const k = p.key === 'el' ? 'third' : 'base';
      en = forms.en[k];
      pron = forms.pron[k];
    } else if (tense === 'past') {
      en = forms.en.past;
      pron = forms.pron.past;
    } else {
      en = `will ${forms.en.base}`;
      pron = `uíl ${forms.pron.base}`;
    }
    return {
      key: p.key,
      es: `${p.es} ${forms.es[tense][i]}`,
      en: `${p.en} ${en}`,
      speak: `${p.en.split(' / ')[0]} ${en}`,
      pron: `${p.pron} ${pron}`,
      note: forms.notes_items?.[tense]?.[p.key] || forms.notes?.[tense] || '',
    };
  });

const speak = (text, rate = 1.0) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  window.speechSynthesis.speak(u);
};

const Verbos = ({ onBack }) => {
  const [verbs, setVerbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('verbos')
          .select('*')
          .order('order_num', { ascending: true });
        if (err) throw err;
        setVerbs(data || []);
      } catch (e) {
        console.error('Error cargando verbos:', e.message);
        setError('No se pudo cargar la tabla "verbos". ¿Ya ejecutaste el SQL en Supabase?');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const term = searchTerm.toLowerCase();
  const filtered = verbs.filter(
    (v) => v.english.toLowerCase().includes(term) || v.spanish.toLowerCase().includes(term)
  );

  return (
    <div className="min-h-screen bg-black text-slate-200 p-4 md:p-6 lg:p-8 font-sans selection:bg-cyan-500/30">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
        <header className="bg-slate-900/40 p-5 rounded-2xl border border-cyan-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-xl font-black text-cyan-400 tracking-tighter flex items-center gap-2">
            VERBOS // <span className="text-slate-500 font-medium">Conjugación</span>
            {loading && <span className="text-xs ml-2 text-cyan-600 animate-pulse">Cargando...</span>}
          </h1>
          <button
            onClick={onBack}
            className="border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-400 px-5 py-2.5 rounded-xl font-bold text-sm transition"
          >
            ← Vocabulario
          </button>
        </header>

        <div className="bg-slate-900/20 border border-slate-800/50 rounded-2xl p-5">
          <div className="relative w-full sm:w-64 mb-5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Buscar verbo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-200 outline-none focus:border-cyan-500 transition"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs font-bold bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                className="text-left bg-slate-900/80 p-4 rounded-xl border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800/80 transition"
              >
                <h3 className="text-xl font-bold text-white leading-none">{v.english}</h3>
                <p className="text-sm font-medium text-slate-400 mt-1.5">{v.spanish}</p>
              </button>
            ))}
          </div>

          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm">No se encontraron verbos.</div>
          )}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/95 overflow-y-auto" onClick={() => setSelected(null)}>
          <div className="max-w-[1600px] mx-auto p-4 md:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">{selected.english}</h2>
                  {selected.pronunciation && (
                    <span className="px-3 py-1 rounded-md bg-cyan-950/40 border border-cyan-800/50 text-cyan-400 font-mono text-sm uppercase font-bold">
                      {selected.pronunciation}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 font-medium mt-1">{selected.spanish}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="flex-shrink-0 border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-400 px-4 py-2 rounded-xl font-bold text-sm transition"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {TENSES.map((t) => (
                <section key={t.key} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
                  <h3 className="text-cyan-400 font-black text-xs tracking-widest uppercase">{t.label}</h3>
                  {buildItems(selected.forms, t.key).map((it) => (
                    <div key={it.key} className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5">
                      <p className="text-slate-300 text-sm font-medium">{it.es}</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-white text-lg font-bold leading-tight">{it.en}</p>
                        <button
                          onClick={() => speak(it.speak)}
                          className="flex-shrink-0 px-2.5 py-1 rounded-md bg-cyan-900/30 border border-cyan-800/50 text-cyan-400 hover:bg-cyan-700/50 text-xs font-bold transition"
                          title="Escuchar"
                        >
                          🔊
                        </button>
                      </div>
                      <p className="text-cyan-400 font-mono text-sm uppercase font-bold">▶ {it.pron}</p>
                      {it.note && (
                        <p className="text-purple-300/90 text-xs leading-relaxed bg-slate-950/60 border border-purple-900/20 rounded-lg px-2.5 py-2">
                          💡 {it.note}
                        </p>
                      )}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Verbos;
