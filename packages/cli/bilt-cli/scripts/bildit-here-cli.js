const biltHere = require('../src/bilt-cli')

process.on('unhandledRejection', err => {
  console.log(err.stack || err)
  process.exit(2)
})

biltHere(process.argv[2], process.argv[3]).catch(err => console.log(err.stack || err))
