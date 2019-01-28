#!/usr/bin/env node
const finder = require('../src/artifact-finder')

const dir = process.argv[2]

main().catch(err => console.error(err.stack))

async function main() {
  const artifacts = await (await finder()).findArtifacts(dir)

  process.stdout.write(JSON.stringify(artifacts, null, 2))
  process.stdout.write('\n')
}
