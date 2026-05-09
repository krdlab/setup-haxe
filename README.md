# setup-haxe

[![Build Status](https://github.com/krdlab/setup-haxe/actions/workflows/test.yml/badge.svg "GitHub Actions")](https://github.com/krdlab/setup-haxe/actions/workflows/test.yml)
[![License](https://img.shields.io/github/license/krdlab/setup-haxe.svg?label=license)](#license)

This action sets up a Haxe environment for use in your workflows.

## Supported combinations

| Runner OS / Arch | `haxe-version` |
| --- | --- |
| `ubuntu-latest` (x64) | stable (e.g. `4.3.7`, `3.4.7`) / `latest` (nightly) |
| `macos-latest` (Intel / Apple Silicon) | stable / `latest` |
| `windows-latest` (x64) | stable / `latest` |
| `ubuntu-24.04-arm` (Linux ARM64) | `latest` (nightly) only |

Notes:

- Linux ARM64 only works with `haxe-version: latest`. HaxeFoundation does not publish stable Haxe ARM64 archives, and Neko 2.3.x (used by Haxe 3.x / 4.0–4.2) has no ARM64 binary. Stable Haxe / Neko 2.3 on Linux ARM64 will fail with an explicit error.
- Windows ARM64 is not supported (no upstream Haxe / Neko archives).

## Usage

See [action.yml](action.yml) and [.github/workflows/](.github/workflows/).

Basic:
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: krdlab/setup-haxe@v2
        with:
          haxe-version: 4.3.7
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
      - uses: actions/checkout@v4
      - uses: krdlab/setup-haxe@v2
        with:
          haxe-version: latest  # Install 'haxe_latest.tar.gz' from https://build.haxe.org/builds/haxe/linux64/
      - run: haxe -version
```

## Caching global packages data

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: krdlab/setup-haxe@v2
        with:
          haxe-version: 4.3.7
          cache-dependency-path: 'lib.hxml'
      - run: |
          haxe -version
          haxelib install lib.hxml --always
```
