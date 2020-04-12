#!/usr/bin/env node
'use strict'

const app = require('../src/cli')

app(process.argv.slice(2), {shouldExitOnError: true}).catch((err) => {
  console.error(err.stack || err)
  process.exit(1)
})
