const fs = require('fs')
const path = require('path')

module.exports = {
  plugins: {
    "builder:npm": "@bilt/npm-build-job",
  },
  publish: true
}