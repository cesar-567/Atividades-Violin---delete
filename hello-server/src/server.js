import app from "./app.js"
import dotenv from "dotenv";
import express from 'express';
import { readProducts, readUsers } from './db.js'
import { writeUsers, writeProducts } from "./db.js";
import { findAll, findById, create, update, remove, patch, restore } from '../services/users.js'

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

function nextId(users) {
  return users.length ? Math.max(...users.map(u => u.id)) + 1 : 1
}

//involvendo usuarios
app.get('/users', async (req, res) => {
  const users = await readUsers()
  res.json(findAll(users))
})

app.post('/users', async (req, res) => {
  const users = await readUsers()
  const result = create(users, req.body)
  if (!result.ok) return res.status(400).json({ erro: result.erro })
  await writeUsers(result.users)
  res.status(201).json(result.data)
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
    res.json(produtos.filter(p => !p.deletedAt))
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
  const users = await readUsers()
  const result = update(users, req.params.id, req.body)
  if (!result.ok) return res.status(result.status).json({ erro: result.erro })
  await writeUsers(result.users)
  res.json(result.data)
})

app.patch('/users/:id', async (req, res) => {
  const users = await readUsers()
  const result = patch(users, req.params.id, req.body)
  if (!result.ok) return res.status(result.status).json({ erro: result.erro })
  await writeUsers(result.users)
  res.json(result.data)
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
  const users = await readUsers()
  const result = remove(users, req.params.id)
  if (!result.ok) return res.status(result.status).json({ erro: result.erro })
  await writeUsers(result.users)
  res.status(204).end()
})

/* Restaurar */
app.patch('/users/:id/restore', async (req, res) => {
  const users = await readUsers()
  const result = restore(users, req.params.id)
  if (!result.ok) return res.status(result.status).json({ erro: result.erro })
  await writeUsers(result.users)
  res.json(result.data)
})

/* Deletes dos products */

/* Hard delete */
/*
app.delete('/produtos/:id', async (req, res) => {
  const id = Number(req.params.id)
  const products = await readProducts()
  const idx = products.findIndex(p => p.id === id)
  if (idx === -1) return res.status(404).json({ erro: 'Produto não encontrado' })

  products.splice(idx, 1)              // remove do array
  await writeProducts(products)
  res.status(204).end()            // 204 = sem conteúdo
})
*/
/* Soft delete */
app.delete('/produtos/:id', async (req, res) => {
  const id = Number(req.params.id)
  const force = req.query.force
  const products = await readProducts()
  const product = products.find(p => p.id === id)
  const idx = products.findIndex(p => p.id === id)
  if (!product) return res.status(404).json({ erro: 'Produto não encontrado' })

  if(force){
    products.splice(idx, 1)              // remove do array
  await writeProducts(products)
  res.status(204).end()
  }
  
  if (product.deletedAt) return res.status(409).json({ erro: 'Já removido' })

  product.deletedAt = new Date().toISOString()  // marca remoção
  await writeProducts(products)
  res.status(204).end()
})


//rodando o servidor
app.listen(process.env.PORT, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT}`)
})