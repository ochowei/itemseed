# itch.io Devlog Publication Kit: v1.0.0 & v1.0.1

This kit contains the two ready-to-publish Devlogs for ItemSeed on itch.io:
1. **Post 1**: Initial launch announcement introducing ItemSeed v1.0.0 and its core features.
2. **Post 2**: First official update announcing v1.0.1 (Japanese localization & default light theme).

---

## Post 1: Official v1.0.0 Launch Announcement

- **Title**: `ItemSeed is Live! Free Procedural Pixel Art RPG Item Generator (v1.0.0 Launch)`
- **Type of post**: `Release announcement`

```markdown
We are thrilled to announce the official release of **ItemSeed v1.0.0** on itch.io!

If you are an indie game developer, game jammer, or RPG enthusiast, you know the struggle: you need dozens of crisp, coherent fantasy item icons for an inventory or loot system, but commissioning or hand-crafting individual 16×16 or 32×32 sprites takes hours of painstaking pixel work.

**ItemSeed** was created to solve exactly this problem. It is a lightweight, zero-dependency procedural pixel-art generator running directly in your web browser.

---

### 🎨 Inspired by a Classic: The Icon Machine Legacy

ItemSeed is directly inspired by Brian MacIntosh's pioneering [Icon Machine](https://bmaczero.itch.io/icon-machine), a beloved tool that served game makers for years. ItemSeed is an independent, clean-room modern reimplementation built on pure HTML5 Canvas and vanilla JavaScript, crafted to bring deterministic procedural generation to modern web browsers with zero installation and instant zero-build execution.

---

### ⚔️ What Makes ItemSeed Special?

#### 1. Dual Handcrafted Resolutions (32×32 & 16×16)
Most procedural tools generate high-resolution images and naively downscale them, resulting in blurry, sub-pixel artifacts that ruin retro aesthetics. In ItemSeed, 16×16 sprites are authored with **feature-folding logic**: outlines adapt, highlights simplify, and silhouettes remain instantly readable at true retro resolutions.

#### 2. Deterministic Generation ("Same Seed = Same Item")
Every item is driven by a seed string (e.g. `dragon-blade-42` or `sacred-flask-7`) powered by a Mulberry32 pseudorandom generator. A simple 20-character string reproduces the exact same sprite every single time. This means you can store entire loot tables directly in your game's source code or save files as text strings rather than bloated sprite sheets!

#### 3. Five Diverse Item Archetypes
- **Potions**: Volumetric flasks, bottles, fluid level variations, bubbles, and cork/wax/cloth stoppers.
- **Swords**: Slanted broadswords, rapiers, and curved sabers with dynamic blade highlights, crossguards, and pommels.
- **Spears**: Symmetrical tridents, harpoons, and straight lances with wrapped shafts and ferrule butt caps.
- **Shields**: Heater shields, studded tower shields, and round bucklers with ornate bosses and rim rivets.
- **Staffs**: Crescent-head, arcane-orb, and shepherd-crozier staves with embedded 4-element crystal matrices.

#### 4. 24-Cell Batch Explorer
Need inspiration? Switch to the 24-cell Batch Preview in "Any" mode to inspect dozens of procedural combinations across colors, archetypes, and materials at once. Click any tile to load it into the main canvas for fine-tuning or instant export.

#### 5. Transparent PNG Export
Export single icons with a single click (`⇩ png`). Filenames are automatically standardized (e.g., `itemseed_sword_dragon-blade-42_32x32.png`), ready to drag directly into Godot, Unity, GameMaker, or Aseprite.

---

### 📜 100% Free for Commercial Games (CC0 1.0 Universal)

We believe game creators should never have to worry about legal friction or restrictive royalty clauses:

- **Generated Artwork**: Dedicated to the public domain under **CC0 1.0 Universal**. You are free to use them in commercial games on Steam, itch.io, or mobile with **no royalties and no attribution required**.
- **Generator Engine**: Fully open source under the **MIT License** on [GitHub (ochowei/itemseed)](https://github.com/ochowei/itemseed).

---

### 🚀 What's Coming Next? (We Want Your Feedback!)

This is just the beginning of ItemSeed. We want to hear from you:
- What item categories do you need most for your games? (Bows, Helms, Rings & Amulets, Spellbooks, or Axes?)
- Would you find an automated Sprite Sheet / Atlas exporter helpful?
- What color palettes or themes would fit your game best?

Drop a comment below with your feedback, share seeds of cool items you discovered, or check out the code on [GitHub (ochowei/itemseed)](https://github.com/ochowei/itemseed).

Happy game making!
```

---

## Post 2: First Update Announcement (v1.0.1)

- **Title**: `Update v1.0.1: Japanese Localization (日本語) & Default Light Theme`
- **Type of post**: `Major update`

```markdown
Following our official launch, we are excited to roll out our very first feature update: **ItemSeed v1.0.1**!

Here is what's new in this release:

### 🇯🇵 Full Japanese Localization (日本語)
ItemSeed now includes complete Japanese language support alongside English and Traditional Chinese (`zh-Hant`). Every item type, interface label, and license tooltip has been localized using standard retro JRPG conventions (e.g., `ドット絵`, `ポーション`, `剣`, `槍`, `盾`, `杖`). The interface automatically detects Japanese browser settings or can be manually selected in the header.

### ☀️ Clean Light Theme by Default
By popular request, ItemSeed now defaults to a bright, paper-like clean canvas theme on initial visit. For developers working late at night, the Dark theme and Auto system detection remain fully supported and easily toggled via the theme selector (and saved in your local preferences).

### 🏷️ Header Version Badge
A subtle terminal-styled version badge (`v1.0.1`) is now displayed directly next to the header title, making it easy to confirm that you are running the latest build in your browser or itch.io iframe.

---

The updated web build is live now on this page. As always, all generated pixel art icons remain **CC0 1.0 Universal** and 100% free for your commercial and personal games.

Let us know what item archetypes you'd like to see in v1.1.0!
```
