# Asset LFS Policy

World Tree currently contains large PNG assets under design-related directories.

## Current Decision

No Git LFS history migration is performed.

Do not run:

```bash
git lfs migrate import --everything
```

## Future Options

If the project owner confirms Git LFS usage, future PNG additions can be scoped to asset-bank paths only, for example:

```gitattributes
design/ui-assets-bank/*.png filter=lfs diff=lfs merge=lfs -text
design/ui-assets-bank/**/*.png filter=lfs diff=lfs merge=lfs -text
```

Avoid global `*.png` unless the owner explicitly wants all future PNG files to use LFS.
