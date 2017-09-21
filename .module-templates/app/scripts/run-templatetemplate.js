#!/usr/bin/env node
'use strict'

const webApp = require('../')

const server = webApp().listen(process.env.PORT || 3000, err => {
  if (err) {
    return console.error(err)
  }
  console.log(`Listening on port ${server.address().port}`)
})
