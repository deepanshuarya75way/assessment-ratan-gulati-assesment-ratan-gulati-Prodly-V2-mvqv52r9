import { getFieldSate, validateForm } from "@/lib/formEngine";
import { useEffect, useState } from "react";

const api = (method: string, url: string, body?: unknown) => 
  fetch(url, { method, headers: { 'Content-Type': 'application/json'}, body: JSON.stringify(body)})
    .then(async (r) => { const d = await r.json(); 
      if(!r.ok) throw d; return d })

export default function FormsPanel() {
  const [templates, setTemplates] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [name, setName] = useState('')
  const [json, setJson] = useState(`{"fields": [], "rules": []}`)
  const [values, setValues] = useState<any>({})
  const [errors, setErrors] = useState<any>({})
  const [msg, setMsg] = useState('')

  const load = () => api('GET', '/api/db/forms').then((d) => { setTemplates(d.templates); setIsAdmin(d.isAdmin)})
  useEffect(() => { load() }, [])

  async function saveTemplate() {
    try {
      const body = { name, schema: JSON.parse(json)}
      if (current) await api('PUT', `api/db/forms/${current.id}`, body)
      else await api('POST', 'api/db/forms', body)
      setMsg('Template saved')
      load()
    } catch (e: any) { 
      setMsg(e.error ?? 'Invalid JSON')
    }
  }

  async function submit() {
    const result = validateForm(current.schema, values)
    setErrors(result.errors)
    if (Object.keys(result.errors).length) return 
    try {
      await api('POST', `/api/db/forms/${current.id}/submissions`, { values })
      setValues({})
      setMsg('Submitted')
    } catch (e: any) { 
      setErrors(e.errors ?? {}) 
      setMsg(e.error)
    }
  }

  function pick(t : any) {
    setCurrent(t)
    setName(t.name)
    setJson(JSON.stringify(t.schema, null, 2))
    setValues({})
    setErrors({})
  }

  return (
    <div className="p-6 space-y-4 text-sm text-zinc-200">
      <h2 className="font-semibold">Intake Forms</h2>
      <div className="flex gap-2">
        {templates.map((t) => <button key={t.id}  className="px-2 py-1 bg-zinc-800 rounded" onClick={() => pick(t)}>{t.name} v{t.version}</button>  )}
      </div>
      {current && current.schema.fields.map((f: any) => {
        const s = getFieldSate(f, values)
        if (!s.visible) return null
        const set = (v : any) => setValues({ ...values, [f.key]: v })
        return (
          <div key={f.key}>
            <label>{f.label}{s.required && ' *'}</label>
            {f.type === 'select' ? (
              <select className="block bg-zinc-900" value={values[f.key] ?? ''} onChange={(e) => set(e.target.value)}>
                <option value="" >Choose</option>
                {s.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            ): f.type === 'checkbox' ? (
              <input type="checkbox" checked={!!values[f.key]} onChange={(e) => set(e.target.checked)} ></input>
            ) : (
              <input className="block bg-zinc-900" type={f.type} value={values[f.key] ?? '' } onChange={(e) => set(e.target.value)} ></input>
            )}
            {errors[f.key] && <p className="text-red-400 text-xs">{errors[f.key]}</p> }
          </div>
        )
      })}
      {current && <button className="px-3 py-1 bg-indigo-500 rounded" onClick={submit}>Submit</button>}

      {isAdmin && (
        <div className="space-y-2">
          <h3 className="font-semibold">{current ? 'Edit template' : 'New template'}</h3>
          <input className="block bg-zinc-900 w-80" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} ></input>
          <textarea className="block bg-zinc-900 w-full h-60 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} ></textarea>
          <button className="px-3 py-1 bg-zinc-700 rounded" onClick={saveTemplate}>Save template</button>
        </div>
      )}
      {msg && <p className="text-xs">{msg}</p> }
    </div>
  )
}
