> **Version 2:** the world, scene, repository levels, kingdom power and quests are explained in [docs/V2.md](docs/V2.md). Setup, XP, visitors, raids and safety below still apply.

# Kingdom guide

This repository is a game. Your README is a map of a small kingdom.
A GitHub Action reads your real GitHub activity and redraws the kingdom.
GitHub cannot run a game inside a README, so the world is **rebuilt** again and again, not live.

```
GitHub activity -> Action -> world-state.json -> SVG pictures -> README
```

## 1. First time setup (3 steps)

1. Upload the zip to the root of this repository and run **Import Project ZIP** (your existing workflow).
2. Open **Settings > Actions > General > Workflow permissions** and choose **Read and write permissions**.
3. Open **Actions > World update > Run workflow**. (It also starts by itself after the import.)

Wait about 1 minute. Then open your profile. The red **DEMO DATA** tag is gone when real data arrives.

**Set your time zone.** Open `kingdom.config.json` and change `"timezone"`. Use a name like `Asia/Kolkata` or `America/New_York`.
The sky (day, evening, night) follows this time zone.

**Optional: private contributions.** Make a token that can read your profile, save it as a secret named `KINGDOM_TOKEN`.
Without it, only public work is counted. Private repository names are never shown.

## 2. What runs and when

| Workflow | When | Job |
| --- | --- | --- |
| `world-update` | every 6 hours, and when you change the engine | the full update |
| `stats-update` | when a release, star or fork happens | quick update of the hero, map, events, quests and project skyline |
| `achievement-update` | once a day | check achievements again (trophy hall, hero, map, quests) |
| `visitor-update` | when a visitor opens a flag or raid form | check the form, update the camp |
| `cleanup` | once a week | keep data small, delete old workflow runs |

If nothing changed, nothing is saved. So you will not get empty commits.
Commits are made by `kingdom-bot`, so they do not count as your contributions.

## 3. The rules of the game

**XP.** Every contribution gives XP, but with limits so nobody can farm XP.

| What | XP |
| --- | --- |
| Contribution (first 5 each day / next 10 / after that) | 10 / 4 / 0, maximum 120 per day |
| Pull request (first 20 / next 80 / after) | 50 / 25 / 10 |
| Merged pull request | 100 / 50 / 20 |
| Closed issue | 25 / 12 / 5 |
| Release | 250 (100 after ten) |
| New repository | 300 (100 after fifteen) |
| Streak bonus | each day of a streak of 3 or more adds the streak length (maximum 30) |

**Levels.** Level 1 needs 100 XP, level 2 needs 250, level 3 needs 450, and so on.
(The total for level L is `25 x L x (L + 3)`.)

**Class.** It comes from your code, not from a setting.
TypeScript Paladin, Python Alchemist, JavaScript Rogue, Go Ranger, Rust Berserker, Java Mage, C++ Battle Smith, PHP Merchant.
Other languages have classes too. HTML and CSS do not count. New repositories count more than old ones.

**Hero stats.** *Code power* is your recent work (30 days). *Reliability* is your workflow success rate.
*Streak* is days in a row. *Reputation* is stars.

**Achievements.** 12 are visible: First Blood, Builder, Master Builder, Streakkeeper, Iron Streak, Night Coder, Ship It,
Open Gate, Architect, Boss Fight, Fire Fighter, Gold Rush. There are also 4 secret ones. Their names show only after they unlock.
An unlocked achievement stays forever.

**Weather.** Clear = healthy. Rain = no activity for 7 days. Storm = 2 workflows fail. Thunderstorm = 3 or more fail.
Sunrise = new activity after a long quiet time. Aurora = a release or milestone.

**Events.** Release day, workflow emergency, workflow recovered, milestone, kingdom expansion, harvest festival, boss raid, night of the stars.
An event changes the whole scene (the hero, the light, effects) and ends by itself.

**Quests.** The hero always has a current quest, made from real numbers: a streak ladder (3, 7, 14, 30, 60, 100 days), a star ladder,
clearing open issues, fixing a failing workflow, shipping a release, starting a project. A ladder step gives XP once. Repeating quests give no XP.

**Buildings.** Each repository is a building, and it grows: foundation, frame, house, specialized building, landmark (the score is in `docs/V2.md`).
It also shows its state: *active*, *building* (pushed in the last 3 days), *sleepy*, *dusty* (over 120 days),
*failing* (warning, alarm, smoke, then fire), *recovered* (firefighter, repair) or *ruins* (archived).
To choose a building type yourself, edit `"buildings"` in `kingdom.config.json` (tower, library, lab, mine, shop, workshop, house, castle).
To choose the featured projects under the map, set `"featured"` (a list of names) and `"featuredCount"`. Social links are `"links"` (https and mailto only).

## 4. Visitors and safety

Visitors use two issue forms: **Plant your flag** and **Send a goblin raid**. The bot checks every form.

- The username must be the person who opened the issue. The account must be a real user and at least 7 days old.
- Messages are short plain text (32 characters). Links, `@names`, code and strange characters are refused. Spam words can be added in `visitors.bannedWords`.
- One flag for each person. At most 15 new flags a day. At most 200 flags.
- Raids: one at a time, a pause of 6 hours between raids, one raid for each person each day. Raids are only drawings. They give no XP.
- Visitor text is never trusted. It is cleaned, and then drawn with a pixel font, so nothing can run.
- Every picture is checked before it is saved: no scripts, no outside links, no outside images.
  Only a GitHub avatar (small PNG or JPEG, checked by file signature) can be embedded.
- The workflow never puts issue text into a shell command.

To block someone, add the name to `visitors.blocked` in `kingdom.config.json`. To turn visitors off, set `"visitors": { "enabled": false }`.

## 5. If something goes wrong

- **Pictures do not change.** GitHub keeps pictures for about 5 minutes. Wait, then refresh.
- **A picture says WORLD FAILURE.** Only that picture failed. Open **Actions**, open the last run, and read the red step.
- **The Action cannot save.** Check step 2 of the setup (Read and write permissions).
- **The light at the bottom says DATA OLD or NEEDS CARE.** DATA OLD: GitHub could not be read, so the last good data is used. NEEDS CARE: a picture failed. Run `node engine/cli.mjs status` for the details.
- **Old workflows.** `projects`, `repositories` and `snake` are turned off. The old versions are in `legacy/workflows/`.

## 6. Files

```
README.md               your profile (the part between the KINGDOM markers is generated)
kingdom.config.json     your settings
engine/                 the game engine (Node.js, no installs needed)
data/                   the save files: world-state, achievements, events, visitors, history
renderer/               the pictures (SVG) that the README shows
.github/workflows/      the Actions
.github/ISSUE_TEMPLATE/ the two visitor forms
docs/V2.md               how the living world works (scoring, scene, quests, animation)
docs/preview/           sample maps and heroes for 19 worlds (every weather, season and story)
legacy/                 your old README and old workflows
```

Run it on your own computer (Node 20 or newer): `npm test`, `node engine/cli.mjs update --mock --demo` (fake data), `node engine/cli.mjs lint`, `node engine/cli.mjs status` (a detailed report),
`node engine/cli.mjs demo` (draws the 19 sample worlds).
