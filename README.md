# setup-haxe

## Usage

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: krdlab/setup-haxe@v1
        with:
          haxe-version: 3.4.7
      - run: |
          haxe -version
          haxelib install hxnodejs
```
