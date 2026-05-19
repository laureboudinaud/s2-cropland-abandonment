Assessing conflict-driven cropland abandonment in central Mali using Sentinel-2 time-series and Google Earth Engine.

---

## Overview

Violent conflict disrupts agricultural systems in ways that are nearly impossible to document on the ground. This repository contains the remote sensing pipeline used to detect and quantify cropland abandonment across conflict-affected areas of central Mali, using Sentinel-2 multispectral imagery processed in Google Earth Engine.

The core product is the **3-Period TimeScan (3PTS)** — a Red-Green-Blue composite that encodes the maximum NDVI value at three distinct phases of the Sahelian agricultural season into a single image per year. Active cropland appears in vivid colour; bare or abandoned land appears dark or grey. By comparing composites before and after the onset of violence, reductions in cultivated area become immediately visible at the locality level.

The analysis identified **493 villages with significant cropland losses** across the Mopti region in 2019 compared to pre-conflict years, with a strong spatial correlation with ACLED-registered violent events. Results were operationalised through the **Cadre Harmonisé** (the bi-annual national food security analysis framework for the Sahel), contributing to the estimation of 757,217 persons considered food insecure for the 2020 lean season.

---

## Publication & Coverage

**Peer-reviewed paper:**

> **Boudinaud, L. and Orenstein, S. A. (2021)**  
> *Assessing Cropland Abandonment from Violent Conflict in Central Mali with Sentinel-2 and Google Earth Engine.*  
> ISPRS Archives, XLVI-4/W2-2021, pp. 9–16.  
> DOI: [10.5194/isprs-archives-XLVI-4-W2-2021-9-2021](https://isprs-archives.copernicus.org/articles/XLVI-4-W2-2021/9/2021/)  
> Presented at FOSS4G 2021 Academic Track, Buenos Aires.

**Practitioner write-up:**

> **Boudinaud, L., Kamara, N. and Ibrahim, A. (2021)**  
> *Using satellite imagery in conflict-affected areas in Mali to support WFP's emergency response.*  
> Field Exchange, Issue 64. [ennonline.net/fex/64/wfpsatelliteimagery](https://www.ennonline.net/fex/64/wfpsatelliteimagery)

**Media coverage:**

- [The Guardian](https://www.theguardian.com/global-development/2020/jul/10/a-drastic-loss-satellite-imagery-reveals-malis-farmers-forced-off-land-by-militias) — *"A drastic loss": satellite imagery reveals Mali's farmers forced off land by militias* (July 2020)
- [Le Monde](https://www.lemonde.fr/afrique/visuel/2021/01/24/dans-le-centre-du-mali-des-villages-rases-par-les-violences-et-la-famine_6067424_3212.html) — *Dans le centre du Mali, des villages rasés par les violences et la famine* (January 2021)

The original GEE script associated with the paper is archived at:  
[code.earthengine.google.com/c1c5529b8f9b997a8ec2afe12d3dc95d](https://code.earthengine.google.com/c1c5529b8f9b997a8ec2afe12d3dc95d)

---

## Study Area & Context

**Region:** Mopti, central Mali (Liptako-Gourma area)  
**Period of analysis:** 2016–2022 (baseline 2016–2017; crisis onset 2018)

The Mopti region experienced a rapid escalation of intercommunal and jihadist violence from 2018, linked to the proliferation of armed groups and self-defence militias. The number of internally displaced persons in Mali grew from ~50,000 in March 2018 to nearly 240,000 two years later, with 131,150 people displaced in Mopti alone by October 2020. In this context, conventional field-based agricultural surveys became impossible to conduct safely — creating a critical information gap for humanitarian actors at the moment it was most needed.

Sentinel-2 was selected because its 10 m spatial resolution meets the CEOS minimum threshold to detect the small, non-mechanised fields that dominate the Sahelian landscape — 98% of fields in Mali are below 1.5 hectares. No existing global LCLU dataset achieved sufficient accuracy: a comparison of eight datasets found none exceeding 75% accuracy for cropland in the Sahel, with an average overestimation of cultivated areas of 170%.

---

## Methodology

### The 3-Period TimeScan (3PTS)

Inspired by the TimeScan approach (Esch et al., 2018), the 3PTS encodes cropland phenology into a single RGB composite. Each band represents the maximum NDVI value across one of three sub-periods of the Sahelian agricultural calendar:

| Band | Period | DOY | Phenological phase |
|---|---|---|---|
| **R** | ~15 Jun – 1 Aug | 166–213 | Land preparation / early growth — low NDVI |
| **G** | 2 Aug – 1 Sep | 214–244 | Peak growing season — NDVI maximum |
| **B** | 2 Sep – 15 Oct | 245–288 | Harvest — NDVI declining rapidly |

Croplands are identified by their characteristic NDVI trajectory: low early in the season, rapidly rising to a peak, then sharply declining at harvest. This temporal signature produces vivid, distinct colours on the 3PTS composite. Natural vegetation shows lower variation and appears in grey tones. Settlements and bare ground appear black throughout.

### Data

- **Sentinel-2 L1C** (top-of-atmosphere reflectance) was used in the original study rather than L2A, because L2A products were not systematically available in GEE for earlier years: 721 L1C vs 697 L2A tiles for the 2019 season; for 2016 and 2017, no L2A was available at all. A total of **2,039 Sentinel-2 tiles** were processed for the original analysis. The extended script in this repository uses `S2_HARMONIZED` with QA60 cloud masking.
- **NDVI** computed as `(B8 − B4) / (B8 + B4)` at 10 m resolution.
- **Populated places:** A dataset of **3,166 georeferenced populated sites** in Mopti was constructed from the INSTAT 2009 national census village list, augmented with OCHA Common Operational Datasets, OpenStreetMap, HRSL (Facebook/CIESIN), Google Earth, and Sentinel-2 visual inspection.
- **ACLED** conflict event data (battles, violence against civilians, explosions/remote violence), April–October 2019.

### Change detection

Rather than automated classification — which proved insufficiently reliable over the ecologically heterogeneous Sahelian landscape without adequate ground-truth — **visual interpretation** of 3PTS composites was used. Each of the 3,166 populated sites was assessed by comparing the 2019 composite against 2017 (and 2016 for confirmation or cloudy pixels). Results were validated with VHR imagery where available (60% of localities). Each site was assigned one of five change classes:

| Class | Definition |
|---|---|
| Severe decrease | > 50% cropland loss detected |
| Medium decrease | 25–50% cropland loss |
| Slight decrease | < 25% cropland loss |
| No change | No detectable change |
| Slight increase | < 25% cropland gain |

### Extended script (this repository)

This repository extends the original methodology:
- Temporal coverage extended to **2016–2022**
- **QA60 cloud masking** added (not applied in the original L1C-based analysis)
- Quantitative **NDVI difference raster** and pixel-level **abandonment mask** added
- **Hexagonal grid** for regional severity aggregation (see below)
- Commented overlays for **ACLED conflict events** and **OSM populated places**, with full upload and activation instructions

---

## Hexagonal Grid — Severity Aggregation

The script aggregates the pixel-level abandonment mask into a hexagonal grid using the [H3 library](https://h3geo.org/). Each cell reports the fraction of flagged pixels, classified into four severity levels (High / Medium / Low / Negligible).

**Why hexagons over points or rectangular grids?**  
Cropland abandonment is a diffuse, landscape-scale phenomenon — poorly represented by single locality points, and subject to directional bias in rectangular grids. Hexagonal cells have equal area, equal distance from centre to all six neighbours, and no directional bias in adjacency. This makes them the appropriate spatial unit for expressing severity as a continuous surface, and allows direct visual comparison across the region without clustering artefacts.

---

## Key Results (from the 2021 paper)

- **493 villages** with medium or severe cropland losses in 2019
- **25% of localities** in Mopti experienced cropland decline vs pre-conflict years
- Most affected cercles: **Koro, Bankass, Bandiagara, Douentza** (eastern Mopti) — 90% of violent events in Mopti during April–October 2019 occurred in these four cercles
- In **> 100 localities**, cultivation retracted from up to 10 km away from settlements to within 500 m–2 km — a spatial signature of conflict-induced field access restriction
- **Settlement damage and fire** detected in > 100 localities through Sentinel-2 composites, corroborated by ACLED event records and Human Rights Watch testimonies
- Results integrated into the **Cadre Harmonisé** (Oct 2019, Mar 2020), contributing to the estimation of 757,217 food-insecure persons for the 2020 lean season, and used by WFP to geotarget emergency food assistance
- Methodology replicated across **7 countries, > 1 million km²** by WFP Regional Bureau for West and Central Africa; also adopted by the Copernicus Emergency Management Service (CEMS) for northeast Nigeria (EMSN-063, EMSN-083)

---

## Repository Structure

```
s2-cropland-abandonment/
├── README.md
├── gee/
│   └── s2_3period_timescan.js        ← Main GEE script
├── python/
│   └── prepare_inputs.ipynb          ← H3 hex grid, ACLED prep, OSM fetch
├── data/
│   └── README.md                     ← Data sources and download instructions
├── outputs/
│   └── figures/                      ← Sample output maps (PNG)
├── requirements.txt
└── LICENSE
```

---

## Quickstart

### GEE script

Open `gee/s2_3period_timescan.js` in the [GEE Code Editor](https://code.earthengine.google.com/).  
Edit the `CONFIGURATION` block at the top (commune, years, thresholds) and run.  
ACLED and OSM overlays are commented out — activate after uploading assets (see `data/README.md`).

### Python notebook

```bash
pip install -r requirements.txt
jupyter notebook python/prepare_inputs.ipynb
```

Outputs three GeoJSON files in `data/processed/` ready for GEE asset upload:
- `mali_hex_grid.geojson` — H3 hexagonal grid over AOI
- `mali_acled_2016_2022.geojson` — filtered conflict events
- `mali_osm_places.geojson` — populated places from OpenStreetMap

---

## Limitations

- Results are qualitative — the 3PTS does not quantify cropland surface area change directly
- Visual interpretation was retained over automated classification due to insufficient ground-truth samples and the ecological heterogeneity of the Sahelian landscape; supervised/unsupervised classifications were tested but could not achieve acceptable accuracy in operational timeframes
- Environmental shocks (drought, rainfall variability) are not disaggregated from conflict effects
- ACLED completeness is limited in areas with restricted communications or information flows
- The extended script adds cloud masking not present in the original analysis — results are not directly comparable without this distinction

---

## Citation

```bibtex
@article{boudinaud2021,
  author  = {Boudinaud, Laure and Orenstein, Sacha Alex},
  title   = {Assessing Cropland Abandonment from Violent Conflict
             in Central Mali with Sentinel-2 and Google Earth Engine},
  journal = {ISPRS Archives},
  volume  = {XLVI-4/W2-2021},
  pages   = {9--16},
  year    = {2021},
  doi     = {10.5194/isprs-archives-XLVI-4-W2-2021-9-2021}
}
```

---

## Authors

**Laure Boudinaud** — Galateo Analytics | [github.com/laureboudinaud](https://github.com/laureboudinaud)  
*Formerly: WFP Regional Bureau of West and Central Africa, VAM Unit, Dakar*

**Sacha Alex Orenstein** — DaCarte, Dakar

---

## License

MIT License — see `LICENSE` for details.  
Sentinel-2 imagery: © ESA / Copernicus, CC BY 4.0.  
ACLED data: [acleddata.com](https://acleddata.com) — free for non-commercial research use with attribution.  
OSM data: © OpenStreetMap contributors, ODbL.
