# setup-haxe

## Usage

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
  steps:
    - run: |
        apt-get update
        apt-get install neko
    - uses: krdlab/setup-haxe@v1
      with:
        haxe-version: 3.4.7
    - run: haxelib install hxnodejs
```
