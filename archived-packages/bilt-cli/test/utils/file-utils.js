const fs = require('fs')
const path = require('path')
const {promisify: p} = require('util')

async function fileContents(...paths) {
  return await p(fs.readFile)(path.join(...paths), 'utf-8').catch(err =>
    err.code === 'ENOENT' ? undefined : Promise.reject(err),
  )
}

async function writeFile(content, ...paths) {
  return await p(fs.writeFile)(path.join(...paths), content, 'utf-8')
}

module.exports = {fileContents, writeFile}
