module.exports = {
  publish: false,
  steps: [
    {id: 'install'},
    {
      id: 'voodoo',
      command: ['npm', 'run', 'voodoo'],
      condition: 'packageJson.scripts.voodoo',
    },
  ],
}
