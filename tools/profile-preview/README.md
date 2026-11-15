# Profile preview build scripts (moved 13 Nov 2026)

These six scripts used to sit in `site/profile-preview/`, inside the deploy folder, so the live site served them
(HTTP 200). MT asked (13 Nov 2026) to move them out of `site/` with `git mv` so nothing is lost. History is kept.

They read and write the pages next to them with plain relative paths, so run them from the pages folder:

```
cd site/profile-preview
python3 ../../tools/profile-preview/dref.py
```

`more.py` does `from gen import *`; `gen.py` was removed from `site/` on 13 Nov (commit 23ff04e9c, MT option A),
so `more.py` needs that file back beside it before it can run again.
