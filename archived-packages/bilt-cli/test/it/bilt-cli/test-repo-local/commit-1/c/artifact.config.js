module.exports = {
  disableSteps: ['publish'],
  enableSteps: ['voodoo'],
  steps: [
    {id: 'install-install'},
    {
      id: 'voodoo',
      command: ['npm', 'run', 'voodoo'],
      condition: 'packageJson.scripts.voodoo',
    },
  ],
}
