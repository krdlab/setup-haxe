# setup-haxe

This action sets up a Haxe environment for use in your workflows.

## Usage

See [action.yml](action.yml) and [.github/workflows/](.github/workflows/).

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: krdlab/setup-haxe@v1
        with:
          haxe-version: 4.2.3
      - run: |
          haxe -version
          haxelib install hxnodejs
```
