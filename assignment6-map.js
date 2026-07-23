(() => {
  "use strict";

  const container = document.querySelector("#rent-hex-map");
  const loading = document.querySelector("[data-map-loading]");
  const tokenNotice = document.querySelector("[data-map-token]");
  const monthLabel = document.querySelector("[data-map-month]");
  const slider = document.querySelector("#rent-hex-time");
  const resetButton = document.querySelector("[data-map-reset]");
  const tooltip = document.querySelector("[data-map-tooltip]");
  const fallbackPreview = document.querySelector("[data-map-preview]");
  const readout = document.querySelector("[data-map-readout]");
  const readoutRent = document.querySelector("[data-map-rent]");
  const readoutGrowth = document.querySelector("[data-map-growth]");
  const sparkline = d3.select("#hex-sparkline");

  if (!container || typeof mapboxgl === "undefined") return;

  const parseMonth = d3.timeParse("%Y-%m");
  const formatMonth = d3.timeFormat("%b %Y");
  const formatCurrency = d3.format("$,.0f");
  const formatPct = d3.format("+.1f");
  const assetVersion = "20260723-height-10x";
  const verticalExaggeration = 10;
  const initialCamera = {
    center: [-73.968, 40.788],
    zoom: 11.08,
    pitch: 60,
    bearing: -28
  };
  const fallbackStyle = {
    version: 8,
    sources: {},
    layers: [
      {
        id: "fallback-background",
        type: "background",
        paint: {
          "background-color": "#070706"
        }
      }
    ]
  };

  const publicToken = String(window.MAPBOX_ACCESS_TOKEN || "").trim();
  const hasMapboxToken = /^pk\./.test(publicToken);
  const mapOptions = {
    container,
    style: hasMapboxToken ? "mapbox://styles/mapbox/dark-v11" : fallbackStyle,
    ...initialCamera,
    minZoom: 10.15,
    maxZoom: 17,
    minPitch: 0,
    maxPitch: 82,
    maxBounds: [[-74.16, 40.58], [-73.78, 40.98]],
    antialias: true,
    preserveDrawingBuffer: true,
    interactive: true,
    scrollZoom: true,
    dragRotate: true,
    pitchWithRotate: true,
    touchZoomRotate: true,
    touchPitch: true,
    cooperativeGestures: false,
    attributionControl: hasMapboxToken,
    testMode: !hasMapboxToken
  };

  if (hasMapboxToken) {
    mapOptions.accessToken = publicToken;
  } else if (tokenNotice) {
    tokenNotice.hidden = false;
  }

  let map;
  try {
    map = new mapboxgl.Map(mapOptions);
    window.assignment6MapDrop = {
      map,
      getState: () => ({
        loaded: map.loaded(),
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
        center: map.getCenter().toArray(),
        monthIndex,
        hoveredId,
        selectedId,
        hasHexSource: Boolean(map.getSource("rent-hexes")),
        layerIds: safeLayerIds()
      })
    };
  } catch (error) {
    showFailure("Mapbox could not initialize. Add a valid public token in mapbox-config.js.");
    console.error(error);
    return;
  }

  function safeLayerIds() {
    try {
      return map.getStyle()?.layers?.map((layer) => layer.id) || [];
    } catch (error) {
      return [];
    }
  }

  map.addControl(new mapboxgl.NavigationControl({
    showCompass: true,
    showZoom: true,
    visualizePitch: true
  }), "top-right");
  map.addControl(new mapboxgl.ScaleControl({ unit: "imperial" }), "bottom-left");

  let baseHexes = null;
  let currentHexes = null;
  let boundary = null;
  let series = null;
  let monthIndex = 119;
  let hoveredId = null;
  let selectedId = null;
  let selectedPopup = null;
  let sparkResizeObserver = null;

  Promise.all([
    fetch(`data/assignment6-manhattan-rent-hex.geojson?v=${assetVersion}`).then(assertJson),
    fetch(`data/assignment6-manhattan-rent-series.json?v=${assetVersion}`).then(assertJson),
    fetch(`data/assignment6-manhattan-nta.geojson?v=${assetVersion}`).then(assertJson)
  ])
    .then(([hexData, seriesData, boundaryData]) => {
      baseHexes = hexData;
      series = prepareSeries(seriesData);
      boundary = boundaryData;
      monthIndex = series.months.length - 1;
      if (slider) {
        slider.max = String(series.months.length - 1);
        slider.value = String(monthIndex);
      }
      currentHexes = buildMonthCollection(monthIndex);
      renderFallbackPreview(monthIndex);
      map.on("load", initializeLayers);
      if (map.loaded()) initializeLayers();
    })
    .catch((error) => {
      console.error(error);
      showFailure("Could not load Assignment 6 rent or GeoJSON data.");
    });

  function assertJson(response) {
    if (!response.ok) {
      throw new Error(`${response.url} returned ${response.status}`);
    }
    return response.json();
  }

  function prepareSeries(data) {
    const rowsById = new Map(data.neighborhoods.map((row) => [row.id, row]));
    const monthDates = data.months.map(parseMonth);
    return {
      ...data,
      rowsById,
      monthDates
    };
  }

  function initializeLayers() {
    if (!currentHexes || map.getSource("rent-hexes")) return;
    loading?.remove();

    if ("setFog" in map) {
      map.setFog({
        color: "#080807",
        "high-color": "#151511",
        "horizon-blend": 0.08,
        "space-color": "#030303",
        "star-intensity": 0
      });
    }
    map.addSource("manhattan-nta", {
      type: "geojson",
      data: boundary
    });
    map.addSource("rent-hexes", {
      type: "geojson",
      data: currentHexes,
      promoteId: "id"
    });

    map.addLayer({
      id: "manhattan-soft-ground",
      type: "fill",
      source: "manhattan-nta",
      paint: {
        "fill-color": "#151511",
        "fill-opacity": hasMapboxToken ? 0.22 : 0.5
      }
    });

    map.addLayer({
      id: "manhattan-nta-outline",
      type: "line",
      source: "manhattan-nta",
      paint: {
        "line-color": "#f8f3e6",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 14, 1.5],
        "line-opacity": 0.16
      }
    });

    map.addLayer({
      id: "rent-hex-extrusion",
      type: "fill-extrusion",
      source: "rent-hexes",
      paint: {
        "fill-extrusion-base": 0,
        "fill-extrusion-height": [
          "+",
          ["*", ["get", "currentHeight"], verticalExaggeration],
          ["case", ["boolean", ["feature-state", "hover"], false], 160, 0],
          ["case", ["boolean", ["feature-state", "selected"], false], 110, 0]
        ],
        "fill-extrusion-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#ffe0a3",
          [
            "interpolate",
            ["linear"],
            ["get", "currentRent"],
            series.heightScale.lowRentReference,
            "#6ea8ff",
            (series.heightScale.lowRentReference + series.heightScale.highRentReference) / 2,
            "#d8d7cf",
            series.heightScale.highRentReference,
            "#ff7c68",
            series.heightScale.highRentReference * 1.34,
            "#ffe0a3"
          ]
        ],
        "fill-extrusion-opacity": 0.9,
        "fill-extrusion-vertical-gradient": true
      }
    });

    if (!hasMapboxToken) {
      map.addLayer({
        id: "rent-hex-footprint",
        type: "fill",
        source: "rent-hexes",
        paint: {
          "fill-color": [
            "interpolate",
            ["linear"],
            ["get", "currentRent"],
            series.heightScale.lowRentReference,
            "#6ea8ff",
            (series.heightScale.lowRentReference + series.heightScale.highRentReference) / 2,
            "#d8d7cf",
            series.heightScale.highRentReference,
            "#ff7c68",
            series.heightScale.highRentReference * 1.34,
            "#ffe0a3"
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.95,
            ["boolean", ["feature-state", "selected"], false],
            0.96,
            0.88
          ]
        }
      });
    }

    map.addLayer({
      id: "rent-hex-outline",
      type: "line",
      source: "rent-hexes",
      paint: {
        "line-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#ffffff",
          ["boolean", ["feature-state", "selected"], false],
          "#ffe0a3",
          "rgba(248, 243, 230, 0.72)"
        ],
        "line-width": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          1.35,
          ["boolean", ["feature-state", "selected"], false],
          1.6,
          0.45
        ],
        "line-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.95,
          ["boolean", ["feature-state", "selected"], false],
          0.95,
          0.48
        ]
      }
    });

    bindMapEvents();
    updateUiForMonth(monthIndex);
    renderSparkline(null);
  }

  function bindMapEvents() {
    map.on("mousemove", "rent-hex-extrusion", (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const id = feature.id || feature.properties.id;
      if (hoveredId !== id) {
        clearHover();
        hoveredId = id;
        map.setFeatureState({ source: "rent-hexes", id }, { hover: true });
      }
      map.getCanvas().style.cursor = "pointer";
      showTooltip(event, feature);
    });

    map.on("mouseleave", "rent-hex-extrusion", () => {
      map.getCanvas().style.cursor = "";
      clearHover();
      hideTooltip();
    });

    map.on("click", "rent-hex-extrusion", (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      event.preventDefault();
      lockFeature(feature, event.lngLat);
    });

    map.on("click", (event) => {
      const features = map.queryRenderedFeatures(event.point, { layers: ["rent-hex-extrusion"] });
      if (!features.length) clearSelection();
    });

    slider?.addEventListener("input", () => {
      monthIndex = Number(slider.value);
      updateSourceForMonth(monthIndex);
    });

    resetButton?.addEventListener("click", () => {
      map.easeTo({
        ...initialCamera,
        duration: 850,
        essential: false
      });
    });

    if ("ResizeObserver" in window && sparkline.node()) {
      sparkResizeObserver = new ResizeObserver(() => renderSparkline(selectedId));
      sparkResizeObserver.observe(sparkline.node());
    }
  }

  function clearHover() {
    if (hoveredId !== null && map.getSource("rent-hexes")) {
      map.setFeatureState({ source: "rent-hexes", id: hoveredId }, { hover: false });
    }
    hoveredId = null;
  }

  function clearSelection() {
    if (selectedId !== null && map.getSource("rent-hexes")) {
      map.setFeatureState({ source: "rent-hexes", id: selectedId }, { selected: false });
    }
    selectedId = null;
    selectedPopup?.remove();
    selectedPopup = null;
    updateReadout(null);
    renderSparkline(null);
  }

  function lockFeature(feature, lngLat) {
    const id = feature.id || feature.properties.id;
    if (selectedId !== null && selectedId !== id) {
      map.setFeatureState({ source: "rent-hexes", id: selectedId }, { selected: false });
    }
    selectedId = id;
    map.setFeatureState({ source: "rent-hexes", id }, { selected: true });
    updateReadout(id);
    renderSparkline(id);

    selectedPopup?.remove();
    selectedPopup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: "260px"
    })
      .setLngLat(lngLat)
      .setHTML(popupHtml(feature.properties))
      .addTo(map);
  }

  function updateSourceForMonth(index) {
    currentHexes = buildMonthCollection(index);
    map.getSource("rent-hexes")?.setData(currentHexes);
    clearHover();
    hideTooltip();
    updateUiForMonth(index);
    if (selectedId) {
      map.setFeatureState({ source: "rent-hexes", id: selectedId }, { selected: true });
      updateReadout(selectedId);
      renderSparkline(selectedId);
    } else {
      renderSparkline(null);
    }
    renderFallbackPreview(index);
  }

  function buildMonthCollection(index) {
    const month = series.months[index];
    return {
      ...baseHexes,
      features: baseHexes.features.map((feature) => {
        const row = rowForFeature(feature);
        const rent = row.rents[month];
        const growthPct = ((rent / row.baselineRent) - 1) * 100;
        return {
          ...feature,
          properties: {
            ...feature.properties,
            currentMonth: month,
            currentRent: rent,
            currentHeight: heightForRent(rent),
            growthPct: Number(growthPct.toFixed(1)),
            baselineRent: row.baselineRent,
            minRent: row.minRent,
            maxRent: row.maxRent
          }
        };
      })
    };
  }

  function heightForRent(rent) {
    const scale = series.heightScale;
    const t = clamp((rent - scale.lowRentReference) / (scale.highRentReference - scale.lowRentReference), 0, 1);
    return Math.round(scale.minHeightMeters + t * (scale.maxHeightMeters - scale.minHeightMeters));
  }

  function rowForFeature(feature) {
    return series.rowsById.get(feature.properties.sourceNeighborhoodId || feature.properties.id);
  }

  function rowForHexId(id) {
    const feature = currentHexes?.features.find((item) => item.properties.id === id);
    return feature ? rowForFeature(feature) : series.rowsById.get(id);
  }

  function updateUiForMonth(index) {
    const month = series.months[index];
    const date = parseMonth(month);
    if (monthLabel && date) monthLabel.textContent = formatMonth(date).toUpperCase();
  }

  function updateReadout(id) {
    const row = id ? rowForHexId(id) : null;
    const month = series.months[monthIndex];
    const rent = row ? row.rents[month] : null;
    const growth = row && rent ? ((rent / row.baselineRent) - 1) * 100 : null;
    const title = readout?.querySelector("strong");
    const copy = readout?.querySelector("p");

    if (title) title.textContent = row ? row.name : "Manhattan Rent Pressure";
    if (copy) {
      copy.textContent = row
        ? `Locked to ${row.name}. The column height is based on median asking rent for ${formatMonth(parseMonth(month))}.`
        : "Hover a hex for neighborhood detail. Click to lock a neighborhood and draw its rent timeline.";
    }
    if (readoutRent) readoutRent.textContent = rent ? formatCurrency(rent) : "--";
    if (readoutGrowth) readoutGrowth.textContent = growth === null ? "--" : `${formatPct(growth)}%`;
  }

  function showTooltip(event, feature) {
    if (!tooltip) return;
    const props = feature.properties;
    tooltip.innerHTML = `
      <strong>${escapeHtml(props.name)}</strong>
      <span><em>Month</em><b>${escapeHtml(props.currentMonth)}</b></span>
      <span><em>Median asking rent</em><b>${formatCurrency(Number(props.currentRent))}</b></span>
      <span><em>Since Jul 2016</em><b>${formatPct(Number(props.growthPct))}%</b></span>
    `;
    tooltip.style.left = `${event.point.x}px`;
    tooltip.style.top = `${event.point.y}px`;
    tooltip.setAttribute("aria-hidden", "false");
    tooltip.classList.add("is-visible");
  }

  function hideTooltip() {
    if (!tooltip) return;
    tooltip.setAttribute("aria-hidden", "true");
    tooltip.classList.remove("is-visible");
  }

  function popupHtml(props) {
    return `
      <strong>${escapeHtml(props.name)}</strong>
      <div>${escapeHtml(props.currentMonth)} median asking rent: ${formatCurrency(Number(props.currentRent))}</div>
      <div>Change since Jul 2016: ${formatPct(Number(props.growthPct))}%</div>
    `;
  }

  function renderSparkline(id) {
    const node = sparkline.node();
    if (!node || !series) return;
    const width = Math.max(220, node.clientWidth || 300);
    const height = 130;
    const margin = { top: 18, right: 12, bottom: 24, left: 12 };
    const months = series.months;
    const values = id ? selectedValues(id) : averageValues();
    const current = values[monthIndex];
    const dates = series.monthDates;

    sparkline.selectAll("*").remove();
    sparkline.attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height);

    const defs = sparkline.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "spark-fill")
      .attr("x1", "0")
      .attr("x2", "0")
      .attr("y1", "0")
      .attr("y2", "1");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "rgba(255, 224, 163, 0.36)");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "rgba(255, 224, 163, 0)");

    const x = d3.scaleTime()
      .domain(d3.extent(dates))
      .range([margin.left, width - margin.right]);
    const y = d3.scaleLinear()
      .domain(d3.extent(values))
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = d3.line()
      .x((_, index) => x(dates[index]))
      .y((value) => y(value))
      .curve(d3.curveCatmullRom.alpha(0.55));
    const area = d3.area()
      .x((_, index) => x(dates[index]))
      .y0(height - margin.bottom)
      .y1((value) => y(value))
      .curve(d3.curveCatmullRom.alpha(0.55));

    sparkline.append("line")
      .attr("class", "spark-axis")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", height - margin.bottom)
      .attr("y2", height - margin.bottom);

    sparkline.append("path")
      .attr("class", "spark-area")
      .attr("d", area(values));

    sparkline.append("path")
      .attr("class", "spark-line")
      .attr("d", line(values));

    sparkline.append("circle")
      .attr("class", "spark-dot")
      .attr("cx", x(dates[monthIndex]))
      .attr("cy", y(current))
      .attr("r", 4.5);

    sparkline.append("text")
      .attr("class", "spark-label")
      .attr("x", margin.left)
      .attr("y", height - 6)
      .text(months[0].slice(0, 4));

    sparkline.append("text")
      .attr("class", "spark-label")
      .attr("x", width - margin.right)
      .attr("y", height - 6)
      .attr("text-anchor", "end")
      .text(months[months.length - 1].slice(0, 4));

    sparkline.append("text")
      .attr("class", "spark-label")
      .attr("x", x(dates[monthIndex]))
      .attr("y", Math.max(12, y(current) - 10))
      .attr("text-anchor", "middle")
      .text(formatCurrency(current));
  }

  function renderFallbackPreview(index) {
    if (!fallbackPreview || hasMapboxToken || !series) return;
    const width = Math.max(420, fallbackPreview.clientWidth || 940);
    const height = Math.max(420, fallbackPreview.clientHeight || 660);
    const month = series.months[index];
    const rows = series.neighborhoods;
    const longitudes = rows.map((row) => row.center[0]);
    const latitudes = rows.map((row) => row.center[1]);
    const lonExtent = d3.extent(longitudes);
    const latExtent = d3.extent(latitudes);
    const color = d3.scaleLinear()
      .domain([
        series.heightScale.lowRentReference,
        (series.heightScale.lowRentReference + series.heightScale.highRentReference) / 2,
        series.heightScale.highRentReference,
        series.heightScale.highRentReference * 1.34
      ])
      .range(["#6ea8ff", "#d8d7cf", "#ff7c68", "#ffe0a3"])
      .clamp(true);
    const size = d3.scaleLinear()
      .domain([series.heightScale.lowRentReference, series.heightScale.highRentReference])
      .range([18, 38])
      .clamp(true);

    const project = (row) => {
      const lonT = (row.center[0] - lonExtent[0]) / (lonExtent[1] - lonExtent[0]);
      const latT = (row.center[1] - latExtent[0]) / (latExtent[1] - latExtent[0]);
      return {
        x: width * (0.16 + lonT * 0.68),
        y: height * (0.18 + (1 - latT) * 0.66)
      };
    };

    const polygons = rows
      .map((row) => {
        const rent = row.rents[month];
        const point = project(row);
        const radius = size(rent);
        const lift = 8 + clamp((heightForRent(rent) - series.heightScale.minHeightMeters) / 72, 0, 30);
        return { row, rent, point, radius, lift, fill: color(rent) };
      })
      .sort((a, b) => d3.ascending(a.point.y, b.point.y));

    const hexPoints = (x, y, radius) => d3.range(6)
      .map((step) => {
        const angle = Math.PI / 6 + step * Math.PI / 3;
        return `${(x + Math.cos(angle) * radius).toFixed(1)},${(y + Math.sin(angle) * radius).toFixed(1)}`;
      })
      .join(" ");

    const columnLines = polygons.map((item) => {
      const top = d3.range(6).map((step) => {
        const angle = Math.PI / 6 + step * Math.PI / 3;
        return [item.point.x + Math.cos(angle) * item.radius, item.point.y + Math.sin(angle) * item.radius];
      });
      return top
        .filter((_, vertexIndex) => vertexIndex % 2 === 0)
        .map(([x, y]) => `<line class="preview-column" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + item.lift).toFixed(1)}"></line>`)
        .join("");
    }).join("");

    fallbackPreview.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Local preview of Manhattan rent hex terrain">
        <defs>
          <radialGradient id="preview-glow" cx="50%" cy="48%" r="56%">
            <stop offset="0%" stop-color="rgba(248,243,230,0.22)"></stop>
            <stop offset="100%" stop-color="rgba(248,243,230,0)"></stop>
          </radialGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#preview-glow)"></rect>
        <g transform="translate(${width / 2} ${height / 2}) rotate(-14) scale(1 0.76) translate(${-width / 2} ${-height / 2})">
          ${polygons.map((item) => `<polygon class="preview-shadow" points="${hexPoints(item.point.x, item.point.y + item.lift, item.radius)}" fill="rgba(0,0,0,0.62)"></polygon>`).join("")}
          ${columnLines}
          ${polygons.map((item) => `<polygon class="preview-hex" points="${hexPoints(item.point.x, item.point.y, item.radius)}" fill="${item.fill}"></polygon>`).join("")}
        </g>
        <text class="preview-label" x="${width - 28}" y="${height - 30}" text-anchor="end">Local hex preview / add token for full Mapbox basemap</text>
      </svg>
    `;
    fallbackPreview.classList.add("is-visible");
  }

  function selectedValues(id) {
    const row = rowForHexId(id);
    return series.months.map((month) => row.rents[month]);
  }

  function averageValues() {
    return series.months.map((month) => {
      const total = series.neighborhoods.reduce((sum, row) => sum + row.rents[month], 0);
      return Math.round(total / series.neighborhoods.length);
    });
  }

  function showFailure(message) {
    if (loading) loading.textContent = message;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.addEventListener("beforeunload", () => {
    sparkResizeObserver?.disconnect();
  });
})();
