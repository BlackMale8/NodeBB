# NodeBB Plugin DB Search Chinese

NodeBB 4.x compatible DB Search fork with Chinese tokenization.

This plugin keeps the current `nodebb-plugin-dbsearch` 6.x behavior and adds
Chinese tokenization before content is indexed or queried. It is intended to
replace `nodebb-plugin-dbsearch`; do not keep both search plugins active at the
same time.

## Install locally

```bash
npm install ./packages/nodebb-plugin-dbsearch-chinese --save
./nodebb reset -p nodebb-plugin-dbsearch
./nodebb activate nodebb-plugin-dbsearch-chinese
./nodebb build
```

Restart NodeBB, then open ACP > Plugins > DB Search and run `Clear Index`
followed by `Re Index`.

## Custom dictionary

Add custom terms to:

```text
packages/nodebb-plugin-dbsearch-chinese/public/userdict.utf8
```

Rebuild the search index after changing the dictionary.
