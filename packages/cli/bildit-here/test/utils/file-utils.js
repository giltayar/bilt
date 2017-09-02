const fs = require('fs')
const path = require('path')
const {promisify: p} = require('util')

async function fileContents(...paths) {
  return await p(fs.readFile)(path.join(...paths), 'utf-8')
}

module.exports = {fileContents}
