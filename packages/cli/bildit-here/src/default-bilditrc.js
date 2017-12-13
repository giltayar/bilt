module.exports = {
  plugins: {
    jobDispatcher: '@bildit/leveldb-job-dispatcher',
    events: '@bildit/in-memory-events',
    'agent:npm': '@bildit/host-agent',
    'agent:docker': '@bildit/host-agent',
    'agent:repository': '@bildit/host-agent',
    jobState: '@bildit/in-memory-job-state',
    'builder:repository': {package: '@bildit/repo-build-job'},
    'builder:npm': {
      package: '@bildit/npm-build-job',
      steps: [
        {
          id: 'install',
          name: 'Install',
          command: ['npm', 'install'],
        },
        {
          id: 'increment-version',
          name: 'Increment Package Version',
          command: ({nextVersion}) => [
            'npm',
            'version',
            '--no-git-tag-version',
            '--allow-same-version',
            nextVersion,
          ],
          condition: ({packageJson, shouldPublish}) => !packageJson.private && shouldPublish,
        },
        {
          id: 'build',
          name: 'Build',
          command: ['npm', 'run', 'build'],
          condition: ({packageJson}) => packageJson.scripts && packageJson.scripts.build,
        },
        {
          id: 'test',
          name: 'Test',
          command: ['npm', 'test'],
          condition: ({packageJson}) => packageJson.scripts && packageJson.scripts.test,
        },
        {
          id: 'publish',
          name: 'Publish',
          command: ({access}) => ['npm', 'publish', '--access', access],
          condition: ({packageJson, shouldPublish}) => !packageJson.private && shouldPublish,
        },
      ],
    },
    'builder:docker': {package: '@bildit/docker-build-job'},
    'binaryRunner:npm': '@bildit/npm-binary-runner',
    vcs: '@bildit/git-vcs',
    repositoryFetcher: '@bildit/noop-repository-fetcher',
    'commander:npm': '@bildit/npm-commander',
    'commander:git': '@bildit/git-commander',
  },
}
