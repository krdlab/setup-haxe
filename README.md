# setup-haxe

This action sets up a Haxe environment for use in your workflows.

## Usage

See [action.yml](action.yml) and [.github/workflows/](.github/workflows/).

Basic:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: krdlab/setup-haxe@v1
        with:
          haxe-version: 4.2.5
      - run: |
          haxe -version
          haxelib install hxnodejs
```

For nigthly versions:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: krdlab/setup-haxe@v1
        with:
          haxe-version: latest  # Install 'haxe_latest.tar.gz' from https://build.haxe.org/builds/haxe/linux64/
      - run: haxe -version
```
