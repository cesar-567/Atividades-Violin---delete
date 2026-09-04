// src/db.js — carrega o "banco" em arquivo
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFile } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DB_PATH = join(__dirname, 'users.json')

const DB_produtos = join(__dirname, 'products.json')

// lê e devolve o array de usuários; se arquivo não existir, devolve []
export async function readUsers() {
  try {
    const raw = await readFile(DB_PATH, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    if (err.code === 'ENOENT') return []   // arquivo não existe ainda
    throw err                              // outro erro: propaga
  }
}

export async function writeUsers(users) {
  await writeFile(DB_PATH, JSON.stringify(users, null, 2), 'utf8')
}

export async function readProducts() {
  try {
    const raw = await readFile(DB_produtos, 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    if (err.code === 'ENOENT') return []   // arquivo não existe ainda
    throw err                              // outro erro: propaga
  }
}

export async function writeProducts(products) {
  await writeFile(DB_produtos, JSON.stringify(products, null, 2), 'utf8')
}