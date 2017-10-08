const fs = require('fs')
const path = require('path')

module.exports = {
  plugins: {
    "builder:npm": "@bildit/npm-build-job",
  },
  publish: true
}