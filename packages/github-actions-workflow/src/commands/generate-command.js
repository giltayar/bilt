import yaml from 'js-yaml'
import fs from 'fs/promises'
/**
 *
 * @param {{'template-workflow-file': string}} options
 */
export async function generateCommand({'template-workflow-file': templateWorkflowFile}) {
  const biltPackageInfosOutput = JSON.parse((await readStream(process.stdin)).toString('utf-8'))

  const workflowTemplate = await yaml.load(await fs.readFile(templateWorkflowFile, 'utf8'), {
    filename: templateWorkflowFile,
  })

  console.log(transformWorkflowTemplate(workflowTemplate, biltPackageInfosOutput.packages))
}

/**
 * @param {NodeJS.ReadStream} stream
 */
async function readStream(stream) {
  let buffer = Buffer.from('')

  for await (const chunk of stream) {
    buffer += chunk
  }

  return buffer
}

/**
 * @param {any} workflowTemplate
 * @param {{
 *    name: string;
 *    directory: import('@bilt/types').RelativeDirectoryPath;
 *    dependencies: string[];
 *  }[]
 * } packages
 */
function transformWorkflowTemplate(workflowTemplate, packages) {
  return {
    ...workflowTemplate,
    'generateBuildInformation-template': undefined,
    generateBuildInformation: transformGenerateBuildInformationTemplate(
      workflowTemplate['generateBuildInformation-template'],
    ),
    ...generateBuildJobs(workflowTemplate['build-template'], packages),
  }
}

/**
 * @param {any} template
 */
function transformGenerateBuildInformationTemplate(template) {
  return template
}

/**
 * @param {any} template
 * @param {{
 *    name: string;
 *    directory: import('@bilt/types').RelativeDirectoryPath;
 *    dependencies: string[];
 *  }[]
 * } packages
 * @returns {object}
 */
function generateBuildJobs(template, packages) {
  return Object.fromEntries(
    packages.map((pkg) => {
      const packageNameNormalized = normalizeToGithubActionsId(pkg.name)
      return [
        `build-${packageNameNormalized}`,
        {
          ...template,
          name: template.name.replaceAll('$packageNames', pkg.name),
          needs: pkg.dependencies.map((d) => `build-${normalizeToGithubActionsId(d)}`),
          steps: template.steps((/** @type {any} */ step) =>
            step.name !== 'Build'
              ? step
              : {
                  ...step,
                  run: step.run.replaceAll('$packageNames', pkg.name),
                },
          ),
        },
      ]
    }),
  )
}
/**
 * @param {string} name
 */
function normalizeToGithubActionsId(name) {
  return name.replaceAll('/', '__').replaceAll(/[^a-zA-Z\-_]/, '_')
}
