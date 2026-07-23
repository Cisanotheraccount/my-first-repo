# My First Repo

Course website for Computational Design Practices.

Live site: https://cisanotheraccount.github.io/my-first-repo/

## Assignment 2

This repo includes an updated website template created through AI-assisted coding.

- `index.html` contains the one-page website.
- `style.css` defines the Apple-like Soft Glass Workflow visual system.
- `script.js` keeps the original button interaction.
- `aesthetic-style.md` documents the aesthetic style for the assignment.

The original `hello-world.txt` file is preserved from the first GitHub assignment.

## Assignment 4 — NYC Rent Lines

`assignment4.html` is a standalone D3.js temporal visualization of monthly New York City asking rents and rental inventory from July 2016 through June 2026.

- `assignment4.css` defines the cinematic New York subway visual system.
- `assignment4.js` builds the synchronized D3 timeline, playback controls, scrollytelling stops, tooltips, and animated borough ranking board.
- `data/nyc-rent-lines.csv` contains 600 monthly borough records from the StreetEasy Data Dashboard.
- `data/nyc-vacancy-rates.csv` contains official 2017, 2021, and 2023 citywide vacancy markers from the NYC Housing and Vacancy Survey.
- `submission/assignment4-submission.jpg` is the ready-to-upload D3 timeline screenshot; `submission/assignment4-data-board.jpg` documents the animated ranking view.

Because the visualization loads local CSV files, run the repository through a local web server rather than opening the HTML file directly.

## Assignment 5 — NYC Rent Pressure Network

The relational structure is added inside `assignment4.html#relational-network`.

- `assignment5-network.js` builds the D3 force-directed network.
- `assignment5.css` styles the network, tooltip, filters, and readout panel.
- `data/assignment5-nodes.csv` and `data/assignment5-edges.csv` define the relational dataset.

## Assignment 6 — Manhattan Hex MapDrop

The geospatial structure is added inside `assignment4.html#geospatial-map`.

- `assignment6-map.js` builds the Mapbox GL JS map, timeline slider, hex extrusion layer, hover tooltip, click popup, and sparkline.
- `assignment6.css` styles the MapDrop interface.
- `mapbox-config.js` is where a public Mapbox access token can be added.
- `data/assignment6-manhattan-rent-hex.geojson` stores the stylized hex geography.
- `data/assignment6-manhattan-rent-series.json` stores the StreetEasy monthly rent series.
- `data/assignment6-manhattan-nta.geojson` stores the Manhattan NTA reference geometry from NYC Open Data.
- `assignment6-geospatial-notes.md` documents the aesthetic, data method, interaction, and reflection.
- `submission/assignment6-mapdrop-final-local.png` is the ready-to-upload screenshot of the Mapbox update.
