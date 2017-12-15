'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')

const repoBuildJobModule = require('../..')

describe('repo-build-job', function() {
  describe('getBuildJob', () => {
    const repoBuildJobRunner = repoBuildJobModule({plugins: []})

    it('should execute a simple job', () => {
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}, {name: 'c', path: 'ccc'}]
      const repoJob = {}

      const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

      expect(jobsThatRan.map(j => j.artifact.name)).to.eql(['a', 'b', 'c'])
    })

    it('should execute only builds that have changed files', () => {
      const artifacts = [{name: 'a', path: 'a'}, {name: 'b', path: 'b'}, {name: 'c', path: 'ccc'}]
      const repoJob = {
        filesChangedSinceLastBuild: ['a/foo.js', 'ccc/x.js', 'ccc/z.z'],
      }

      const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

      expect(jobsThatRan.map(j => j.artifact.name)).to.eql(['a', 'c'])
    })

    it('should execute builds based on dependency order', () => {
      const artifacts = [
        {name: 'b', path: 'b', dependencies: ['c']},
        {name: 'c', path: 'ccc', dependencies: ['d', 'd2']},
        {name: 'd', path: 'd', dependencies: ['a']},
        {name: 'd2', path: 'd', dependencies: []},
        {name: 'a', path: 'a'},
      ]
      const repoJob = {}

      const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

      expect(jobsThatRan.map(j => j.artifact.name)).to.eql(['d2', 'a', 'd', 'c', 'b'])
    })

    it('should not execute jobs that are dependent on a failed job', () => {
      const artifacts = [
        {name: 'b', path: 'b', dependencies: ['c']},
        {name: 'c', path: 'ccc', dependencies: ['d', 'd2']},
        {name: 'd', path: 'd', dependencies: ['a'], failBuild: true},
        {name: 'd2', path: 'd', dependencies: []},
        {name: 'a', path: 'a'},
      ]
      const repoJob = {}

      const jobsThatRan = runRepoJob(artifacts, repoJob, repoBuildJobRunner)

      expect(jobsThatRan.map(j => j.artifact.name)).to.eql(['d2', 'a', 'd'])
    })
  })
})

function runRepoJob(artifacts, repoJob, repoBuildJobRunner) {
  let jobResult = repoBuildJobRunner.getBuildSteps({
    buildContext: {initialAllArtifacts: artifacts, ...repoJob},
  })
  const jobsList = [...((jobResult.jobs || []).map(j => j.job) || [])]
  const jobsToDo = (jobResult.jobs || []).map(j => j.job) || []

  while (jobResult.jobs && jobResult.jobs.length > 0) {
    expect(jobResult.jobs.every(j => j.awaken))
    const doneJob = jobsToDo.pop()

    jobResult = repoBuildJobRunner.getBuildSteps({
      buildContext: {
        state: jobResult.state,
        initialAllArtifacts: undefined,
        awakenedFrom: {
          job: doneJob,
          result: {success: !artifacts.find(a => a.name === doneJob.artifact.name).failBuild},
        },
      },
      job: repoJob,
    })
    jobsList.push(...(jobResult.jobs || []).map(j => j.job))
    if (jobResult.jobs)
      expect(jobsToDo.map(j => j.job.artifact.name)).to.not.have.members(
        (jobResult.jobs || []).map(j => j.job.artifact.name),
      )
    jobsToDo.push(...(jobResult.jobs || []).map(j => j.job))
  }
  expect(jobsToDo).to.have.length(0)

  return jobsList
}
