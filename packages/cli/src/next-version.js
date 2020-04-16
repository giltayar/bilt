'use strict'
const fs = require('fs')
const path = require('path')
const {npmNextVersion} = require('@bilt/npm-next-version')

async function nextVersion({packageDir}) {
  const packageJson = JSON.parse(
    await fs.promises.readFile(path.join(packageDir, 'package.json'), 'utf8'),
  )

  const nextVersion = await npmNextVersion({...packageJson, packageDirectory: packageDir})

  return nextVersion
}

module.exports = nextVersion
