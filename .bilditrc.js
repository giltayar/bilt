const fs = require('fs')
const path = require('path')

module.exports = {
  plugins: {
    "builder:npm": "@bildit/npm-build-job",
    "publisher:npm": {"@bildit/npm-publisher-with-git": {
      // npmAuthenticationLine: fs.readFileSync(path.join(process.env.HOME, '.npmrc'), 'utf-8').split('\n')
      // .find(l => l.includes('authToken')),
      // gitAuthenticationKey: fs.readFileSync(path.join(process.env.HOME, '.ssh/id_rsa_github')),
      // gitUserEmail: 'gil@tayar.org',
      // gitUserName: 'Gil Tayar',
      access: 'public',
      publish: true
    }}
  },
  publish: true
}