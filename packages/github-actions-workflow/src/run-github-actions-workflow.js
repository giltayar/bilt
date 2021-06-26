#!/usr/bin/env node
import {app} from './github-actions-workflow.js'

await app(process.argv.slice(2), {shouldExitOnError: true})
