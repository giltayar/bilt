const fs = require('fs')
const path = require('path')

module.exports = {
  plugins: {
    "builder:npm": "@bildit/npm-build-job",
    "publisher:npm": {"@bildit/npm-publisher-with-git": {
      npmAuthenticationLine: "//registry.npmjs.org/:_authToken=faf41d9d-7071-4a7a-9369-d5a85d1017c0",
      gitAuthenticationKey: fs.readFileSync(path.join(process.env.HOME, '.ssh/id_rsa_github')),
      gitUserEmail: 'gil@tayar.org',
      gitUserName: 'Gil Tayar',
      access: 'public',
      publish: true
    }}
  },
  publish: true
}