'use strict'
const express = require('express')

const app = express()

app.get('/', (req, res) => res.send('Hello, from templatetemplate'))

module.exports = app
