const path = require('path')

module.exports = (filename, basedir) => path.relative(basedir, path.dirname(filename))
