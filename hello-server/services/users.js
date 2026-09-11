// services/users.js

function validateUserPayload(body) {
  const { nome, email } = body || {}
  if (!nome) return { ok: false, erro: 'nome é obrigatório' }
  if (!email || !email.includes('@')) return { ok: false, erro: 'email inválido' }
  return { ok: true, data: { nome, email } }
}

function nextId(users) {
  return users.length ? Math.max(...users.map(u => u.id)) + 1 : 1
}

// Lista apenas usuários ativos (não deletados)
function findAll(users) {
  return users.filter(u => !u.deletedAt)
}

// Busca um usuário pelo id (retorna undefined se não achar)
function findById(users, id) {
  return users.find(u => u.id === Number(id))
}

// Cria um novo usuário. Retorna { ok, erro? , data?, users? }
function create(users, payload) {
  const valid = validateUserPayload(payload)
  if (!valid.ok) return { ok: false, erro: valid.erro }

  const novo = { id: nextId(users), ...valid.data }
  return { ok: true, data: novo, users: [...users, novo] }
}

// Substituição completa (PUT). Retorna { ok, erro?, status?, data?, users? }
function update(users, id, payload) {
  const numId = Number(id)
  const { nome, email } = payload || {}

  if (!nome || !email) {
    return { ok: false, status: 400, erro: 'nome e email são obrigatórios para PUT (substituição completa)' }
  }

  const idx = users.findIndex(u => u.id === numId)
  if (idx === -1) return { ok: false, status: 404, erro: 'Usuário não encontrado' }

  const atualizado = { id: numId, nome, email }
  const novosUsers = [...users]
  novosUsers[idx] = atualizado

  return { ok: true, data: atualizado, users: novosUsers }
}

function patch(users, id, payload) {
  const numId = Number(id)
  const idx = users.findIndex(u => u.id === numId)
  if (idx === -1) return { ok: false, status: 404, erro: 'Usuário não encontrado' }

  const user = users[idx]

  // filtra campos sensíveis ANTES do merge (id não pode ser sobrescrito)
  const { id: _, createdAt: __, updatedAt: ___, ...dadosPermitidos } = payload || {}

  // valida email só se ele veio no body
  if ('email' in dadosPermitidos) {
    if (!dadosPermitidos.email || !dadosPermitidos.email.includes('@')) {
      return { ok: false, status: 400, erro: 'email inválido' }
    }
  }

  // valida nome só se ele veio no body (não pode virar vazio)
  if ('nome' in dadosPermitidos && !dadosPermitidos.nome) {
    return { ok: false, status: 400, erro: 'nome não pode ser vazio' }
  }

  const atualizado = {
    ...user,
    ...dadosPermitidos,
    updatedAt: new Date().toISOString()
  }

  const novosUsers = [...users]
  novosUsers[idx] = atualizado

  return { ok: true, data: atualizado, users: novosUsers }
}

// Restaurar usuário soft-deletado. Retorna { ok, erro?, status?, data?, users? }
function restore(users, id) {
  const numId = Number(id)
  const idx = users.findIndex(u => u.id === numId)
  if (idx === -1) return { ok: false, status: 404, erro: 'Não encontrado' }

  const user = users[idx]
  const restaurado = { ...user, deletedAt: null }

  const novosUsers = [...users]
  novosUsers[idx] = restaurado

  return { ok: true, data: restaurado, users: novosUsers }
}

// Soft delete. Retorna { ok, erro?, status?, users? }
function remove(users, id) {
  const numId = Number(id)
  const idx = users.findIndex(u => u.id === numId)
  if (idx === -1) return { ok: false, status: 404, erro: 'Usuário não encontrado' }

  const user = users[idx]
  if (user.deletedAt) return { ok: false, status: 409, erro: 'Já removido' }

  const novosUsers = [...users]
  novosUsers[idx] = { ...user, deletedAt: new Date().toISOString() }

  return { ok: true, users: novosUsers }
}

export { validateUserPayload, nextId, findAll, findById, create, update, remove, patch, restore }