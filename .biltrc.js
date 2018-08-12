module.exports = process.env.CI ? {
  plugins: {
    'builder:npm': {
      artifactDefaults: {
        steps: [
          { id: 'install' },
          { id: 'update' },
          { id: 'increment-version'},
          { id: 'build' },
          { id: 'test' },
          { id: 'publish' }
        ]
      }
    }
  }
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
