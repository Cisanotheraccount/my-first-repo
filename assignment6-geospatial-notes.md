# Assignment 6 - Geospatial Structure

## Project Title

Manhattan Hex MapDrop

## Aesthetic Direction

The visual direction is a dark, polished MapDrop interface: a tilted map object presented like a digital model on a glass and metal display base. The color system continues the previous NYC Rent Lines project, but the geospatial section shifts from transit-line graphics into a spatial terrain made from hexagonal columns.

## Data And Method

- Map framework: Mapbox GL JS.
- Rent source: StreetEasy Data Dashboard master report, `medianAskingRent_All.csv`.
- Time range: July 2016 through June 2026.
- Geography source: NYC Open Data 2020 Neighborhood Tabulation Areas.
- Map unit: 217 Manhattan hex cells with complete StreetEasy rent values through June 2026.
- Hex radius: 300 meters. The cells are generated as a honeycomb grid inside Manhattan residential NTA polygons so the map reads as a spatial terrain rather than a set of oversized neighborhood markers.
- Civic Center is excluded because its StreetEasy row has missing values through the endpoint of this snapshot.

Each hex stores a Manhattan cell location and inherits the rent series from the nearest StreetEasy neighborhood centroid. The time slider updates the current month, median asking rent, column height, and color. The hex map is a stylized geospatial model, not an official neighborhood boundary map.

Column height is mapped from median asking rent into an 18-420 meter data range, then displayed with a 10x vertical exaggeration in Mapbox. This intentionally turns the map into a dramatic rent-pressure terrain rather than a literal building-height model.

## Interaction

- The map opens in a 2.5D camera angle with pitch and bearing.
- Users can zoom, pan, rotate, and tilt the map with Mapbox controls and gestures.
- The slider changes the month and updates all hex column heights.
- The autoplay button loops from 2016 to 2026 in 10 seconds; users can still drag the timeline manually during playback.
- Hovering a hex shows neighborhood data.
- Clicking a hex locks the neighborhood and draws a small rent timeline.

## Reflection

A geospatial structure lets the rental study move from a citywide line chart into a situated spatial model. For my design interests, this can become a way to map how economic pressure, neighborhood identity, media infrastructure, and spatial experience are distributed through the city.
