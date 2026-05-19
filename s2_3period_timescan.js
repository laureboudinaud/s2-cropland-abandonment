/**
 * Sentinel-2 Cropland Abandonment Assessment — Sahelian countries (here: Central Mali)
 * Multi-year NDVI-derived 3-period timescans (3PTS) for cropland loss severity mapping
 *
 * Description:
 *   Detects and quantifies conflict-driven cropland abandonment across central Mali
 *   using Sentinel-2 NDVI timescans (2016–2022).
 *
 *   Three-period timescan logic: each annual composite encodes three max-NDVI
 *   values aligned with the Sahelian agricultural calendar as an RGB image.
 *   Active cropland appears in colour; abandoned or bare land appears grey
 *   (dark or light depending on the type of soil).
 *
 * This script builds on the methodology published in:
 *   Boudinaud, L. and Orenstein, S. A. (2021)
 *   "Assessing Cropland Abandonment from Violent Conflict in Central Mali
 *    with Sentinel-2 and Google Earth Engine"
 *   ISPRS Archives, XLVI-4/W2-2021, pp. 9–16.
 *   https://doi.org/10.5194/isprs-archives-XLVI-4-W2-2021-9-2021
 *
 * Author: Laure Boudinaud
 * Contact: laure.boudinaud@gmail.com
 * Last updated: 2025
 */


// ═══════════════════════════════════════════════════════════════
// 0. CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// Target commune (must match admin3Name field in the adm3 asset)
var COMMUNE_NAME = "Macina"; // Other examples: "Koro", "Djenné", "Ténenkou"
var BUFFER_M     = 5e3;  // buffer around commune boundary (in metres)

// Analysis period
var YEARS        = [2016, 2017, 2018, 2019, 2020, 2021, 2022];
var BASE_YEAR    = 2016;  // pre-conflict baseline
var CRISIS_YEAR  = 2018;  // onset of major conflict escalation in central Mali

// Reference year for shared visualisation min/max parameters
var VIZ_REF_YEAR = 2020;

// Hexagon grid cell size (metres) — adjust based on AOI size
// ~2 km cells suit a commune-level study; increase for regional analysis
var HEX_CELL_SIZE_M = 2000;

// Day-of-year boundaries — Sahelian agricultural calendar
var PERIODS = {
  t1: 166,  // ~15 Jun — land preparation / early growth
  t2: 223,  // ~10 Aug — peak growing season
  t3: 259,  // ~15 Sep — late season / grain fill
  t4: 283   // ~10 Oct — harvest
};

// Colours
var PALETTE_NDVI_DIFF  = ['#d73027','#fc8d59','#fee090','#ffffbf','#91cf60','#1a9850'];
var COLOUR_AOI         = 'FF0000';
var COLOUR_ACLED       = 'ff6600';
var COLOUR_SETTLEMENTS = 'ffd700';


// ═══════════════════════════════════════════════════════════════
// 1. AREA OF INTEREST
// ═══════════════════════════════════════════════════════════════

// adm3 must be loaded as a GEE asset (see data/README.md)
var commune = adm3.filter(ee.Filter.eq("admin3Name", COMMUNE_NAME));
var aoi     = commune.geometry().buffer(BUFFER_M);

Map.centerObject(aoi, 12);
Map.addLayer(
  ee.Image().byte().paint(commune, 1, 3),
  { palette: COLOUR_AOI },
  'AOI — ' + COMMUNE_NAME
);


// ═══════════════════════════════════════════════════════════════
// 2. SENTINEL-2 FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Masks clouds and cirrus using the QA60 band.
 * Rescales reflectance to [0, 1].
 */
function maskS2clouds(img) {
  var qa            = img.select('QA60');
  var cloudBitMask  = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
               .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return img.updateMask(mask).divide(10000);
}

/**
 * Loads Sentinel-2 Harmonised collection for a given year.
 * Applies cloud masking and computes NDVI.
 */
var loadS2withNDVI = function(year) {
  var yearStr = ee.Number(year).format();
  return ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
    .filterDate(yearStr.cat('-01-01'), yearStr.cat('-12-31'))
    .filterBounds(aoi)
    .map(maskS2clouds)
    .map(function(img) {
      return img.addBands(
        img.normalizedDifference(['B8', 'B4']).rename('NDVI')
      );
    });
};

/**
 * Creates a 3-band seasonal timescan from max NDVI across three periods.
 * R = P1 (Jun–Aug), G = P2 (Aug–Sep), B = P3 (Sep–Oct)
 * Active cropland: colourful. Abandoned / bare: dark grey.
 */
var create3PTS = function(collection) {
  var p1 = collection.filter(ee.Filter.dayOfYear(PERIODS.t1, PERIODS.t2))
                     .select('NDVI').max();
  var p2 = collection.filter(ee.Filter.dayOfYear(PERIODS.t2 + 1, PERIODS.t3))
                     .select('NDVI').max();
  var p3 = collection.filter(ee.Filter.dayOfYear(PERIODS.t3 + 1, PERIODS.t4))
                     .select('NDVI').max();
  return p1.addBands(p2).addBands(p3);
};

/**
 * Computes peak-season mean NDVI for a given year (P2: Aug–Sep).
 * Used for change detection.
 */
var peakNDVI = function(collection) {
  return collection
    .filter(ee.Filter.dayOfYear(PERIODS.t2 + 1, PERIODS.t3))
    .select('NDVI')
    .mean();
};


// ═══════════════════════════════════════════════════════════════
// 3. BUILD ANNUAL TIMESCANS
// ═══════════════════════════════════════════════════════════════

var collections = {};
var timescans   = {};

YEARS.forEach(function(year) {
  collections[year] = loadS2withNDVI(year);
  timescans[year]   = create3PTS(collections[year]);
});

// Derive visualisation parameters from reference year peak-season band
var refP2  = peakNDVI(collections[VIZ_REF_YEAR]);
var vizMin = refP2.reduceRegion(ee.Reducer.min(), aoi, 100).values().getInfo();
var vizMax = refP2.reduceRegion(ee.Reducer.max(), aoi, 100).values().getInfo();
var viz    = { min: vizMin, max: vizMax };

// Add timescan layers — reference year and base year visible by default
YEARS.forEach(function(year) {
  var visible = (year === VIZ_REF_YEAR || year === BASE_YEAR);
  Map.addLayer(timescans[year].clip(aoi), viz, '3PTS ' + year, visible);
});


// ═══════════════════════════════════════════════════════════════
// 4. CHANGE DETECTION — NDVI DIFFERENCE
// ═══════════════════════════════════════════════════════════════

// Peak-season NDVI for baseline and crisis onset year
var ndvi_base   = peakNDVI(collections[BASE_YEAR]);
var ndvi_crisis = peakNDVI(collections[CRISIS_YEAR]);

// Signed difference: negative = NDVI decline = potential abandonment
var ndvi_diff = ndvi_crisis.subtract(ndvi_base).rename('NDVI_diff');

Map.addLayer(
  ndvi_diff.clip(aoi),
  { min: -0.3, max: 0.3, palette: PALETTE_NDVI_DIFF },
  'NDVI Difference (' + BASE_YEAR + ' → ' + CRISIS_YEAR + ')',
  false
);

// Binary abandonment mask: pixels with decline > threshold
var abandonment_mask = ndvi_diff.lt(-ABANDONMENT_THRESHOLD).rename('abandoned');
Map.addLayer(
  abandonment_mask.updateMask(abandonment_mask).clip(aoi),
  { palette: ['#d73027'] },
  'Abandonment Mask (>' + ABANDONMENT_THRESHOLD + ' NDVI drop)',
  false
);


// ═══════════════════════════════════════════════════════════════
// 5. HEXAGONAL GRID — ABANDONMENT SEVERITY
// ═══════════════════════════════════════════════════════════════
//
// Rationale for hexagons over points:
//   - Avoids the directional bias of rectangular grids
//   - Equal distance from each cell centre to all neighbours
//   - Better suited to diffuse, landscape-scale phenomena like cropland loss
//   - Severity is expressed as % of flagged pixels per cell, enabling
//     direct comparison across cells of equal area
//
// NOTE: GEE does not have a native hexagon grid function.
// The grid is generated externally (see python/generate_hex_grid.py)
// and uploaded as a GEE asset. An alternative is to use a square grid
// via ee.Image.pixelLonLat() or external H3 library.

// --- Option A: Load pre-generated hexagon grid from GEE asset ---
// Replace with your actual asset path after uploading
// var hex_grid = ee.FeatureCollection("users/laureboudinaud/mali_hex_grid_2km");

// --- Option B: Square grid approximation (native GEE, no upload needed) ---
// Creates a regular grid of polygons over the AOI as a fallback
var grid_image = ee.Image.pixelLonLat().reproject('EPSG:32629', null, HEX_CELL_SIZE_M);
var grid = grid_image
  .multiply(1000).int()
  .reduceToVectors({
    geometry:       aoi,
    scale:          HEX_CELL_SIZE_M,
    geometryType:   'polygon',
    eightConnected: false,
    reducer:        ee.Reducer.countEvery()
  });

// Compute % abandoned pixels per grid cell
var severity = abandonment_mask.reduceRegions({
  collection: grid,
  reducer:    ee.Reducer.mean(),  // mean of binary mask = fraction flagged
  scale:      20,                 // Sentinel-2 native resolution
  crs:        'EPSG:32629'
});

// Classify severity into four classes
var severityClassed = severity.map(function(cell) {
  var frac = ee.Number(cell.get('mean'));
  var cls = ee.Algorithms.If(frac.gt(0.50), 'High',
            ee.Algorithms.If(frac.gt(0.25), 'Medium',
            ee.Algorithms.If(frac.gt(0.10), 'Low', 'Negligible')));
  return cell.set('severity_class', cls);
});

// Style by severity fraction (continuous)
var severityViz = severity.map(function(cell) {
  var frac = ee.Number(cell.get('mean')).multiply(100);
  return cell.set('style', {
    fillColor: frac.gt(50).if('#d73027',
               frac.gt(25).if('#fc8d59',
               frac.gt(10).if('#fee090', '#ffffbf'))),
    color:     '00000044',
    width:     0.5
  });
});

Map.addLayer(severityViz.style({ styleProperty: 'style' }),
             {}, 'Abandonment Severity (hex grid)', false);

print('Severity grid sample', severityClassed.limit(5));


// ═══════════════════════════════════════════════════════════════
// 6. ACLED CONFLICT EVENTS OVERLAY
// ═══════════════════════════════════════════════════════════════
//
// ACLED data is NOT available natively in GEE.
// Workflow:
//   1. Download CSV from https://acleddata.com (free registration)
//      Filter: Country = Mali, Year = 2016–2022, Event types of interest:
//      "Battles", "Violence against civilians", "Explosions/Remote violence"
//   2. Upload to GEE as a FeatureCollection asset (via GEE Code Editor > Assets)
//      or convert to GeoJSON first using python/prepare_acled.py
//   3. Load below and uncomment

// var acled = ee.FeatureCollection("users/laureboudinaud/mali_acled_2016_2022");
//
// // Filter to violent events only (exclude protests/riots if not relevant)
// var acled_violent = acled.filter(
//   ee.Filter.inList('event_type', [
//     'Battles',
//     'Violence against civilians',
//     'Explosions/Remote violence'
//   ])
// );
//
// // Size circles by fatality count (log-scaled for readability)
// var acled_styled = acled_violent.map(function(feat) {
//   var fatalities = ee.Number(feat.get('fatalities')).add(1).log().multiply(3);
//   return feat.set('style', {
//     color:       COLOUR_ACLED,
//     fillColor:   COLOUR_ACLED + '88',
//     pointSize:   fatalities,
//     pointShape:  'circle'
//   });
// });
//
// Map.addLayer(
//   acled_styled.style({ styleProperty: 'style' }),
//   {},
//   'ACLED — Conflict Events (2016–2022)',
//   false
// );
//
// // Kernel density of conflict events (heatmap alternative)
// var acled_density = acled_violent
//   .filter(ee.Filter.bounds(aoi))
//   .reduceToImage(['fatalities'], ee.Reducer.sum())
//   .unmask(0)
//   .focal_mean({ radius: 10000, kernelType: 'gaussian', units: 'meters' });
//
// Map.addLayer(
//   acled_density.clip(aoi),
//   { min: 0, max: 50, palette: ['white', COLOUR_ACLED] },
//   'ACLED — Conflict Density (kernel)',
//   false
// );


// ═══════════════════════════════════════════════════════════════
// 7. POPULATED PLACES — OpenStreetMap
// ═══════════════════════════════════════════════════════════════
//
// OSM populated places for Mali are available via HDX:
//   https://data.humdata.org/dataset/hotosm-mali-populated-places
// Download as GeoJSON/Shapefile, then upload to GEE as an asset.
//
// Alternative: use the built-in GEE dataset for settlements
//   "FAO/GAUL/2015/level2" for admin context, or a custom upload

// var osm_places = ee.FeatureCollection("users/laureboudinaud/mali_osm_places");
//
// var places_in_aoi = osm_places.filterBounds(aoi);
//
// Map.addLayer(
//   places_in_aoi,
//   { color: COLOUR_SETTLEMENTS },
//   'Populated Places (OSM)',
//   true
// );
//
// // Label localities using gena text library
// var text  = require('users/gena/packages:text');
// var scale = Map.getScale();
//
// var labels = places_in_aoi.map(function(feat) {
//   var name     = ee.String(feat.get('name'));
//   var centroid = feat.geometry().centroid();
//   return text.draw(name, centroid, scale, {
//     fontSize:     14,
//     textColor:    'white',
//     outlineWidth: 2,
//     outlineColor: '333333'
//   });
// });
//
// Map.addLayer(ee.ImageCollection(labels), {}, 'Locality Labels');


// ═══════════════════════════════════════════════════════════════
// 8. EXPORTS
// ═══════════════════════════════════════════════════════════════

// Export NDVI difference raster
Export.image.toDrive({
  image:       ndvi_diff.clip(aoi),
  description: 'mali_' + COMMUNE_NAME + '_ndvi_diff_' + BASE_YEAR + '_' + CRISIS_YEAR,
  folder:      'GEE_Mali_CroplandAbandonment',
  scale:       20,
  crs:         'EPSG:32629',
  region:      aoi
});

// Export severity grid (with % abandoned per cell)
Export.table.toDrive({
  collection:  severityClassed,
  description: 'mali_' + COMMUNE_NAME + '_severity_grid_' + HEX_CELL_SIZE_M + 'm',
  folder:      'GEE_Mali_CroplandAbandonment',
  fileFormat:  'GeoJSON'
});

// Export abandonment mask
Export.image.toDrive({
  image:       abandonment_mask.clip(aoi).toFloat(),
  description: 'mali_' + COMMUNE_NAME + '_abandonment_mask',
  folder:      'GEE_Mali_CroplandAbandonment',
  scale:       20,
  crs:         'EPSG:32629',
  region:      aoi
});
