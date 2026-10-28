import {Router} from 'express'
import { prisma } from '../lib/prisma.js'
import { validateForm, validateTemplate } from '../lib/formEngine.js'
import {authOf} from '../lib/auth.js'
import {HttpError, notFound} from '../lib/http.js'

const router = Router() 

async function isAdmin(userId: string, workspaceId: string) {
  const owner = await prisma.user.findFirst({ where: {workspaceId}, orderBy: { createdAt: 'asc'}} )
  return owner?.id === userId
}

async function findTemplate(id: string, workspaceId: string) {
  const template = await prisma.formTemplate.findFirst({ where: { id, workspaceId}})
  if (!template) throw notFound("Template not found")
  return template 
}

const parse = <T extends {schema:string } > (t: T) => ({ ...t, schema: JSON.parse(t.schema)})

router.get('/', async (req, res) => {
  const { userId, workspaceId } = authOf(req)
  const templates = await prisma.formTemplate.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc'}})
  res.json({ isAdmin: await isAdmin(userId, workspaceId), templates: templates.map(parse)})
})

router.post('/', async (req, res) => {
  const { userId, workspaceId } = authOf(req)
  if (!(await isAdmin(userId, workspaceId ))) throw new  HttpError(403, 'Only admin can create templates')

  const {name, schema } = req.body
  const errors = validateTemplate(schema)
  if (!name || errors.length) return void res.status(400).json({error: errors[0] ?? 'Name is requried'})

  const template = await prisma.formTemplate.create({data: {name, schema: JSON.stringify(schema), workspaceId}})
  res.status(201).json(parse(template))
})

router.put('/:id', async (req, res) => {
  const { userId, workspaceId } = authOf(req)
  if (!(await isAdmin(userId, workspaceId))) throw new HttpError(403, 'Only admins can edit templates')
  const existing = await findTemplate(req.params.id , workspaceId)

  const { name, schema } = req.body 
  const errors = validateTemplate(schema)
  if (!name || errors.length) return void res.status(400).json({error: errors[0] ?? 'Name is required'})

  const template = await prisma.formTemplate.update({
    where: { id:  existing.id }, 
    data: { name, schema: JSON.stringify(schema), version: { increment: 1 }}, 
  })
  res.json(parse(template))
})

router.get('/:id/submissions', async (req, res) => {
  const template = await findTemplate(req.params.id, authOf(req).workspaceId)
  const submissions = await prisma.formSubmission.findMany ({ 
    where: { templateId: template.id },
    orderBy: { createdAt: 'desc' },
  })
  res.json(submissions.map((s) => ({...parse(s), values: JSON.parse(s.values) })))
})

router.post('/:id/submissions', async (req, res) => {
  const template = await findTemplate(req.params.id, authOf(req).workspaceId)
  const { errors, values } = validateForm(JSON.parse(template.schema), req.body.values ?? {})
  if (Object.keys(errors).length) return void res.status(400).json({error: 'Please fix the errors', errors })

  const submission = await prisma.formSubmission.create({
    data: {
      templateId: template.id,
      templateVersion: template.version,
      schema: template.schema,
      values: JSON.stringify(values),
    },
  })
  res.status(201).json(submission)
})

export default router