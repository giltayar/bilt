const fs = require('fs')
const path = require('path')
const {promisify} = require('util')
const makeDir = require('make-dir')

async function createSymlink(link, whichWillPointTo) {
  try {
    await promisify(fs.symlink)(whichWillPointTo, link)
  } catch (err) {
    if (err.code === 'EEXIST') {
      // dir exists (probably as symlink), needs to be deleted
      // TODO - if a real directory, we need to rimraf it
      await promisify(fs.unlink)(link)

      await createSymlink(link, whichWillPointTo)
    } else if (err.code === 'ENOENT') {
      // parent directories do not exist, need to be created
      await makeDir(path.dirname(link))

      await createSymlink(link, whichWillPointTo)
    } else {
      throw err
    }
  }
}

module.exports = {
  createSymlink
}