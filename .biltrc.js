module.exports = process.env.CI ? {
  plugins: {
    'builder:npm': {
      artifactDefaults: {
        disabled
      }
    }
  }
} : {
    plugins: {
      'builder:npm': {
        artifactDefaults: {
          steps: [
            { id: 'reset-links'},
            { id: 'install' },
            { id: 'link'},
            { id: 'build' },
            { id: 'test' },
          ]
        }
      }
    }
  }
