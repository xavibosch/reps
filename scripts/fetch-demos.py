"""Pulls two demo frames per exercise out of free-exercise-db (Unlicense,
public domain) into the app's public folder, so a fresh install already has
demos instead of 26 empty upload slots."""
import json, os, re, urllib.request, urllib.parse

CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/'
OUT = '/Users/xavibosch/Desktop/home-gym/public/exercises'
db = {e['name']: e for e in json.load(open('exdb.json'))}

# Explicit, not fuzzy: fuzzy matching happily returned the decline variant of
# the bench press and nonsense for the overhead press.
MAP = {
    'Barbell Row': 'Bent Over Barbell Row',
    'Romanian Deadlift': 'Romanian Deadlift',
    'One Arm Dumbbell Row': 'One-Arm Dumbbell Row',
    'Dumbbell Pullover': 'Straight-Arm Dumbbell Pullover',
    'Barbell Curl': 'Barbell Curl',
    'Hammer Curl': 'Hammer Curls',
    'Concentration Curl': 'Concentration Curls',
    'Barbell Bench Press': 'Barbell Bench Press - Medium Grip',
    'Incline Dumbbell Press': 'Incline Dumbbell Press',
    'Dumbbell Fly': 'Dumbbell Flyes',
    'Overhead Press': 'Standing Military Press',
    'Lateral Raise': 'Side Lateral Raise',
    'Skull Crusher': 'EZ-Bar Skullcrusher',
    'Overhead Triceps Extension': 'Seated Triceps Press',
    'Barbell Back Squat': 'Barbell Squat',
    # the dataset has no Bulgarian (rear foot elevated) variant
    'Bulgarian Split Squat': 'Split Squat with Dumbbells',
    'Dumbbell Step Up': 'Dumbbell Step Ups',
    'Barbell Hip Thrust': 'Barbell Hip Thrust',
    'Standing Calf Raise': 'Standing Calf Raises',
    # a superset: show the curl half
    'Curl into Skull Crusher': 'Barbell Curl',
}

slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
os.makedirs(OUT, exist_ok=True)

manifest = {}
for target, dbname in MAP.items():
    entry = db.get(dbname)
    if not entry:
        print(f'MISSING in db: {dbname}')
        continue
    imgs = entry.get('images', [])[:2]
    if not imgs:
        print(f'NO IMAGES: {dbname}')
        continue
    frames = []
    for i, rel in enumerate(imgs):
        dest_name = f'{slug(target)}-{i}.jpg'
        dest = os.path.join(OUT, dest_name)
        if not os.path.exists(dest):
            urllib.request.urlretrieve(CDN + urllib.parse.quote(rel), dest)
        frames.append(f'/exercises/{dest_name}')
    manifest[target] = frames
    print(f'{target:32} <- {dbname:36} {len(frames)} frames')

json.dump(manifest, open('manifest.json', 'w'), indent=1)
total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print(f'\n{len(manifest)} exercises, {total/1024:.0f} kB total')
