# Download Poly Haven (CC0) glTF models at 1k into <out>/<id>/ (keeps the include paths).
# usage: python -I scripts/props/fetch.py _ref/models id1 id2 ...
import sys, os, json, urllib.request
out = sys.argv[1]
UA = {'User-Agent': 'asset-fetch/1.0'}
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA)).read()
for mid in sys.argv[2:]:
    d = json.loads(get(f'https://api.polyhaven.com/files/{mid}'))['gltf']['1k']['gltf']
    root = os.path.join(out, mid)
    os.makedirs(root, exist_ok=True)
    files = [(os.path.basename(d['url']), d['url'])] + list((k, v['url']) for k, v in d.get('include', {}).items())
    for rel, url in files:
        p = os.path.normpath(os.path.join(root, rel))
        assert p.startswith(os.path.normpath(root)), rel
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'wb') as f: f.write(get(url))
    print(mid, len(files), 'files')
