#!/usr/bin/env node
'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const yargs = require('yargs')

const {npmNextVersion} = require('..')

const {updatePackageJson} = yargs
  .option('update-package-json', {
    alias: 'u',
    description: 'whether to update the package.json of a package',
    boolean: true,
    default: true,
  })
  .version()
  .strict()
  .help().argv

async function main() {
  const packageJson = JSON.parse(await p(fs.readFile)('./package.json'))

  const nextVersion = await npmNextVersion(packageJson)

  if (updatePackageJson) {
    packageJson.version = nextVersion

    await p(fs.writeFile)('./package.json', JSON.stringify(packageJson, undefined, 2))
  }
  console.log(nextVersion)
}

main().catch(err => {
  console.error(err.toString())
  process.exit(1)
})
