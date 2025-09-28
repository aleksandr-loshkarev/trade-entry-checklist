"use client";
import React, { useEffect, useMemo } from "react";

type Item = { id: string; label: string; required?: boolean; weight: number };
type Group = { id: string; title: string; items: Item[] };

const GROUPS: Group[] = [
  { id: "context", title: "Контекст (HTF/MTF)", items: [
    { id: "bias_align", label: "HTF Bias поддерживает сделку", required: true, weight: 8 },
    { id: "discount_premium", label: "Цена в скидке (лонг) / в премии (шорт)", required: true, weight: 6 },
    { id: "liq_sweep", label: "Захват ликвидности (EQH/EQL/PDH/PDL/IB)", weight: 5 },
    { id: "choch_bos", label: "Есть CHoCH/BOS в сторону входа", required: true, weight: 8 },
  ]},
  { id: "poi", title: "POI / Сетап", items: [
    { id: "poi_clear", label: "Чёткий POI (OB/FVG/QM/Breaker)", required: true, weight: 8 },
    { id: "poi_fresh", label: "POI свежий (не митигирован)", weight: 4 },
    { id: "inefficiency", label: "Есть дисбаланс (FVG/displacement)", weight: 4 },
  ]},
  { id: "confirmation", title: "Подтверждение (LTF)", items: [
    { id: "ltF_displacement", label: "Импульс/дисплейсмент от POI", weight: 4 },
    { id: "entry_model_valid", label: "Модель входа валидна (ретест/2-й импульс)", required: true, weight: 7 },
    { id: "sl_structural", label: "SL за структурой/телом OB", required: true, weight: 7 },
  ]},
  { id: "timing", title: "Тайминг / Новости", items: [
    { id: "kill_zone", label: "Вход в Kill Zone (London/NY/Asia)", required: true, weight: 5 },
    { id: "no_red_news", label: "Нет красных новостей ±30 мин", required: true, weight: 6 },
  ]},
  { id: "risk", title: "Риск / Цели", items: [
    { id: "rr_2_plus", label: "План RR ≥ 2.0", required: true, weight: 7 },
    { id: "tp_defined", label: "TP/частичные определены", weight: 4 },
    { id: "no_averaging", label: "Нет усреднений вне плана", weight: 3 },
  ]},
  { id: "discipline", title: "Дисциплина", items: [
    { id: "plan_match", label: "Сделка соответствует плану", required: true, weight: 6 },
    { id: "mindset_ok", label: "Нет FOMO/ревендж", weight: 4 },
    { id: "screenshot_pre", label: "Скрин до входа сделан", weight: 2 },
  ]},
];

const REQUIRED = new Set(GROUPS.flatMap(g => g.items.filter(i => i.required).map(i => i.id)));
function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = React.useState<T>(initial);
  React.useEffect(() => { try { const raw = localStorage.getItem(key); if (raw) setValue(JSON.parse(raw)); } catch {} }, [key]);
  React.useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue] as const;
}
const today = () => new Date().toISOString().slice(0, 10);

export default function TradeEntryChecklist() {
  const [form, setForm] = useLocalStorage("tec_form_v1", {
    date: today(), pair: "", direction: "Long", session: "London", news: "None",
    setup: "OB", riskUSD: "", planRR: "2.0", notes: "", chartsComments: "",
  });
  const [checks, setChecks] = useLocalStorage<Record<string, boolean>>(
    "tec_checks_v1", GROUPS.reduce((a, g) => (g.items.forEach(i => a[i.id] = false), a), {} as Record<string, boolean>)
  );

  // Автологика
  useEffect(() => setChecks(p => ({ ...p, no_red_news: (form as any).news !== "High" })), [form, setChecks]);
  useEffect(() => {
    const rr = parseFloat(String((form as any).planRR).replace(",", "."));
    if (!Number.isNaN(rr)) setChecks(p => ({ ...p, rr_2_plus: rr >= 2 }));
  }, [form, setChecks]);

  const weights = useMemo(() => {
    const all = GROUPS.flatMap(g => g.items); const sum = all.reduce((s, i) => s + i.weight, 0);
    return { all, sum };
  }, []);
  const score = useMemo(() =>
    Math.round((weights.all.reduce((s, i) => s + ((checks as any)[i.id] ? i.weight : 0), 0) / weights.sum) * 100),
  [checks, weights]);
  const missing = useMemo(() => [...REQUIRED].filter(id => !(checks as any)[id]), [checks]);
  const goNoGo = missing.length === 0 ? "GO" : "NO-GO";
  const klass = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  const h = (k: string, v: string) => setForm((p: any) => ({ ...p, [k]: v }));

  const copySummary = async () => {
    const issues = GROUPS.flatMap(g => g.items.filter(i => !checks[i.id]).map(i => i.label));
    const txt = `# Резюме
${(form as any).pair || "(пара?)"}, ${(form as any).direction}, сетап ${(form as any).setup}. Итог: ${goNoGo} (оценка ${score}/100, класс ${klass}).

# Контекст
— Сессия: ${(form as any).session}; Новости: ${(form as any).news}.
— Charts: ${(form as any).chartsComments || "—"}

# План
— План RR: ${(form as any).planRR} | Риск: ${(form as any).riskUSD ? "$"+(form as any).riskUSD : "(не указан)"}
— За планом: ${goNoGo === "GO" ? "Да" : "Нет"}

# Риски/пробелы
${issues.length ? issues.map((s, i) => `${i+1}) ${s}`).join("\\n") : "—"}

# Микро-правило
"Не вхожу без CHoCH/BOS и RR ≥ 2.0"`;
    await navigator.clipboard.writeText(txt);
    alert("Сводка скопирована — вставь в Notion.");
  };

  return (
    <div className="min-h-dvh p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Trade Entry Checklist (SMC + PA)</h1>
            <p className="text-zinc-400 text-sm">GO / NO-GO перед входом.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-2 rounded-2xl text-sm font-semibold ${goNoGo==="GO"?"bg-emerald-600/20 text-emerald-300":"bg-rose-600/20 text-rose-300"}`}>{goNoGo}</div>
            <div className="px-3 py-2 rounded-2xl bg-zinc-900 text-sm">Счёт: <b>{score}/100</b> <span className="text-zinc-400">(класс {klass})</span></div>
          </div>
        </header>

        <div className="grid md:grid-cols-4 gap-4">
          <section className="col-span-2 bg-zinc-900 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-zinc-400">Дата
                <input type="date" value={(form as any).date} onChange={e=>h("date", e.target.value)} className="w-full bg-zinc-800 rounded-xl px-3 py-2"/>
              </label>
              <label className="text-xs text-zinc-400">Пара / Инструмент
                <input value={(form as any).pair} onChange={e=>h("pair", e.target.value)} placeholder="EUR/USD, US100…" className="w-full bg-zinc-800 rounded-xl px-3 py-2"/>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-zinc-400">Направление
                <select value={(form as any).direction} onChange={e=>h("direction", e.target.value)} className="w-full bg-zinc-800 rounded-xl px-3 py-2"><option>Long</option><option>Short</option></select>
              </label>
              <label className="text-xs text-zinc-400">Сетап
                <select value={(form as any).setup} onChange={e=>h("setup", e.target.value)} className="w-full bg-zinc-800 rounded-xl px-3 py-2">
                  <option>OB</option><option>FVG</option><option>Breaker</option><option>QM</option><option>Liquidity Grab</option><option>Reversal</option><option>Continuation</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs text-zinc-400">Сессия
                <select value={(form as any).session} onChange={e=>h("session", e.target.value)} className="w-full bg-zinc-800 rounded-xl px-3 py-2"><option>London</option><option>NY</option><option>Asia</option></select>
              </label>
              <label className="text-xs text-zinc-400">Новости
                <select value={(form as any).news} onChange={e=>h("news", e.target.value)} className="w-full bg-zinc-800 rounded-xl px-3 py-2">
                  <option>None</option><option>Medium</option><option>High</option>
                </select>
              </label>
              <label className="text-xs text-zinc-400">Риск ($)
                <input value={(form as any).riskUSD} onChange={e=>h("riskUSD", e.target.value.replace(/[^0-9.,]/g,""))} placeholder="например, 50" className="w-full bg-zinc-800 rounded-xl px-3 py-2"/>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs text-zinc-400">План RR
                <input value={(form as any).planRR} onChange={e=>h("planRR", e.target.value.replace(/[^0-9.,]/g,""))} placeholder="2.0" className="w-full bg-zinc-800 rounded-xl px-3 py-2"/>
              </label>
              <label className="col-span-2 text-xs text-zinc-400">Заметки
                <input value={(form as any).notes} onChange={e=>h("notes", e.target.value)} className="w-full bg-zinc-800 rounded-xl px-3 py-2"/>
              </label>
            </div>
            <label className="text-xs text-zinc-400">Charts Comments
              <textarea value={(form as any).chartsComments} onChange={e=>h("chartsComments", e.target.value)} rows={3} className="w-full bg-zinc-800 rounded-xl px-3 py-2"/>
            </label>
          </section>

          <section className="col-span-2 bg-zinc-900 rounded-2xl p-4 space-y-4">
            {GROUPS.map(g => (
              <div key={g.id} className="border border-zinc-800 rounded-2xl">
                <div className="px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                  <h3 className="font-semibold">{g.title}</h3>
                  <span className="text-xs text-zinc-400">
                    {g.items.filter(i => (checks as any)[i.id]).length}/{g.items.length}
                  </span>
                </div>
                <div className="p-2">
                  {g.items.map(i => (
                    <label key={i.id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-zinc-800/50 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4" checked={!!(checks as any)[i.id]} onChange={()=>setChecks((p:any)=>({ ...p, [i.id]: !(p as any)[i.id] }))}/>
                      <span className="text-sm">{i.label}{i.required && <span className="ml-2 text-rose-400 text-xs">(обязательно)</span>}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={copySummary} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-black font-semibold">Скопировать сводку для Notion</button>
          <button onClick={()=>{ localStorage.clear(); location.reload(); }} className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700">Сбросить</button>
        </div>
      </div>
    </div>
  );
}
