
const express = require('express')
const initializeDB = require('./db')

const app = express()
app.use(express.json())
app.get('/', (request, response) => {
  response.send('Books REST API is running successfully')
})

let db

// GET all books with search, sorting and filters
app.get('/books', async (request, response) => {
  try {
    const {
      search_q = '',
      order_by = 'id',
      order = 'ASC',
      limit = '10',
      offset = '0',
      min_price,
      max_price
    } = request.query

    const allowedColumns = ['id', 'title', 'author', 'price']
    const sortColumn = allowedColumns.includes(order_by)
      ? order_by
      : 'id'

    const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'

    const pageLimit = Number(limit)
    const pageOffset = Number(offset)

    if (
      !Number.isInteger(pageLimit) || pageLimit < 1 ||
      !Number.isInteger(pageOffset) || pageOffset < 0
    ) {
      return response.status(400).json({
        message: 'Invalid limit or offset'
      })
    }

    const conditions = []
    const values = []

    if (search_q) {
      conditions.push('title LIKE ?')
      values.push(`%${search_q}%`)
    }

    if (min_price !== undefined) {
      if (min_price === '' || !Number.isFinite(Number(min_price))) {
        return response.status(400).json({
          message: 'Invalid minimum price'
        })
      }
      conditions.push('price >= ?')
      values.push(Number(min_price))
    }

    if (max_price !== undefined) {
      if (max_price === '' || !Number.isFinite(Number(max_price))) {
        return response.status(400).json({
          message: 'Invalid maximum price'
        })
      }
      conditions.push('price <= ?')
      values.push(Number(max_price))
    }

    if (
      min_price !== undefined &&
      max_price !== undefined &&
      Number(min_price) > Number(max_price)
    ) {
      return response.status(400).json({
        message: 'Minimum price cannot exceed maximum price'
      })
    }

    let sql = 'SELECT * FROM books'

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    sql += ` ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`

    values.push(pageLimit, pageOffset)

    const books = await db.all(sql, values)

    response.status(200).json(books)
  } catch (error) {
    response.status(500).json({
      message: 'Server error'
    })
  }
})

// GET a single book
app.get('/books/:id', async (request, response) => {
  try {
    const { id } = request.params

    const book = await db.get(
      'SELECT * FROM books WHERE id = ?',
      [id]
    )

    if (!book) {
      return response.status(404).json({
        message: 'Book not found'
      })
    }

    response.status(200).json(book)
  } catch (error) {
    response.status(500).json({
      message: 'Server error'
    })
  }
})

// POST a new book
app.post('/books', async (request, response) => {
  try {
    const { title, author, price } = request.body

    if (
      typeof title !== 'string' || !title.trim() ||
      typeof author !== 'string' || !author.trim() ||
      price === undefined || price === null ||
      typeof price === 'boolean' ||
      typeof price !== 'number' ||
      !Number.isFinite(price)
    ) {
      return response.status(400).json({
        message: 'Title, author and a numeric price are required'
      })
    }

    const result = await db.run(
      'INSERT INTO books (title, author, price) VALUES (?, ?, ?)',
      [title.trim(), author.trim(), price]
    )

    response.status(201).json({
      message: 'Book added successfully',
      bookId: result.lastID
    })
  } catch (error) {
    response.status(500).json({
      message: 'Server error'
    })
  }
})

// PUT update a book
app.put('/books/:id', async (request, response) => {
  try {
    const { title, author, price } = request.body
    const { id } = request.params

    if (
      typeof title !== 'string' || !title.trim() ||
      typeof author !== 'string' || !author.trim() ||
      typeof price !== 'number' ||
      !Number.isFinite(price)
    ) {
      return response.status(400).json({
        message: 'Title, author and a numeric price are required'
      })
    }

    const existingBook = await db.get(
      'SELECT * FROM books WHERE id = ?',
      [id]
    )

    if (!existingBook) {
      return response.status(404).json({
        message: 'Book not found'
      })
    }

    await db.run(
      'UPDATE books SET title = ?, author = ?, price = ? WHERE id = ?',
      [title.trim(), author.trim(), price, id]
    )

    response.status(200).json({
      message: 'Book updated successfully'
    })
  } catch (error) {
    response.status(500).json({
      message: 'Server error'
    })
  }
})

// DELETE a book
app.delete('/books/:id', async (request, response) => {
  try {
    const { id } = request.params

    const existingBook = await db.get(
      'SELECT * FROM books WHERE id = ?',
      [id]
    )

    if (!existingBook) {
      return response.status(404).json({
        message: 'Book not found'
      })
    }

    await db.run(
      'DELETE FROM books WHERE id = ?',
      [id]
    )

    response.status(200).json({
      message: 'Book deleted successfully'
    })
  } catch (error) {
    response.status(500).json({
      message: 'Server error'
    })
  }
})

// Start server after database initialization
async function startServer() {
  try {
    db = await initializeDB()

    const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
  } catch (error) {
    console.error('Unable to start server:', error.message)
  }
}

startServer()
