# Reply to View

`nodebb-plugin-reply-to-view` adds traditional forum-style hidden content to NodeBB.

Authors can wrap content with BBCode-style tags:

```text
[hide]This content is visible after replying to the topic.[/hide]
[reply]This also works.[/reply]
```

Viewers can see hidden content after they have posted at least one non-deleted reply in the same topic. Topic authors, administrators, and moderators can always see it.

When a post contains hidden content, local upload attachments in that post are also hidden from viewers who have not unlocked the post.

The composer toolbar includes a lock button that wraps the current selection in `[hide]...[/hide]`. If no text is selected, it inserts a placeholder and selects it for replacement.

## Install in this workspace

The package is intended to be linked into NodeBB with the root dependency:

```json
"nodebb-plugin-reply-to-view": "file:packages/nodebb-plugin-reply-to-view"
```

After installing dependencies, enable `nodebb-plugin-reply-to-view` in the ACP or add it to `plugins:active`, rebuild assets, and restart NodeBB.

Settings are available in the ACP under **Plugins > Reply to View**.
