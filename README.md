# pull-request-diff-comment-action

Adds/hides diff comments on pull requests.

## Usage

```yml
name: "example"
on: [ pull_request ]

jobs:

  job:
    runs-on: ubuntu-latest
    steps:
      - uses: Brightspace/pull-request-diff-comment-action@v0.0.0
        with:
          diff-path: ./attachment.diff
          github-token: ${{secrets.GITHUB_TOKEN}}
```
