# Close the Wound

A playable version of the computer model in El-Daher et al. 2024, "Microglia are essential for tissue contraction in wound closure after brain injury in zebrafish larvae", *Life Science Alliance* 8:e202403052 ([doi:10.26508/lsa.202403052](https://doi.org/10.26508/lsa.202403052)).

You are one microglia in a slice of injured zebrafish brain. Click to crawl, press Space to pull, press C to call other microglia. Twenty hours (4 to 24 hours after injury) pass in one minute, and a thin line follows each neuron from where it started. One cell barely moves the tissue; nineteen close the wound.

The piece is being built as seven stations, one per main figure of the paper. The strip at the top lists them. Three are built:

- **Fig 1**: the paper's simulation beside the real time-lapse, in step. Click neurons to follow them; their displacement exponent is shown beside the 1.86 measured in fish, and the model's closure curve beside the measured one.
- **Fig 3**: the microglia are hidden. Mark where the neurons' tracks are heading, then reveal who is there. The timing of gathering and closure is plotted against Fig 3I.
- **Fig 4**: be a microglia in one of three fish (wild type, KI20227-treated, irf8 mutant).

The other four open a card with the finding and a panel of the figure.

**3D tissue (preview).** The last button of the strip opens the tissue the figures are being moved onto: one lobe of the optic tectum as a single soft body, with about 10,000 neuron nuclei pinned inside it, the pin's track through it, and microglia that hold the tissue within reach and shorten their hold. It uses Jelly Cells' tetrahedral mesher and XPBD solver (`src/soft/`), run in a soft regime where the result does not depend on the number of substeps. Dimensions are measured on Fig 1C; nothing is calibrated yet. Design: `../outputs/design/2026-10-06_3d-tissue.md`. Labels in the scene open cards with the paper's numbers and images.

Lengths are the model's: its tissue is about four times larger than the real one (see `../outputs/analysis/2026-10-05_port-against-fig1-fig3.md`).

Design notes: `../outputs/design/2026-10-05_figure-by-figure.md` and `2026-10-05_architecture.md`.

## What is the paper's and what is ours

| | |
|---|---|
| **The paper's** | The force balance (PhysiCell 1.7.1 repulsion and adhesion, a random walk, an elastic traction between each microglia and every other cell), its parameters (`PhysiCell_settings.xml` of [github.com/feldaher/microglia](https://github.com/feldaher/microglia)), and the starting layout of 950 neurons, 437 skin cells and 19 microglia, read back from Fig 4A. |
| **Checked** | Started from that layout, the port lands on the paper's 24 hpi panel: the outline of the neurons agrees within 1 µm (`tests/fig4a.test.ts`, `../outputs/analysis/2026-10-05_fig4-extraction.md`). |
| **Ours** | Letting microglia start idle and join when called; steering one of them; the pace (1200 times faster than life) and the tracks; the "wound closed" number, which is the share of a fixed box that neurons cover (in the paper the wound was outlined by hand, and Fig 4B is not reproduced quantitatively); the look. |

The model is two-dimensional, so the scene is a flat sheet of cells seen in 3D.

## Run

```sh
npm install
npm run dev        # http://localhost:5173/microglia-brain-repair-game/
npm test           # Gherkin scenarios (vitest), about 45 s
npm run build      # static site in dist/
```

It needs a browser with WebGPU: current Chrome or Edge, Safari 18+, or Firefox with WebGPU enabled. Without it the page shows Videos 1 and 3 of the paper instead.

| | |
|---|---|
| Click or drag on the tissue | Your cell crawls there, at the model's 3 µm/min |
| `Space` | Pull / let go |
| `C` | Call the nearest idle microglia |
| `P` · `R` · `L` · `?` | Pause · start again · labels · the welcome screen |
| Scroll | Zoom |

## How it is built

- `src/contracts.ts`: the types every layer agrees on. Units are µm and minutes.
- `src/model/`: the model, with no rendering in it. `step.ts` is one mechanics step; `params.ts` the constants with their sources; `fig4a.ts` the layout as lattice indices; `measure.ts` the wound area and repair index.
- `src/app/game.ts`: the run as a state machine (clock, the visitor's cell, who pulls). `record.ts` keeps a frame every 15 minutes and makes the measurements of Figs 1 and 3 on it; `replay.ts` plays and scrubs it. `view.ts` turns a run into spheres and lines.
- `src/soft/`: the soft-body engine, adapted from Jelly Cells. `src/tissue/`: the tectum's shape with its sources, the nuclei, the microglia's hold, the measure of the wound.
- `src/stations/`: one module per figure. `src/teach/`: the cards, the stations' texts and the curves read off the paper's figures. `src/ui/plot.ts`: the line chart.
- `src/render/scene.ts`: WebGPU. Instanced spheres, their shadows, and lines for the traction web and the wound box.
- `features/*.feature` specify the behaviour; `tests/` run them.

The stack, the page shell and the stylesheet come from [Jelly Cells](https://feldaher.github.io/jelly-cells/).

## Deploy

`.github/workflows/pages.yml` tests, builds and publishes to GitHub Pages on a push to `main`. The Vite `base` is `/microglia-brain-repair-game/`, the name of the repository ([github.com/feldaher/microglia-brain-repair-game](https://github.com/feldaher/microglia-brain-repair-game)).

## Credits

Model, figures and videos: El-Daher F, Enos SJ, Drake LK, Wehner D, Westphal M, Porter NJ, Becker CG, Becker T (2024), CC BY 4.0. PhysiCell: Ghaffarizadeh et al. 2018, *PLoS Comput Biol* 14:e1005991.
