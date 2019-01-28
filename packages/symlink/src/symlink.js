'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const path = require('path')
const makeDir = require('make-dir')
const rimraf = require('rimraf')

async function createSymlink(link, whichWillPointTo) {
  try {
    await p(fs.symlink)(whichWillPointTo, link)
  } catch (err) {
    if (err.code === 'EEXIST') {
      // dir exists (probably as symlink), needs to be deleted
      await p(rimraf)(link)

      await createSymlink(link, whichWillPointTo)
    } else if (err.code === 'ENOENT') {
      // parent directories do not exist, need to be created
      await makeDir(path.dirname(link))

      await createSymlink(link, whichWillPointTo)
    } else if (err.code === 'EISDIR') {
      await p(rimraf)(link)

      await createSymlink(link, whichWillPointTo)
    } else {
      throw err
    }
  }
}

module.exports = {
  createSymlink,
}
