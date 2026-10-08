#!/usr/bin/env python3
"""Bundle everything into one shareable file: model-picker.html (works by double-click)."""
import json, pathlib
d = pathlib.Path(__file__).parent
h = (d/'index.html').read_text()
css = (d/'style.css').read_text()
js = (d/'app.js').read_text()
emb = {n: json.load(open(d/n)) for n in ('models-curated.json','models-snapshot.json','github-models.json','reddit-signals.json','vendor-releases.json','forum-signals.json')}
h = h.replace('<link rel="stylesheet" href="style.css">', '<style>\n'+css+'\n</style>')
tag = '<script src="app.js"></script>'
assert tag in h
blob = json.dumps(emb).replace('</','<\\/')
h = h.replace(tag, '<script>window.__EMBED='+blob+';</script>\n<script>\n'+js.replace('</script','<\\/script')+'\n</script>')
(d/'model-picker.html').write_text(h)
print('wrote model-picker.html', len(h)//1024, 'KB')
