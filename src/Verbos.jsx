import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

// Colores e iconos: personas (azul/rosa/amarillo/rojo) y tiempos (ámbar/verde/violeta).
const PERSONS = [
  { key: 'yo', idx: 0, es: 'Yo', en: 'I', pron: 'ai', text: 'text-sky-400', accent: 'border-l-sky-400' },
  { key: 'tu', idx: 4, es: 'Tú', en: 'You', pron: 'iú', text: 'text-orange-400', accent: 'border-l-orange-400' },
  { key: 'el', idx: 1, es: 'Él / Ella', en: 'He / She', pron: 'ji / shi', text: 'text-pink-400', accent: 'border-l-pink-400' },
  { key: 'nosotros', idx: 2, es: 'Nosotros', en: 'We', pron: 'uí', text: 'text-yellow-300', accent: 'border-l-yellow-300' },
  { key: 'ustedes', idx: 5, es: 'Ustedes', en: 'You', pron: 'iú', text: 'text-lime-400', accent: 'border-l-lime-400' },
  { key: 'ellos', idx: 3, es: 'Ellos / Ellas', en: 'They', pron: 'dei', text: 'text-red-400', accent: 'border-l-red-400' },
];

const TENSES = [
  { key: 'past', label: 'Pasado', icon: '⏪', hint: 'Ya ocurrió', text: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' },
  { key: 'present', label: 'Presente', icon: '📍', hint: 'Ocurre ahora', text: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' },
  { key: 'future', label: 'Futuro', icon: '⏩', hint: 'Ocurrirá', text: 'text-violet-400', border: 'border-violet-500/40', bg: 'bg-violet-500/10' },
];

// Cabeza con hombros: relleno = "yo" incluido; contorno = otras personas.
const Head = ({ x, filled }) => (
  <g fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
    <circle cx={x} cy="6" r="3.2" />
    <path d={`M${x - 5.5} 18 a5.5 5.5 0 0 1 11 0`} />
  </g>
);

const HEADS = {
  yo: [[18, true]],
  el: [[18, false]],
  nosotros: [[7, false], [18, true], [29, false]],
  ellos: [[7, false], [18, false], [29, false]],
  tu: [[26, false]],
  ustedes: [[19, false], [30, false]],
};

const PersonIcon = ({ kind, className = '' }) => (
  <svg viewBox="0 0 36 20" className={`w-9 h-5 flex-shrink-0 ${className}`} aria-hidden="true">
    {HEADS[kind].map(([x, filled]) => <Head key={x} x={x} filled={filled} />)}
    {(kind === 'tu' || kind === 'ustedes') && (
      <path d="M3 10 h9 m-3.5 -3.5 l3.5 3.5 l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    )}
  </svg>
);

const buildItems = (forms, tense) =>
  PERSONS.map((p) => {
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
    // forms.items[tiempo][persona] guarda ediciones manuales de un solo ítem (en, pron, note).
    const ov = forms.items?.[tense]?.[p.key] || {};
    const enFull = ov.en ?? `${p.en} ${en}`;
    return {
      person: p,
      tense,
      idx: p.idx,
      esVerb: forms.es[tense][p.idx] ?? (p.key === 'ustedes' ? forms.es[tense][3] : ''),
      en: enFull,
      speak: enFull.replace(' / She', ''),
      pron: ov.pron ?? `${p.pron} ${pron}`,
      note: ov.note ?? (forms.notes_items?.[tense]?.[p.key] || forms.notes?.[tense] || ''),
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

const emptyForms = () => ({
  es: { past: ['', '', '', '', '', ''], present: ['', '', '', '', '', ''], future: ['', '', '', '', '', ''] },
  en: { base: '', third: '', past: '' },
  pron: { base: '', third: '', past: '' },
  notes: { present: '', past: '', future: '' },
});

// Verbos viejos traen 4 formas [yo, él, nosotros, ellos]; se agregan tú (4) y ustedes (5, igual que ellos por defecto).
const normalizeForms = (forms) => {
  const f = JSON.parse(JSON.stringify(forms));
  ['past', 'present', 'future'].forEach((t) => {
    const a = f.es[t];
    if (a[4] === undefined) a[4] = '';
    if (a[5] === undefined) a[5] = a[3];
  });
  return f;
};

const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500 transition';
const labelCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1';

const Verbos = ({ onBack }) => {
  const [verbs, setVerbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(null);

  // Formulario de crear / editar
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // verbo en edición, o null si es nuevo
  const [fd, setFd] = useState({ english: '', spanish: '', pronunciation: '', forms: emptyForms() });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Edición de un solo ítem (una persona en un tiempo)
  const [itemEdit, setItemEdit] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase.from('verbos').select('*').order('order_num', { ascending: true });
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
    if (!selected || formOpen || itemEdit) return;
    const onKey = (e) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, formOpen, itemEdit]);

  const term = searchTerm.toLowerCase();
  const filtered = verbs.filter((v) => v.english.toLowerCase().includes(term) || v.spanish.toLowerCase().includes(term));

  const openForm = (verb = null) => {
    setEditing(verb);
    setFd(verb
      ? { english: verb.english, spanish: verb.spanish, pronunciation: verb.pronunciation || '', forms: normalizeForms(verb.forms) }
      : { english: '', spanish: '', pronunciation: '', forms: emptyForms() });
    setFormError('');
    setFormOpen(true);
  };

  const setTop = (field, value) => setFd((p) => ({ ...p, [field]: value }));
  const setForms = (group, key, value) =>
    setFd((p) => ({ ...p, forms: { ...p.forms, [group]: { ...p.forms[group], [key]: value } } }));
  const setEs = (tense, i, value) =>
    setFd((p) => {
      const arr = [...p.forms.es[tense]];
      arr[i] = value;
      return { ...p, forms: { ...p.forms, es: { ...p.forms.es, [tense]: arr } } };
    });

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    const english = fd.english.trim();
    const spanish = fd.spanish.trim();
    const f = fd.forms;
    const complete =
      english && spanish &&
      ['base', 'third', 'past'].every((k) => f.en[k].trim() && f.pron[k].trim()) &&
      TENSES.every((t) => f.es[t.key].every((s) => s.trim()));
    if (!complete) {
      setFormError('Completa el verbo, su traducción, las formas en inglés, la pronunciación y las 12 formas en español.');
      return;
    }
    const dup = verbs.some((v) => v.english.trim().toLowerCase() === english.toLowerCase() && v.id !== editing?.id);
    if (dup) {
      setFormError(`"${english}" ya existe.`);
      return;
    }
    const payload = { english, spanish, pronunciation: fd.pronunciation.trim(), forms: f };
    setSaving(true);
    try {
      if (editing) {
        const { data, error: err } = await supabase.from('verbos').update(payload).eq('id', editing.id).select();
        if (err) throw err;
        if (!data?.[0]) throw new Error('Sin permiso de edición (revisa las políticas RLS).');
        setVerbs((prev) => prev.map((v) => (v.id === editing.id ? data[0] : v)));
        if (selected?.id === editing.id) setSelected(data[0]);
      } else {
        const order_num = verbs.length ? Math.max(...verbs.map((v) => v.order_num || 0)) + 1 : 1;
        const { data, error: err } = await supabase.from('verbos').insert([{ ...payload, order_num }]).select();
        if (err) throw err;
        if (data) setVerbs((prev) => [...prev, ...data]);
      }
      setFormOpen(false);
    } catch (err) {
      console.error('Error guardando el verbo:', err.message);
      setFormError('No se pudo guardar. Revisa la consola y que hayas ejecutado verbos_permisos.sql.');
    } finally {
      setSaving(false);
    }
  };

  const openItemEdit = (it) =>
    setItemEdit({ tense: it.tense, idx: it.idx, key: it.person.key, label: it.person.es, esVerb: it.esVerb, en: it.en, pron: it.pron, note: it.note, saving: false, error: '' });

  const persistItem = async (forms) => {
    setItemEdit((p) => ({ ...p, saving: true, error: '' }));
    try {
      const { data, error: err } = await supabase.from('verbos').update({ forms }).eq('id', selected.id).select();
      if (err) throw err;
      if (!data?.[0]) throw new Error('Sin permiso de edición (revisa las políticas RLS).');
      setVerbs((prev) => prev.map((v) => (v.id === selected.id ? data[0] : v)));
      setSelected(data[0]);
      setItemEdit(null);
    } catch (err) {
      console.error('Error guardando el ítem:', err.message);
      setItemEdit((p) => ({ ...p, saving: false, error: 'No se pudo guardar. Revisa la consola y que hayas ejecutado verbos_permisos.sql.' }));
    }
  };

  const saveItem = (e) => {
    e.preventDefault();
    const { tense, idx, key } = itemEdit;
    if (!itemEdit.esVerb.trim() || !itemEdit.en.trim() || !itemEdit.pron.trim()) {
      setItemEdit((p) => ({ ...p, error: 'Español, inglés y pronunciación son obligatorios.' }));
      return;
    }
    const forms = normalizeForms(selected.forms);
    forms.es[tense][idx] = itemEdit.esVerb.trim();
    const def = buildItems({ ...forms, items: {} }, tense).find((x) => x.person.key === key);
    const ov = {};
    if (itemEdit.en.trim() !== def.en) ov.en = itemEdit.en.trim();
    if (itemEdit.pron.trim() !== def.pron) ov.pron = itemEdit.pron.trim();
    if (itemEdit.note.trim() !== def.note) ov.note = itemEdit.note.trim();
    forms.items = { ...(forms.items || {}) };
    forms.items[tense] = { ...(forms.items[tense] || {}) };
    if (Object.keys(ov).length) forms.items[tense][key] = ov;
    else delete forms.items[tense][key];
    persistItem(forms);
  };

  const resetItem = () => {
    const { tense, key } = itemEdit;
    const forms = JSON.parse(JSON.stringify(selected.forms));
    if (forms.items?.[tense]) delete forms.items[tense][key];
    persistItem(forms);
  };

  const handleDelete = async (verb) => {
    if (!window.confirm(`¿Eliminar "${verb.english}" (${verb.spanish})? Esta acción no se puede deshacer.`)) return;
    try {
      const { error: err } = await supabase.from('verbos').delete().eq('id', verb.id);
      if (err) throw err;
      setVerbs((prev) => prev.filter((v) => v.id !== verb.id));
      setSelected(null);
    } catch (err) {
      console.error('Error eliminando el verbo:', err.message);
      alert('No se pudo eliminar. Revisa la consola y que hayas ejecutado verbos_permisos.sql.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-200 p-4 md:p-6 lg:p-8 font-sans selection:bg-cyan-500/30">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
        <header className="bg-slate-900/40 p-5 rounded-2xl border border-cyan-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-xl font-black text-cyan-400 tracking-tighter flex items-center gap-2">
            VERBOS // <span className="text-slate-500 font-medium">Conjugación</span>
            {loading && <span className="text-xs ml-2 text-cyan-600 animate-pulse">Cargando...</span>}
          </h1>
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-400 px-5 py-2.5 rounded-xl font-bold text-sm transition">
              ← Vocabulario
            </button>
            <button onClick={() => openForm()} className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-cyan-900/20 transition">
              + Nuevo Verbo
            </button>
          </div>
        </header>

        <div className="bg-slate-900/20 border border-slate-800/50 rounded-2xl p-5">
          <div className="relative w-full sm:w-64 mb-5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
            <input type="text" placeholder="Buscar verbo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-200 outline-none focus:border-cyan-500 transition" />
          </div>

          {error && <p className="text-red-400 text-xs font-bold bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2 mb-4">{error}</p>}

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((v) => (
              <button key={v.id} onClick={() => setSelected(v)} className="text-left bg-slate-900/80 p-4 rounded-xl border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800/80 transition">
                <h3 className="text-xl font-bold text-white leading-none">{v.english}</h3>
                <p className="text-sm font-medium text-slate-400 mt-1.5">{v.spanish}</p>
              </button>
            ))}
          </div>

          {!loading && !error && filtered.length === 0 && <div className="text-center py-10 text-slate-500 text-sm">No se encontraron verbos.</div>}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black overflow-y-auto" onClick={() => setSelected(null)}>
          <div className="max-w-[1600px] mx-auto p-4 md:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">{selected.english}</h2>
                  {selected.pronunciation && (
                    <span className="px-3 py-1 rounded-md bg-cyan-950/40 border border-cyan-800/50 text-cyan-400 font-mono text-sm uppercase font-bold">{selected.pronunciation}</span>
                  )}
                </div>
                <p className="text-slate-400 font-medium mt-1">{selected.spanish}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => openForm(selected)} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-cyan-400 hover:border-cyan-600 font-bold text-sm transition">✏️ Editar</button>
                <button onClick={() => handleDelete(selected)} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-red-400 hover:border-red-600 font-bold text-sm transition">🗑️ Eliminar</button>
                <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-400 font-bold text-sm transition">✕ Cerrar</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {TENSES.map((t) => (
                <section key={t.key} className={`bg-slate-900/60 border ${t.border} rounded-2xl p-4 flex flex-col gap-3`}>
                  <div className={`flex items-center gap-2 ${t.bg} rounded-lg px-3 py-2`}>
                    <span className="text-lg">{t.icon}</span>
                    <h3 className={`${t.text} font-black text-sm tracking-widest uppercase`}>{t.label}</h3>
                    <span className="text-slate-500 text-xs ml-auto">{t.hint}</span>
                  </div>
                  {buildItems(selected.forms, t.key).map((it) => (
                    <div key={it.person.key} className={`bg-slate-950/70 border border-slate-800 border-l-4 ${it.person.accent} rounded-xl p-3 flex flex-col gap-1.5`}>
                      <div className="flex items-center gap-2">
                        <PersonIcon kind={it.person.key} className={it.person.text} />
                        <p className="text-sm font-medium">
                          <span className={`${it.person.text} font-bold`}>{it.person.es}</span>{' '}
                          <span className="text-slate-300">{it.esVerb}</span>
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-white text-lg font-bold leading-tight">{it.en}</p>
                        <div className="flex-shrink-0 flex items-center gap-1.5">
                          <button onClick={() => openItemEdit(it)} className="px-2.5 py-1 rounded-md border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-600 text-xs font-bold transition" title="Editar este ítem">✏️</button>
                          <button onClick={() => speak(it.speak)} className="px-2.5 py-1 rounded-md bg-cyan-900/30 border border-cyan-800/50 text-cyan-400 hover:bg-cyan-700/50 text-xs font-bold transition" title="Escuchar">🔊</button>
                        </div>
                      </div>
                      <p className="text-cyan-400 font-mono text-sm uppercase font-bold">▶ {it.pron}</p>
                      {it.note && <p className="text-purple-300/90 text-xs leading-relaxed bg-slate-950/60 border border-purple-900/20 rounded-lg px-2.5 py-2">💡 {it.note}</p>}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      {itemEdit && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70] overflow-y-auto" onClick={() => !itemEdit.saving && setItemEdit(null)}>
          <form onSubmit={saveItem} onClick={(e) => e.stopPropagation()} className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-3">
            <h2 className="text-cyan-400 font-black text-lg tracking-tight">
              Editar: {itemEdit.label} · {TENSES.find((t) => t.key === itemEdit.tense).label}
            </h2>
            <div>
              <label className={labelCls}>Español (solo el verbo, sin el pronombre)</label>
              <input className={inputCls} value={itemEdit.esVerb} onChange={(e) => setItemEdit({ ...itemEdit, esVerb: e.target.value })} autoFocus />
            </div>
            <div>
              <label className={labelCls}>Inglés (frase completa)</label>
              <input className={inputCls} value={itemEdit.en} onChange={(e) => setItemEdit({ ...itemEdit, en: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Pronunciación (frase completa)</label>
              <input className={`${inputCls} font-mono`} value={itemEdit.pron} onChange={(e) => setItemEdit({ ...itemEdit, pron: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Nota de uso</label>
              <textarea className={`${inputCls} h-24 resize-none`} value={itemEdit.note} onChange={(e) => setItemEdit({ ...itemEdit, note: e.target.value })} />
            </div>
            {itemEdit.error && <p className="text-red-400 text-xs font-bold bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{itemEdit.error}</p>}
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => setItemEdit(null)} disabled={itemEdit.saving} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm hover:border-slate-500 transition disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={resetItem} disabled={itemEdit.saving} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm hover:text-amber-400 hover:border-amber-600 transition disabled:opacity-50" title="Vuelve al texto automático del verbo">Restablecer</button>
              <button type="submit" disabled={itemEdit.saving} className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition disabled:bg-slate-800 disabled:text-slate-500">{itemEdit.saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-start justify-center p-4 z-[60] overflow-y-auto" onClick={() => !saving && setFormOpen(false)}>
          <form onSubmit={handleSave} onClick={(e) => e.stopPropagation()} className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 w-full max-w-3xl shadow-2xl my-4 flex flex-col gap-4">
            <h2 className="text-cyan-400 font-black text-lg tracking-tight">{editing ? `Editar "${editing.english}"` : 'Nuevo Verbo'}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={labelCls}>Verbo en inglés</label><input className={inputCls} value={fd.english} onChange={(e) => setTop('english', e.target.value)} placeholder="build" autoFocus /></div>
              <div><label className={labelCls}>Traducción</label><input className={inputCls} value={fd.spanish} onChange={(e) => setTop('spanish', e.target.value)} placeholder="construir" /></div>
              <div><label className={labelCls}>Pronunciación</label><input className={inputCls} value={fd.pronunciation} onChange={(e) => setTop('pronunciation', e.target.value)} placeholder="bild" /></div>
            </div>

            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Formas en inglés y su pronunciación</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[['base', 'Base (I / we / they)'], ['third', 'He / She (presente)'], ['past', 'Pasado']].map(([k, label]) => (
                  <div key={k} className="flex flex-col gap-2">
                    <label className={labelCls}>{label}</label>
                    <input className={inputCls} value={fd.forms.en[k]} onChange={(e) => setForms('en', k, e.target.value)} placeholder="Inglés" />
                    <input className={`${inputCls} font-mono`} value={fd.forms.pron[k]} onChange={(e) => setForms('pron', k, e.target.value)} placeholder="Pronunciación" />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TENSES.map((t) => (
                <div key={t.key} className={`border ${t.border} rounded-xl p-3 flex flex-col gap-2`}>
                  <p className={`${t.text} text-xs font-black uppercase tracking-widest`}>{t.icon} {t.label} (español)</p>
                  {PERSONS.map((p, i) => (
                    <div key={p.key}>
                      <label className={`${labelCls} ${p.text}`}>{p.es}</label>
                      <input className={inputCls} value={fd.forms.es[t.key][p.idx]} onChange={(e) => setEs(t.key, p.idx, e.target.value)} />
                    </div>
                  ))}
                  <label className={labelCls}>Nota de uso</label>
                  <textarea className={`${inputCls} h-24 resize-none`} value={fd.forms.notes?.[t.key] || ''} onChange={(e) => setForms('notes', t.key, e.target.value)} />
                </div>
              ))}
            </div>

            {formError && <p className="text-red-400 text-xs font-bold bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{formError}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm hover:border-slate-500 transition disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition disabled:bg-slate-800 disabled:text-slate-500">
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Verbos;
