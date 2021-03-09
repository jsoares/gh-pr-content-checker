const core = require('@actions/core');
const github = require('@actions/github')
const parse = require('parse-diff')

async function run() {
  try {
    // get information on everything
    const token = core.getInput('github-token', { required: true })
    const octokit = github.getOctokit(token)
    const context = github.context

    console.log('context.payload.pull_request', context.payload.pull_request)

    // Check that the pull request description contains the required string
    const bodyContains = core.getInput('bodyContains')
    if (bodyContains && !context.payload.pull_request.body.includes(bodyContains)) {
      core.setFailed("The PR description should include " + bodyContains)
    }

    // Check that the pull request description does not contain the forbidden string
    const bodyDoesNotContain = core.getInput('bodyDoesNotContain')
    if (bodyDoesNotContain && context.payload.pull_request.body.includes(bodyDoesNotContain)) {
      core.setFailed("The PR description should not include " + bodyDoesNotContain);
    }

    // Request the pull request diff from the GitHub API
    const { data: prDiff } = await octokit.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: context.payload.pull_request.number,
      mediaType: {
        format: "diff",
      },
    });
    const files = parse(prDiff)

    // Check that no more than the specified number of files were changed
    const maxFilesChanged = core.getInput('maxFilesChanged')
    if (maxFilesChanged && files.length > maxFilesChanged) {
      core.setFailed("The PR shouldn not change more than " + maxFilesChanged + " file(s)");
    }

    // Get changed chunks
    var changes = ''
    var additions: number = 0
    files.forEach(function (file) {
      additions += file.additions
      file.chunks.forEach(function (chunk) {
        chunk.changes.forEach(function (change) {
          if (change.add) {
            changes += change.content
          }
        })
      })
    })

    // Check that no more than the specified number of lines have changed
    const maxLinesChanged = +core.getInput('maxLinesChanged')
    if (maxLinesChanged && (additions > maxLinesChanged)) {
      core.setFailed("The PR shouldn not change more than " + maxLinesChanged + " lines(s) ");
    }

    // Check that the pull request diff constains the required string
    const diffContains = core.getInput('diffContains')
    if (diffContains && !changes.includes(diffContains)) {
      core.setFailed("The PR diff should include " + diffContains);
    }

    // Check that the pull request diff does not contain the forbidden string
    const diffDoesNotContain = core.getInput('diffDoesNotContain')
    const diffDoesNotContainCount = parseInt(core.getInput('diffDoesNotContainCount') || 5, 10)

    if (diffDoesNotContain && changes.includes(diffDoesNotContain)) {
      const timesFound = (changes.match(new RegExp(diffDoesNotContain, "g")) || []).length;

      console.log('??', {
        timesFound,
        diffDoesNotContainCount
      })
      if (timesFound > diffDoesNotContainCount) {
        core.setFailed("The PR diff should not include " + diffDoesNotContain);
      }
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
