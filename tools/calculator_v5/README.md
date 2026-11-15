# Calculator v5 demo scripts (moved 13 Nov 2026)

These six scripts (`cmp.py`, `serve.py`, `shots5.py`, `verify.py`, `video.py`, `zero_calc_patch.py`) used to sit in
`site/calculator_v5/`, inside the deploy folder, so the live site served them. MT approved moving them out of `site/`
(t1968u, 13 Nov 2026); they were moved with `git mv`, so their history is kept.

- `serve.py` changes to the folder two levels above itself (`../..`), which is the repo root both before and after the
  move, so it serves the same files as before.
- `cmp.py`, `shots5.py`, `verify.py` and `video.py` start `python3 serve.py` from the current folder and write to
  `shots/`. Run them from this folder after making a `shots/` folder here, or from `site/calculator_v5` with
  `python3 ../../tools/calculator_v5/<name>.py` after copying `serve.py` beside them. Their page URLs
  (`/design_review/...`) come from an older layout and may need updating.
- `zero_calc_patch.py` takes the target page as its first argument.
