'use client'
import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Trash2, Plus, TrendingDown, Dumbbell, Scale, BarChart2, ChevronDown } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const MUSCLE_GROUPS = ['Pecho','Espalda','Hombro','Bíceps','Tríceps','Piernas','Glúteos','Core','Cardio']

const PRESET_EXERCISES: Record<string, string[]> = {
  Pecho: ['Press plano mancuernas','Press inclinado barra','Press inclinado mancuernas','Press plano barra','Aperturas máquina','Pájaros banco','Flexiones'],
  Espalda: ['Remo polea baja','Remo landmine','Remo mancuerna 1 mano','Jalón pecho agarre ancho','Jalón pecho agarre estrecho','Pullover mancuerna','Remo barra supino','Peso muerto convencional','Hiperextensiones'],
  Hombro: ['Press militar mancuernas','Press militar multipower','Elevaciones laterales','Elevaciones frontales','Pájaros banco inclinado'],
  Bíceps: ['Curl EZ','Curl martillo','Curl scott EZ','Curl inverso barra','Dominadas bíceps'],
  Tríceps: ['Tirón polea tríceps cuerda','Tirón polea tríceps barra','Fondos tríceps','Press francés mancuernas','Press cerrado multipower'],
  Piernas: ['Femoral sentado','Femoral tumbado','Prensa inclinada','Extensión cuádriceps','Sentadilla hack','Sentadilla libre','Hip thrust','Peso muerto rumano','Zancadas','Gemelos multipower'],
  Glúteos: ['Hip thrust','Peso muerto rumano','Zancadas'],
  Core: ['Plancha','Elevación piernas','V sit up','Criss cross'],
  Cardio: ['Bici estática','Elíptica','Cinta','Pádel','Senderismo'],
}

type BodyWeightRow = { id: number; date: string; weight: string; notes: string | null }
type ExerciseRow = { id: number; date: string; exercise: string; muscle_group: string; sets: number; reps: number; weight: string; notes: string | null }

const TAB_ICONS = [Scale, Dumbbell, BarChart2]
const TAB_LABELS = ['Peso corporal', 'Ejercicios', 'Progresión']

function formatDate(d: string) {
  try { return format(parseISO(d), 'd MMM yyyy', { locale: es }) } catch { return d }
}

function today() { return new Date().toISOString().split('T')[0] }

export default function Home() {
  const [tab, setTab] = useState(0)
  const [bodyWeights, setBodyWeights] = useState<BodyWeightRow[]>([])
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseRow[]>([])
  const [exerciseNames, setExerciseNames] = useState<{exercise: string; muscle_group: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [dbReady, setDbReady] = useState(false)

  // forms
  const [bwDate, setBwDate] = useState(today())
  const [bwWeight, setBwWeight] = useState('')
  const [bwNotes, setBwNotes] = useState('')
  const [bwSaving, setBwSaving] = useState(false)

  const [exDate, setExDate] = useState(today())
  const [exExercise, setExExercise] = useState('')
  const [exMuscle, setExMuscle] = useState('Pecho')
  const [exSets, setExSets] = useState('3')
  const [exReps, setExReps] = useState('10')
  const [exWeight, setExWeight] = useState('')
  const [exNotes, setExNotes] = useState('')
  const [exSaving, setExSaving] = useState(false)

  const [histExercise, setHistExercise] = useState('')
  const [histData, setHistData] = useState<any[]>([])

  const init = useCallback(async () => {
    await fetch('/api/init')
    setDbReady(true)
  }, [])

  const loadAll = useCallback(async () => {
    const [bw, ex, names] = await Promise.all([
      fetch('/api/body-weight').then(r => r.json()),
      fetch('/api/exercise-logs').then(r => r.json()),
      fetch('/api/exercise-logs?names=1').then(r => r.json()),
    ])
    setBodyWeights(Array.isArray(bw) ? bw : [])
    setExerciseLogs(Array.isArray(ex) ? ex : [])
    setExerciseNames(Array.isArray(names) ? names : [])
    setLoading(false)
  }, [])

  useEffect(() => { init().then(loadAll) }, [init, loadAll])

  const saveBW = async () => {
    if (!bwWeight) return
    setBwSaving(true)
    await fetch('/api/body-weight', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ date: bwDate, weight: parseFloat(bwWeight), notes: bwNotes || null }) })
    setBwWeight(''); setBwNotes('')
    await loadAll()
    setBwSaving(false)
  }

  const deleteBW = async (id: number) => {
    await fetch('/api/body-weight', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    await loadAll()
  }

  const saveEx = async () => {
    if (!exExercise || !exWeight) return
    setExSaving(true)
    await fetch('/api/exercise-logs', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ date: exDate, exercise: exExercise, muscle_group: exMuscle, sets: parseInt(exSets), reps: parseInt(exReps), weight: parseFloat(exWeight), notes: exNotes || null }) })
    setExExercise(''); setExWeight(''); setExNotes('')
    await loadAll()
    setExSaving(false)
  }

  const deleteEx = async (id: number) => {
    await fetch('/api/exercise-logs', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    await loadAll()
  }

  const loadHistory = async (ex: string) => {
    setHistExercise(ex)
    const data = await fetch(`/api/exercise-history?exercise=${encodeURIComponent(ex)}`).then(r => r.json())
    setHistData(Array.isArray(data) ? data.map((d: any) => ({ ...d, date: formatDate(d.date), max_weight: parseFloat(d.max_weight) })) : [])
  }

  const bwChartData = [...bodyWeights].reverse().map(r => ({ date: formatDate(r.date), peso: parseFloat(r.weight) }))
  const currentWeight = bodyWeights[0] ? parseFloat(bodyWeights[0].weight) : null
  const startWeight = bodyWeights.length > 1 ? parseFloat(bodyWeights[bodyWeights.length - 1].weight) : null
  const diff = currentWeight && startWeight ? +(currentWeight - startWeight).toFixed(1) : null

  const presets = PRESET_EXERCISES[exMuscle] ?? []

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f5f2ee' }}>
      {/* HEADER */}
      <div style={{ background: '#141414', borderBottom: '1px solid #3d3d3d', padding: '24px 24px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -10, top: -20, fontFamily: 'Bebas Neue, sans-serif', fontSize: 120, color: 'rgba(255,255,255,0.03)', pointerEvents: 'none', lineHeight: 1 }}>PABLO</div>
        <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d63c2a', fontWeight: 500, marginBottom: 6 }}>La Force et la Douleur</div>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: 2, lineHeight: 1, marginBottom: 16 }}>
          Seguimiento <span style={{ color: '#d63c2a' }}>Entreno</span>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {currentWeight && (
            <div>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 26, color: '#c8a84b', letterSpacing: 1 }}>{currentWeight} kg</div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a' }}>Peso actual</div>
            </div>
          )}
          {diff !== null && (
            <div>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 26, color: diff < 0 ? '#4a9e6b' : '#d63c2a', letterSpacing: 1 }}>{diff > 0 ? '+' : ''}{diff} kg</div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a' }}>Desde inicio</div>
            </div>
          )}
          <div>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 26, color: '#c8a84b', letterSpacing: 1 }}>{exerciseLogs.length}</div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a' }}>Series registradas</div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid #3d3d3d', background: '#141414' }}>
        {TAB_LABELS.map((label, i) => {
          const Icon = TAB_ICONS[i]
          return (
            <button key={i} onClick={() => setTab(i)} style={{ flex: 1, padding: '14px 8px', background: 'none', border: 'none', borderBottom: tab === i ? '2px solid #d63c2a' : '2px solid transparent', color: tab === i ? '#f5f2ee' : '#7a7a7a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 500, transition: 'color 0.2s' }}>
              <Icon size={14} />
              <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>{label}</span>
            </button>
          )
        })}
      </div>

      <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#7a7a7a', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: 2 }}>CARGANDO...</div>
        ) : (
          <>
            {/* TAB 0: PESO CORPORAL */}
            {tab === 0 && (
              <div>
                {bwChartData.length > 1 && (
                  <div style={{ background: '#141414', border: '1px solid #3d3d3d', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, letterSpacing: 1, marginBottom: 16 }}>Evolución del peso</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={bwChartData}>
                        <defs>
                          <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#c8a84b" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#c8a84b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                        <XAxis dataKey="date" stroke="#7a7a7a" tick={{ fontSize: 10 }} />
                        <YAxis stroke="#7a7a7a" tick={{ fontSize: 10 }} domain={['auto','auto']} />
                        <Tooltip contentStyle={{ background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, color: '#f5f2ee', fontSize: 12 }} />
                        <Area type="monotone" dataKey="peso" stroke="#c8a84b" strokeWidth={2} fill="url(#wGrad)" dot={{ fill: '#c8a84b', r: 3 }} name="Peso (kg)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* FORM */}
                <div style={{ background: '#141414', border: '1px solid #3d3d3d', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, letterSpacing: 1, marginBottom: 14 }}>Registrar peso</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a', display: 'block', marginBottom: 4 }}>Fecha</label>
                      <input type="date" value={bwDate} onChange={e => setBwDate(e.target.value)} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, padding: '8px 10px', color: '#f5f2ee', fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a', display: 'block', marginBottom: 4 }}>Peso (kg)</label>
                      <input type="number" step="0.1" placeholder="105.0" value={bwWeight} onChange={e => setBwWeight(e.target.value)} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, padding: '8px 10px', color: '#f5f2ee', fontSize: 13 }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a', display: 'block', marginBottom: 4 }}>Notas (opcional)</label>
                    <input placeholder="Ej: después de entrenar, en ayunas..." value={bwNotes} onChange={e => setBwNotes(e.target.value)} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, padding: '8px 10px', color: '#f5f2ee', fontSize: 13 }} />
                  </div>
                  <button onClick={saveBW} disabled={bwSaving || !bwWeight} style={{ background: '#d63c2a', border: 'none', borderRadius: 6, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: !bwWeight ? 0.5 : 1 }}>
                    <Plus size={14} />{bwSaving ? 'Guardando...' : 'Guardar peso'}
                  </button>
                </div>

                {/* LIST */}
                {bodyWeights.length > 0 && (
                  <div style={{ background: '#141414', border: '1px solid #3d3d3d', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, letterSpacing: 1, padding: '14px 16px', borderBottom: '1px solid #3d3d3d' }}>Historial</div>
                    {bodyWeights.map((row, i) => (
                      <div key={row.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < bodyWeights.length - 1 ? '1px solid #1e1e1e' : 'none' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{parseFloat(row.weight).toFixed(1)} kg</div>
                          <div style={{ fontSize: 11, color: '#7a7a7a' }}>{formatDate(row.date)}{row.notes ? ` · ${row.notes}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {i < bodyWeights.length - 1 && (() => {
                            const prev = parseFloat(bodyWeights[i + 1].weight)
                            const curr = parseFloat(row.weight)
                            const d = +(curr - prev).toFixed(1)
                            return <span style={{ fontSize: 12, color: d < 0 ? '#4a9e6b' : d > 0 ? '#d63c2a' : '#7a7a7a' }}>{d > 0 ? '+' : ''}{d} kg</span>
                          })()}
                          <button onClick={() => deleteBW(row.id)} style={{ background: 'none', border: 'none', color: '#7a7a7a', cursor: 'pointer', padding: 4, borderRadius: 4 }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: EJERCICIOS */}
            {tab === 1 && (
              <div>
                <div style={{ background: '#141414', border: '1px solid #3d3d3d', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, letterSpacing: 1, marginBottom: 14 }}>Registrar serie</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a', display: 'block', marginBottom: 4 }}>Fecha</label>
                      <input type="date" value={exDate} onChange={e => setExDate(e.target.value)} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, padding: '8px 10px', color: '#f5f2ee', fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a', display: 'block', marginBottom: 4 }}>Grupo muscular</label>
                      <select value={exMuscle} onChange={e => { setExMuscle(e.target.value); setExExercise('') }} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, padding: '8px 10px', color: '#f5f2ee', fontSize: 13 }}>
                        {MUSCLE_GROUPS.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a', display: 'block', marginBottom: 4 }}>Ejercicio</label>
                    <input list="exercise-list" placeholder="Escribe o selecciona..." value={exExercise} onChange={e => setExExercise(e.target.value)} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, padding: '8px 10px', color: '#f5f2ee', fontSize: 13 }} />
                    <datalist id="exercise-list">
                      {presets.map(p => <option key={p} value={p} />)}
                      {exerciseNames.map(n => <option key={n.exercise} value={n.exercise} />)}
                    </datalist>
                    {presets.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {presets.map(p => (
                          <button key={p} onClick={() => setExExercise(p)} style={{ background: exExercise === p ? '#d63c2a' : '#2a2a2a', border: '1px solid #3d3d3d', borderRadius: 4, padding: '3px 8px', color: exExercise === p ? '#fff' : '#7a7a7a', fontSize: 10, cursor: 'pointer', transition: 'all 0.15s' }}>
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a', display: 'block', marginBottom: 4 }}>Series</label>
                      <input type="number" value={exSets} onChange={e => setExSets(e.target.value)} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, padding: '8px 10px', color: '#f5f2ee', fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a', display: 'block', marginBottom: 4 }}>Reps</label>
                      <input type="number" value={exReps} onChange={e => setExReps(e.target.value)} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, padding: '8px 10px', color: '#f5f2ee', fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a', display: 'block', marginBottom: 4 }}>Peso (kg)</label>
                      <input type="number" step="0.5" placeholder="20" value={exWeight} onChange={e => setExWeight(e.target.value)} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, padding: '8px 10px', color: '#f5f2ee', fontSize: 13 }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7a7a7a', display: 'block', marginBottom: 4 }}>Notas</label>
                    <input placeholder="Sensaciones, técnica, etc." value={exNotes} onChange={e => setExNotes(e.target.value)} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, padding: '8px 10px', color: '#f5f2ee', fontSize: 13 }} />
                  </div>

                  <button onClick={saveEx} disabled={exSaving || !exExercise || !exWeight} style={{ background: '#d63c2a', border: 'none', borderRadius: 6, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: (!exExercise || !exWeight) ? 0.5 : 1 }}>
                    <Plus size={14} />{exSaving ? 'Guardando...' : 'Registrar serie'}
                  </button>
                </div>

                {exerciseLogs.length > 0 && (
                  <div style={{ background: '#141414', border: '1px solid #3d3d3d', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, letterSpacing: 1, padding: '14px 16px', borderBottom: '1px solid #3d3d3d' }}>Últimas sesiones</div>
                    {exerciseLogs.slice(0, 40).map((row, i) => (
                      <div key={row.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < Math.min(exerciseLogs.length, 40) - 1 ? '1px solid #1e1e1e' : 'none' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{row.exercise}</span>
                            <span style={{ fontSize: 10, background: '#2a2a2a', padding: '1px 6px', borderRadius: 3, color: '#7a7a7a' }}>{row.muscle_group}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#7a7a7a', marginTop: 2 }}>
                            {formatDate(row.date)} · {row.sets}×{row.reps} · <span style={{ color: '#c8a84b' }}>{parseFloat(row.weight).toFixed(1)} kg</span>
                            {row.notes ? ` · ${row.notes}` : ''}
                          </div>
                        </div>
                        <button onClick={() => deleteEx(row.id)} style={{ background: 'none', border: 'none', color: '#7a7a7a', cursor: 'pointer', padding: 4 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PROGRESION */}
            {tab === 2 && (
              <div>
                <div style={{ background: '#141414', border: '1px solid #3d3d3d', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, letterSpacing: 1, marginBottom: 12 }}>Progresión por ejercicio</div>
                  <select value={histExercise} onChange={e => loadHistory(e.target.value)} style={{ width: '100%', background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, padding: '8px 10px', color: histExercise ? '#f5f2ee' : '#7a7a7a', fontSize: 13, marginBottom: 16 }}>
                    <option value="">Selecciona un ejercicio...</option>
                    {exerciseNames.map(n => <option key={n.exercise} value={n.exercise}>{n.exercise} ({n.muscle_group})</option>)}
                  </select>

                  {histExercise && histData.length > 0 && (
                    <>
                      <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 14, letterSpacing: 1, color: '#c8a84b', marginBottom: 12 }}>{histExercise} — máximo por sesión</div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={histData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                          <XAxis dataKey="date" stroke="#7a7a7a" tick={{ fontSize: 10 }} />
                          <YAxis stroke="#7a7a7a" tick={{ fontSize: 10 }} domain={['auto','auto']} />
                          <Tooltip contentStyle={{ background: '#1e1e1e', border: '1px solid #3d3d3d', borderRadius: 6, color: '#f5f2ee', fontSize: 12 }} formatter={(v: any) => [`${v} kg`, 'Peso máximo']} />
                          <Line type="monotone" dataKey="max_weight" stroke="#d63c2a" strokeWidth={2} dot={{ fill: '#d63c2a', r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </>
                  )}

                  {histExercise && histData.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 30, color: '#7a7a7a', fontSize: 13 }}>Sin datos para este ejercicio todavía.</div>
                  )}
                </div>

                {/* resumen por grupo muscular */}
                {exerciseLogs.length > 0 && (() => {
                  const grouped: Record<string, number> = {}
                  exerciseLogs.forEach(r => { grouped[r.muscle_group] = (grouped[r.muscle_group] || 0) + r.sets })
                  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1])
                  const max = entries[0]?.[1] ?? 1
                  return (
                    <div style={{ background: '#141414', border: '1px solid #3d3d3d', borderRadius: 8, padding: 16 }}>
                      <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, letterSpacing: 1, marginBottom: 14 }}>Series por grupo muscular</div>
                      {entries.map(([group, count]) => (
                        <div key={group} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12 }}>{group}</span>
                            <span style={{ fontSize: 12, color: '#c8a84b' }}>{count} series</span>
                          </div>
                          <div style={{ background: '#2a2a2a', borderRadius: 3, height: 4, overflow: 'hidden' }}>
                            <div style={{ background: '#d63c2a', height: '100%', width: `${(count / max) * 100}%`, borderRadius: 3, transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
