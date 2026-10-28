export type FieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox' 

export interface  Condition { field: string; equals: string}

export interface Field {
    key: string
    label: string
    type: FieldType
    required?: boolean
    options?: string[]
    optionsFrom?: { field: string; map: Record<string, string[]>}
    min?: number
    max?: number 
    showIf?: Condition
    requiredIf?: Condition
}

export interface Rule { field: string; op: 'gt' | 'lt'; other: string; message: string }
export interface FormSchema { fields: Field[]; rules: Rule[]}
export type Values = Record<string, any>

const matches = (c: Condition | undefined, values: Values) => !c || String(values[c.field] ?? '' ) === c.equals
const isEmpty = (v: any) => v === undefined || v === null || v === '' || v=== false
const toComparable = (v: any) => (isNaN(Number(v)) ? v : Number(v))

export function getFieldSate(field: Field, values: Values) { 
  return {
    visible: matches(field.showIf, values), 
    required: !!field.required || (!!field.requiredIf && matches(field.requiredIf, values)),
    options: field.optionsFrom ? field.optionsFrom.map[values[field.optionsFrom.field]] ?? [] : field.options ?? [],
  }
}

export function validateForm(schema:FormSchema, input: Values) {
  const errors: Record<string, string> ={} 
  const values: Values = {}

  for (const field of schema.fields) {
    const { visible, required, options } = getFieldSate(field, input)
    if (!visible) continue 

    const value = input[field.key]
    if (isEmpty(value)) {
      if (required) errors[field.key] = `${field.label} is required`
      continue
    }

    if (field.type === 'number') {
      const n = Number(value)
      if (isNaN(n)) errors[field.key] = `${field.label} must be a number`
      else if (field.min != null && n < field.min) errors[field.key] = `${field.label } must be at least ${field.min}`
      else if (field.max != null && n > field.max) errors[field.key] = `${field.label } must be at most ${field.max}`
    }
    
    if (field.type === 'select' && !options.includes(value)) {
      errors[field.key] = `Pick a valid  ${field.label}`
    }
    values[field.key] = value
  }

  for (const rule of schema.rules) {
    const a = values[rule.field]
    const b = values[rule.other]
    if (isEmpty(a) || isEmpty(b)) continue
    const ok = rule.op === 'gt' ? toComparable(a) > toComparable(b) : toComparable(a)
    if (!ok && !errors[rule.field]) errors[rule.field] = rule.message
  }
  return { errors, values }
}

export function validateTemplate(schema: FormSchema): string[] {
  const errors: string[] = []
  const keys = new Set<string>()

  if (!schema?.fields?.length) errors.push('Add at least one field')
  for (const field of schema?.fields ?? []) {
    if (!field.key || !field.label) errors.push("Every field needs a key and label")
    if (keys.has(field.key)) errors.push(`The key "${field.key}" is used twice`)
    if (field.type === 'select' && !field.options?.length && !field.optionsFrom) errors.push(`${field.label} need options`)  
    keys.add(field.key)
  }
  for (const rule of schema?.rules ?? []) {
    if (!keys.has(rule.field) || !keys.has(rule.other) || !rule.message) errors.push('Each rule needs two fields and a message')
  }
return errors
}