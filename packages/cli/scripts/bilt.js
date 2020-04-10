#!/usr/bin/env node
'use strict'

const app = require('../src/cli')

app(undefined, {shouldExitOnError: true}).catch((err) => console.error(err.stack || err))
