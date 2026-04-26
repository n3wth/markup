# will wild ponies

Five small horses in funny outfits. They wander. They make noises. Click them.

A standalone static microsite. No build step. Plain HTML/CSS/JS, SVG horses,
Web Audio synth voices.

- `index.html` — the page
- `style.css` — duotone + flat, no gradients/glows/shadows (Gas Town)
- `horses.js` — horse SVGs, audio engine, placement, animations

## Local preview

Open `index.html` directly, or:

```bash
cd apps/willwildponies
python3 -m http.server 4173
# then visit http://localhost:4173
```

## Deploy

This folder is a self-contained Vercel project. From this directory:

```bash
vercel link        # link to a new "willwildponies" Vercel project
vercel --prod      # deploy
```

Then point `willwildponies.com` at it via the Vercel project's domain settings.

### Notes for Mayor

If polecat could not stand up the Vercel project: the folder is fully static
(no build, no deps). Any of:

- `vercel deploy --prod` from `apps/willwildponies/`
- Drop the folder onto a static host (Cloudflare Pages, Netlify, S3+CF)
- Or rsync to any web root

Domain target: `willwildponies.com`.

## Aesthetic

- Duotone: deep teal `#1a4d4d` + bone cream `#efe6d2`
- Accent: muted blood `#a83232`
- Flat, no gradients, no glows, no shadows (one ground patch ellipse only)
- Folk-art / "painted by aunt" horse style — naive proportions on purpose
