import app from "./app.js"
import dotenv from "dotenv";
import express from 'express';
import { readProducts, readUsers } from './db.js'
import { writeUsers, writeProducts } from "./db.js";

app.use(express.json())   // habilita req.body como JSON

dotenv.config()

app.get('/', (req, res) => {
  res.send({"status":"ok", "service":"lista-01"})     
})

app.get('/health', (req, res) => {
    res.send({status:"ok"})
})

app.get('/soma/:a/:b',(req, res) => {
    res.send("soma = " + (Number(req.params.a) + Number(req.params.b)))
})

app.get('/echo', (req, res) => {
    res.send(req.query)
})

//involvendo usuarios
app.get('/users', async (req, res) => {
  const users = await readUsers()
  res.json(users.filter(u => !u.deletedAt))   // só ativos
})

app.post('/users', async (req, res) => {
  const { nome, email } = req.body || {}
  const users = await readUsers()

  // validação simples
  if (!nome || typeof nome !== 'string') {
    return res.status(400).json({ erro: 'nome é obrigatório' })
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ erro: 'email inválido' })
  }

  const emailDuplicado = users.some(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  )
  if(emailDuplicado){
    return res.status(409).json({ erro: `o email ${email} já está cadastrado` })
  }
  
  const novoId = users.length ? Math.max(...users.map(u => u.id)) + 1 : 1

  const novo = { id: novoId, nome, email }
  users.push(novo)
  await writeUsers(users)

  // 201 Created + recurso no body
  res.status(201).json(novo)
})

app.post('/produtos', async (req, res)=>{
  const {nome, preco} = req.body || {}

  //validação
  if (!nome || typeof nome !== 'string') {
    return res.status(400).json({ erro: 'nome é obrigatório' })
  }
  if(!preco || typeof preco !== 'number' || preco <= 0){
    return res.status(400).json({ erro: 'preço invalido' })
  }

  const produtos = await readProducts()
  const novoId = produtos.length ? Math.max(...produtos.map(u => u.id)) + 1 : 1

  const novo = { id: novoId, nome, preco }
  produtos.push(novo)
  await writeProducts(produtos)
  res.status(201).json(novo)
})

//involvendo produtos
app.get('/produtos', async (req, res) => {
  const produtos = await readProducts()
  const min = req.query.min

  if(min === undefined){
    res.json(produtos)
  }

  const Produtosmin = produtos.filter(produto => produto.preco >= Number(min))
  res.json(Produtosmin)
})


app.get('/produtos/:id', async (req, res) => {
  const produtos = await readProducts()
  const produtoAchado = produtos.find(produto => produto.id === Number(req.params.id))
  
  if(!produtoAchado) return res.status(404).json({"erro":"produto não encontrado"})
  
    res.send(produtoAchado)
})

app.put('/users/:id', async (req, res) => {
  // 1. params vem SEMPRE como string → converter para number
  const id = Number(req.params.id)
  
  // 2. PUT exige TODOS os campos obrigatórios no body
  const { nome, email } = req.body || {}

  if (!nome || !email) {
    return res.status(400).json({ 
      erro: 'nome e email são obrigatórios para PUT (substituição completa)' 
    })
  }

  // 3. Busca o índice (não o objeto) para poder substituir no array
  const users = await readUsers()
  const idx = users.findIndex(u => u.id === id)
  if (idx === -1) return res.status(404).json({ erro: 'Usuário não encontrado' })

  // 4. SUBSTITUI o objeto inteiro — mantém id da URL, descarta o do body
  users[idx] = { id, nome, email }
  
  // 5. Persiste e responde com recurso atualizado
  await writeUsers(users)
  res.json(users[idx])  // 200 OK
})

app.patch('/users/:id', async (req, res) => {
  const id = Number(req.params.id)
  const users = await readUsers()
  const user = users.find(u => u.id === id)
  if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' })

  // PERIGO: Object.assign MUTA o objeto alvo in-place
  // Se req.body vier { id: 999, email: "x@x.com" } → user.id vira 999!
  // Object.assign(user, req.body || {})
  
  // CORRETO: filtrar campos sensíveis ANTES do merge
  const { id: _, createdAt: __, updatedAt: ___, ...dadosPermitidos } = req.body || {}
  Object.assign(user, dadosPermitidos)
  
  // Opcional: updatedAt automático
  user.updatedAt = new Date().toISOString()
  
  await writeUsers(users)
  res.json(user)  // 200 OK com recurso mesclado
})


/* ------------------------------------------------------------------------------------- 
Produtos put e patch abaixo ->
*/


app.put('/produtos/:id', async (req, res) => {
  // 1. params vem SEMPRE como string → converter para number
  const id = Number(req.params.id)
  
  // 2. PUT exige TODOS os campos obrigatórios no body
  const { nome, preco } = req.body || {}

  if (!nome || !preco) {
    return res.status(400).json({ 
      erro: 'nome e preco são obrigatórios para PUT (substituição completa)' 
    })
  }

  if(preco <= 0){
    return res.status(400).json({ 
      erro: 'Preço inválido' 
    })
  }

  // 3. Busca o índice (não o objeto) para poder substituir no array
  const products = await readProducts()
  const idx = products.findIndex(u => u.id === id)
  if (idx === -1) return res.status(404).json({ erro: 'Produto não encontrado' })

  // 4. SUBSTITUI o objeto inteiro — mantém id da URL, descarta o do body
  products[idx] = { id, nome, preco }
  
  // 5. Persiste e responde com recurso atualizado
  await writeProducts(products)
  res.json(products[idx])  // 200 OK
})

app.patch('/produtos/:id', async (req, res) => {
  const id = Number(req.params.id)
  const products = await readProducts()
  const product = products.find(p => p.id === id)
  if (!product) return res.status(404).json({ erro: 'Produto não encontrado' })
  
  // CORRETO: filtrar campos sensíveis ANTES do merge
  const { id: _, createdAt: __, updatedAt: ___, ...dadosPermitidos } = req.body || {}
  Object.assign(product, dadosPermitidos)

  // Valida 'nome' apenas se ele foi enviado
  if ('nome' in dadosPermitidos && !dadosPermitidos.nome) {
    return res.status(400).json({ erro: 'nome não pode ser vazio' })
  }

  // Valida 'preco' apenas se ele foi enviado
  if ('preco' in dadosPermitidos) {
    const preco = Number(dadosPermitidos.preco)
    if (isNaN(preco) || preco <= 0) {
      return res.status(400).json({ erro: 'Preço inválido' })
    }
    dadosPermitidos.preco = preco // garante que fica como number
  }
  
  // Opcional: updatedAt automático
  product.updatedAt = new Date().toISOString()
  
  await writeProducts(products)
  res.json(product)  // 200 OK com recurso mesclado
})

/* ------------------------------------------------------------------------------------- 
users hard delete e soft delete abaixo ->
*/ 

/*hard delete*/
/*
app.delete('/users/:id', async (req, res) => {
  const id = Number(req.params.id)
  const users = await readUsers()
  const idx = users.findIndex(u => u.id === id)
  if (idx === -1) return res.status(404).json({ erro: 'Usuário não encontrado' })

  users.splice(idx, 1)              // remove do array
  await writeUsers(users)
  res.status(204).end()            // 204 = sem conteúdo
})
*/

/* soft delete */
app.delete('/users/:id', async (req, res) => {
  const id = Number(req.params.id)
  const users = await readUsers()
  const user = users.find(u => u.id === id)
  if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' })
  if (user.deletedAt) return res.status(409).json({ erro: 'Já removido' })

  user.deletedAt = new Date().toISOString()  // marca remoção
  await writeUsers(users)
  res.status(204).end()
})

/* Restaurar */
app.patch('/users/:id/restore', async (req, res) => {
  const id = Number(req.params.id)
  const users = await readUsers()
  const user = users.find(u => u.id === id)
  if (!user) return res.status(404).json({ erro: 'Não encontrado' })
  user.deletedAt = null
  await writeUsers(users)
  res.json(user)
})



//rodando o servidor
app.listen(process.env.PORT, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT}`)
})