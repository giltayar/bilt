module.exports = process.env.CI ? {

} : {
    plugins: {
      'builder:npm': {
        artifactDefaults: {
          steps: [
            { id: 'install' },
            { id: 'link'},
            { id: 'build' },
            { id: 'test' },
          ]
        }
      }
    }
  }
