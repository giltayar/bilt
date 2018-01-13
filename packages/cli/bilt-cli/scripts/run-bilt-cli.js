const biltHere = require('../src/bilt-cli')

process.on('unhandledRejection', err => {
  console.log(err.stack || err)
  process.exit(2)
})

const args = process.argv.slice(2)

biltHere(args[0], args[1]).catch(err => console.log(err.stack || err))
