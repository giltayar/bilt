#!/usr/bin/env node
import {main} from '../src/cli.js'

main(process.argv.slice(2), {exitOnError: true}).catch((err) => {
  console.error(err.stack || err)
  process.exit(1)
})
