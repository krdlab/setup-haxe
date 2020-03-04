# setup-haxe

## Usage

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
  steps:
    - run: |
        sudo apt-get update
        sudo apt-get install neko
    - uses: krdlab/setup-haxe@v1
      with:
        haxe-version: 3.4.7
    - run: haxelib install hxnodejs
```
