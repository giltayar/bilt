const bilditHere = require('../src/bildit-here')

process.on('unhandledRejection', err => {
  console.log(err.stack || err)
  process.exit(2)
})

bilditHere(process.argv[2], process.argv[3]).catch(err => console.log(err.stack || err))
