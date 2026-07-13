(() => {
  "use strict";

  const BOROUGHS = ["Manhattan", "Queens", "Brooklyn", "Bronx", "Staten Island"];
  const COLORS = {
    Manhattan: "#e4473b",
    Queens: "#f47738",
    Brooklyn: "#f4c743",
    Bronx: "#44964a",
    "Staten Island": "#17489e"
  };
  const BADGES = {
    Manhattan: "M",
    Queens: "Q",
    Brooklyn: "BK",
    Bronx: "BX",
    "Staten Island": "SI"
  };
  const DARK_TEXT_BADGES = new Set(["Queens", "Brooklyn"]);
  const parseMonth = d3.timeParse("%Y-%m");
  const formatMonth = d3.timeFormat("%b %Y");
  const formatMonthLong = d3.timeFormat("%B %Y");
  const formatYear = d3.timeFormat("%Y");
  const formatCurrency = d3.format("$,.0f");
  const formatInteger = d3.format(",.0f");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const dom = {
    opening: document.querySelector("[data-opening-film]"),
    openingYear: document.querySelector("[data-opening-year]"),
    replayOpening: document.querySelector("[data-replay-opening]"),
    chart: d3.select("#rent-chart"),
    chartShell: document.querySelector(".chart-shell"),
    loading: document.querySelector("[data-chart-loading]"),
    error: document.querySelector("[data-chart-error]"),
    tooltip: document.querySelector("[data-chart-tooltip]"),
    currentDate: document.querySelector("[data-current-date]"),
    boardDate: document.querySelector("[data-board-date]"),
    scrubber: document.querySelector("#time-scrubber"),
    playButton: document.querySelector("[data-play-button]"),
    playIcon: document.querySelector("[data-play-icon]"),
    playLabel: document.querySelector("[data-play-label]"),
    replayChart: document.querySelector("[data-replay-chart]"),
    board: d3.select("#ranking-board"),
    routeToggles: Array.from(document.querySelectorAll(".route-toggle")),
    boardTabs: Array.from(document.querySelectorAll(".board-tab")),
    storyStops: Array.from(document.querySelectorAll(".story-stop"))
  };

  let openingInterval;
  let openingTimeout;

  function runOpening() {
    if (!dom.opening || reducedMotion) {
      dom.opening?.classList.add("is-finished");
      return;
    }

    window.clearInterval(openingInterval);
    window.clearTimeout(openingTimeout);
    document.body.classList.add("film-active");
    dom.opening.classList.remove("is-finished");
    dom.opening.classList.add("is-replaying");
    const animatedOpeningElements = dom.opening.querySelectorAll(".opening-route, .opening-copy");
    animatedOpeningElements.forEach((element) => { element.style.animation = "none"; });
    void dom.opening.offsetWidth;
    animatedOpeningElements.forEach((element) => { element.style.animation = ""; });
    dom.openingYear.textContent = "2016";

    let year = 2016;
    openingInterval = window.setInterval(() => {
      year += 1;
      dom.openingYear.textContent = String(Math.min(year, 2026));
      dom.openingYear.classList.remove("is-flipping");
      void dom.openingYear.offsetWidth;
      dom.openingYear.classList.add("is-flipping");
      if (year >= 2026) window.clearInterval(openingInterval);
    }, 165);

    openingTimeout = window.setTimeout(() => {
      dom.opening.classList.add("is-finished");
      dom.opening.classList.remove("is-replaying");
      document.body.classList.remove("film-active");
    }, 2600);
  }

  runOpening();
  dom.replayOpening?.addEventListener("click", runOpening);

  Promise.all([
    d3.csv("data/nyc-rent-lines.csv", (row) => ({
      dateKey: row.date,
      date: parseMonth(row.date),
      borough: row.borough,
      medianAskingRent: +row.medianAskingRent,
      rentalInventory: +row.rentalInventory
    })),
    d3.csv("data/nyc-vacancy-rates.csv", (row) => ({
      year: +row.year,
      vacancyRate: +row.vacancyRate,
      date: parseMonth(`${row.year}-06`)
    }))
  ])
    .then(([records, vacancyRates]) => initialize(records, vacancyRates))
    .catch((error) => showLoadError(error));

  function initialize(records, vacancyRates) {
    const dateKeys = Array.from(new Set(records.map((d) => d.dateKey))).sort();
    const months = dateKeys.map(parseMonth);
    const byBorough = new Map();

    BOROUGHS.forEach((borough) => {
      const series = records
        .filter((d) => d.borough === borough)
        .sort((a, b) => d3.ascending(a.date, b.date));
      if (series.length !== 120) {
        throw new Error(`${borough} has ${series.length} months; expected 120.`);
      }
      const baseInventory = series[0].rentalInventory;
      series.forEach((d, index) => {
        d.index = index;
        d.inventoryIndex = (d.rentalInventory / baseInventory) * 100;
      });
      byBorough.set(borough, series);
    });

    if (records.length !== 600 || months.length !== 120) {
      throw new Error(`Dataset has ${records.length} records across ${months.length} months; expected 600 and 120.`);
    }

    const state = {
      index: months.length - 1,
      playing: false,
      timer: null,
      selected: new Set(BOROUGHS),
      focus: null,
      boardMetric: "rent",
      sceneLabel: "JUN 2026 / NEW TERMINUS"
    };
    let chartRefs = null;
    let hasDrawn = false;
    let resizeFrame = null;

    const metricConfig = {
      rent: {
        label: "Asking rent",
        value: (d) => d.medianAskingRent,
        format: formatCurrency
      },
      inventory: {
        label: "Listings",
        value: (d) => d.rentalInventory,
        format: formatInteger
      },
      change: {
        label: "Change since 2016",
        value: (d) => d.changeFromBaseline,
        format: (value) => `${value >= 0 ? "+" : ""}${d3.format(".1%")(value)}`
      }
    };

    const allSeries = BOROUGHS.map((borough) => ({
      borough,
      values: byBorough.get(borough)
    }));

    function currentRows() {
      return BOROUGHS.map((borough) => {
        const current = byBorough.get(borough)[state.index];
        const baseline = byBorough.get(borough)[0];
        return {
          ...current,
          borough,
          changeFromBaseline: current.medianAskingRent / baseline.medianAskingRent - 1,
          incomeNeeded: current.medianAskingRent * 40
        };
      });
    }

    function renderChart(animate = false) {
      dom.chart.selectAll("*").remove();
      const shellWidth = Math.max(320, dom.chartShell.clientWidth || 900);
      const compact = shellWidth < 720;
      const width = shellWidth;
      const height = compact ? 560 : 620;
      const margin = {
        top: compact ? 62 : 66,
        right: compact ? 42 : 108,
        bottom: 44,
        left: compact ? 62 : 80
      };
      const innerWidth = width - margin.left - margin.right;
      const rentTop = margin.top;
      const rentBottom = compact ? 318 : 350;
      const inventoryTop = compact ? 394 : 430;
      const inventoryBottom = height - margin.bottom;
      const x = d3.scaleTime()
        .domain(d3.extent(months))
        .range([margin.left, width - margin.right]);
      const rentExtent = d3.extent(records, (d) => d.medianAskingRent);
      const yRent = d3.scaleLinear()
        .domain([
          Math.floor((rentExtent[0] - 150) / 500) * 500,
          Math.ceil((rentExtent[1] + 150) / 500) * 500
        ])
        .nice()
        .range([rentBottom, rentTop]);
      const maxInventoryIndex = d3.max(records, (d) => {
        const baseline = byBorough.get(d.borough)[0].rentalInventory;
        return (d.rentalInventory / baseline) * 100;
      });
      const yInventory = d3.scaleLinear()
        .domain([0, Math.ceil(maxInventoryIndex / 50) * 50])
        .nice()
        .range([inventoryBottom, inventoryTop]);

      dom.chart
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", width)
        .attr("height", height);

      dom.chart.append("title")
        .attr("id", "chart-title")
        .text("New York City asking rent and rental inventory, July 2016 to June 2026");
      dom.chart.append("desc")
        .attr("id", "chart-description")
        .text("Five colored borough routes compare monthly median asking rent above and rental inventory indexed to July 2016 below. A shared playhead and official vacancy markers show change over time.");

      const clipId = `progress-clip-${Math.random().toString(36).slice(2)}`;
      const defs = dom.chart.append("defs");
      const progressRect = defs.append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", margin.left - 8)
        .attr("y", rentTop - 10)
        .attr("height", inventoryBottom - rentTop + 20)
        .attr("width", Math.max(1, x(months[state.index]) - margin.left + 16));

      const yearTicks = months.filter((date, index) => {
        if (index === 0) return true;
        return date.getMonth() === 0 && date.getFullYear() % 2 === 0;
      });

      dom.chart.append("g")
        .attr("class", "chart-grid")
        .attr("transform", `translate(${margin.left},0)`)
        .call(
          d3.axisLeft(yRent)
            .ticks(compact ? 4 : 6)
            .tickSize(-innerWidth)
            .tickFormat("")
        );

      dom.chart.append("g")
        .attr("class", "chart-axis")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(yRent).ticks(compact ? 4 : 6).tickFormat((d) => `$${d3.format("~s")(d)}`));

      dom.chart.append("g")
        .attr("class", "chart-axis")
        .attr("transform", `translate(0,${inventoryBottom})`)
        .call(d3.axisBottom(x).tickValues(yearTicks).tickFormat(formatYear).tickSizeOuter(0));

      dom.chart.append("g")
        .attr("class", "chart-axis")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(yInventory).ticks(3).tickFormat((d) => `${d}`));

      dom.chart.append("line")
        .attr("class", "baseline-line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", yInventory(100))
        .attr("y2", yInventory(100));

      dom.chart.append("text")
        .attr("class", "panel-title")
        .attr("x", margin.left)
        .attr("y", rentTop - 31)
        .text("MEDIAN ASKING RENT");
      dom.chart.append("text")
        .attr("class", "panel-note")
        .attr("x", margin.left)
        .attr("y", rentTop - 17)
        .text("NOMINAL USD / MONTH");
      dom.chart.append("text")
        .attr("class", "panel-title")
        .attr("x", margin.left)
        .attr("y", inventoryTop - 29)
        .text("RENTAL INVENTORY");
      dom.chart.append("text")
        .attr("class", "panel-note")
        .attr("x", margin.left)
        .attr("y", inventoryTop - 15)
        .text("INDEX / JUL 2016 = 100");

      const sceneLabel = dom.chart.append("text")
        .attr("class", "scene-label")
        .attr("x", width - margin.right)
        .attr("y", rentTop - 18)
        .attr("text-anchor", "end")
        .text(state.sceneLabel);

      const vacancyLayer = dom.chart.append("g").attr("class", "vacancy-layer");
      const vacancy = vacancyLayer.selectAll("g")
        .data(vacancyRates)
        .join("g")
        .attr("class", "vacancy-marker")
        .attr("data-marker-index", (d) => nearestMonthIndex(d.date));

      vacancy.append("line")
        .attr("class", "vacancy-line")
        .attr("x1", (d) => x(d.date))
        .attr("x2", (d) => x(d.date))
        .attr("y1", rentTop)
        .attr("y2", inventoryBottom);
      vacancy.append("circle")
        .attr("class", "vacancy-station")
        .attr("cx", (d) => x(d.date))
        .attr("cy", rentTop + 15)
        .attr("r", 8);
      vacancy.append("rect")
        .attr("class", "vacancy-label-bg")
        .attr("x", (d) => x(d.date) - 27)
        .attr("y", (d, index) => rentTop + 27 + (compact ? (index % 2) * 23 : 0))
        .attr("width", 54)
        .attr("height", 19)
        .attr("rx", 9.5);
      vacancy.append("text")
        .attr("class", "vacancy-label")
        .attr("x", (d) => x(d.date))
        .attr("y", (d, index) => rentTop + 40 + (compact ? (index % 2) * 23 : 0))
        .attr("text-anchor", "middle")
        .text((d) => `${d.year} ${d.vacancyRate.toFixed(2)}%`);

      const rentLine = d3.line()
        .x((d) => x(d.date))
        .y((d) => yRent(d.medianAskingRent))
        .curve(d3.curveMonotoneX);
      const inventoryLine = d3.line()
        .x((d) => x(d.date))
        .y((d) => yInventory(d.inventoryIndex))
        .curve(d3.curveMonotoneX);
      const inventoryArea = d3.area()
        .x((d) => x(d.date))
        .y0(yInventory(100))
        .y1((d) => yInventory(d.inventoryIndex))
        .curve(d3.curveMonotoneX);

      const ghostLayer = dom.chart.append("g").attr("class", "ghost-layer");
      ghostLayer.selectAll(".rent-ghost")
        .data(allSeries)
        .join("path")
        .attr("class", "route-path route-ghost rent-line")
        .attr("data-route", (d) => d.borough)
        .attr("stroke", (d) => COLORS[d.borough])
        .attr("opacity", 0.13)
        .attr("d", (d) => rentLine(d.values));
      ghostLayer.selectAll(".inventory-ghost")
        .data(allSeries)
        .join("path")
        .attr("class", "route-path route-ghost inventory-line")
        .attr("data-route", (d) => d.borough)
        .attr("stroke", (d) => COLORS[d.borough])
        .attr("opacity", 0.09)
        .attr("d", (d) => inventoryLine(d.values));

      const liveLayer = dom.chart.append("g")
        .attr("class", "live-layer")
        .attr("clip-path", `url(#${clipId})`);
      liveLayer.selectAll(".inventory-area")
        .data(allSeries)
        .join("path")
        .attr("class", "inventory-area")
        .attr("data-route", (d) => d.borough)
        .attr("fill", (d) => COLORS[d.borough])
        .attr("d", (d) => inventoryArea(d.values));
      const liveRentPaths = liveLayer.selectAll(".rent-live")
        .data(allSeries)
        .join("path")
        .attr("class", "route-path route-live rent-line")
        .attr("data-route", (d) => d.borough)
        .attr("stroke", (d) => COLORS[d.borough])
        .attr("d", (d) => rentLine(d.values));
      const liveInventoryPaths = liveLayer.selectAll(".inventory-live")
        .data(allSeries)
        .join("path")
        .attr("class", "route-path route-live inventory-line")
        .attr("data-route", (d) => d.borough)
        .attr("stroke", (d) => COLORS[d.borough])
        .attr("d", (d) => inventoryLine(d.values));

      const stations = dom.chart.append("g")
        .attr("class", "station-layer")
        .selectAll("circle")
        .data(
          allSeries.flatMap(({ borough, values }) => values
            .filter((d, index) => index === 0 || index === values.length - 1 || d.date.getMonth() === 0)
            .map((d) => ({ ...d, borough })))
        )
        .join("circle")
        .attr("class", "route-path annual-station")
        .attr("data-route", (d) => d.borough)
        .attr("data-point-index", (d) => d.index)
        .attr("cx", (d) => x(d.date))
        .attr("cy", (d) => yRent(d.medianAskingRent))
        .attr("r", (d) => (d.index === 0 || d.index === months.length - 1 ? 5 : 3.5))
        .attr("fill", (d) => COLORS[d.borough]);

      const playhead = dom.chart.append("g").attr("class", "playhead");
      const playheadLine = playhead.append("line")
        .attr("class", "playhead-line")
        .attr("y1", rentTop)
        .attr("y2", inventoryBottom);
      const playheadDots = playhead.selectAll(".playhead-point")
        .data(allSeries)
        .join("g")
        .attr("class", "playhead-point")
        .attr("data-route", (d) => d.borough)
        .style("color", (d) => COLORS[d.borough]);
      playheadDots.append("circle")
        .attr("class", "playhead-halo")
        .attr("r", 8);
      playheadDots.append("circle")
        .attr("class", "playhead-dot")
        .attr("r", 5)
        .attr("fill", (d) => COLORS[d.borough]);

      const endpointLabels = dom.chart.append("g")
        .attr("class", "endpoint-layer")
        .selectAll("text")
        .data(allSeries)
        .join("text")
        .attr("class", "route-path endpoint-name")
        .attr("data-route", (d) => d.borough)
        .attr("fill", (d) => COLORS[d.borough])
        .text((d) => BADGES[d.borough]);

      const overlay = dom.chart.append("rect")
        .attr("class", "chart-overlay")
        .attr("x", margin.left)
        .attr("y", rentTop)
        .attr("width", innerWidth)
        .attr("height", inventoryBottom - rentTop)
        .attr("fill", "transparent")
        .attr("tabindex", 0)
        .attr("role", "slider")
        .attr("aria-label", "Explore the rent timeline month by month")
        .attr("aria-valuemin", 0)
        .attr("aria-valuemax", months.length - 1)
        .style("cursor", "crosshair");

      overlay
        .on("mouseenter", () => pauseTimeline())
        .on("mousemove", (event) => {
          const [pointerX] = d3.pointer(event, dom.chart.node());
          const index = nearestMonthIndex(x.invert(Math.max(margin.left, Math.min(width - margin.right, pointerX))));
          setIndex(index, false);
          showTooltip(event, index);
        })
        .on("mouseleave", () => hideTooltip())
        .on("focus", () => pauseTimeline())
        .on("keydown", (event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
          event.preventDefault();
          pauseTimeline();
          if (event.key === "Home") setIndex(0, true);
          if (event.key === "End") setIndex(months.length - 1, true);
          if (event.key === "ArrowLeft") setIndex(Math.max(0, state.index - 1), true);
          if (event.key === "ArrowRight") setIndex(Math.min(months.length - 1, state.index + 1), true);
        });

      chartRefs = {
        width,
        height,
        margin,
        x,
        yRent,
        yInventory,
        rentTop,
        inventoryBottom,
        progressRect,
        sceneLabel,
        liveRentPaths,
        liveInventoryPaths,
        stations,
        vacancy,
        playheadLine,
        playheadDots,
        endpointLabels,
        overlay
      };

      updateChartState(false);
      updateRouteStyles();
      if (animate) animateChartDraw();
    }

    function nearestMonthIndex(date) {
      const bisect = d3.bisector((d) => d).center;
      return Math.max(0, Math.min(months.length - 1, bisect(months, date)));
    }

    function updateChartState(animate = true) {
      if (!chartRefs) return;
      const duration = reducedMotion ? 0 : (state.playing ? 120 : (animate ? 420 : 0));
      const xPosition = chartRefs.x(months[state.index]);
      const labelOnLeft = state.index > months.length * 0.78;
      const transition = d3.transition().duration(duration).ease(d3.easeCubicOut);

      chartRefs.progressRect
        .interrupt()
        .transition(transition)
        .attr("width", Math.max(1, xPosition - chartRefs.margin.left + 16));
      chartRefs.playheadLine
        .interrupt()
        .transition(transition)
        .attr("x1", xPosition)
        .attr("x2", xPosition);
      chartRefs.playheadDots
        .interrupt()
        .transition(transition)
        .attr("transform", (d) => {
          const point = d.values[state.index];
          return `translate(${xPosition},${chartRefs.yRent(point.medianAskingRent)})`;
        });
      chartRefs.endpointLabels
        .interrupt()
        .transition(transition)
        .attr("x", xPosition + (labelOnLeft ? -10 : 10))
        .attr("y", (d) => chartRefs.yRent(d.values[state.index].medianAskingRent) - 9)
        .attr("text-anchor", labelOnLeft ? "end" : "start");
      chartRefs.stations
        .classed("is-future", (d) => d.index > state.index)
        .attr("opacity", (d) => d.index <= state.index ? 1 : 0.08);
      chartRefs.vacancy
        .classed("is-future", (d) => nearestMonthIndex(d.date) > state.index)
        .attr("opacity", (d) => nearestMonthIndex(d.date) <= state.index ? 1 : 0.12);
      chartRefs.sceneLabel.text(state.sceneLabel);
      chartRefs.overlay.attr("aria-valuenow", state.index).attr("aria-valuetext", formatMonthLong(months[state.index]));
    }

    function updateRouteStyles() {
      if (!chartRefs) return;
      dom.chart.selectAll("[data-route]")
        .classed("is-hidden", function () {
          return !state.selected.has(this.getAttribute("data-route"));
        })
        .classed("is-muted", function () {
          const borough = this.getAttribute("data-route");
          return Boolean(state.focus && !state.focus.has(borough));
        });

      dom.routeToggles.forEach((button) => {
        const active = state.selected.has(button.dataset.borough);
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }

    function setIndex(index, animate = true) {
      state.index = Math.max(0, Math.min(months.length - 1, Math.round(index)));
      const label = formatMonth(months[state.index]).toUpperCase();
      dom.currentDate.textContent = label;
      dom.boardDate.textContent = label;
      [dom.currentDate, dom.boardDate].forEach((element) => {
        element.classList.remove("is-flipping");
        void element.offsetWidth;
        element.classList.add("is-flipping");
      });
      dom.scrubber.value = String(state.index);
      updateChartState(animate);
      updateBoard(animate);
    }

    function playTimeline() {
      if (state.playing) {
        pauseTimeline();
        return;
      }
      if (state.index >= months.length - 1) setIndex(0, false);
      state.playing = true;
      state.focus = null;
      state.sceneLabel = "MONTHLY PLAYBACK / 2016–2026";
      updateRouteStyles();
      updatePlayButton();
      state.timer = window.setInterval(() => {
        if (state.index >= months.length - 1) {
          pauseTimeline();
          return;
        }
        setIndex(state.index + 1, true);
      }, reducedMotion ? 40 : 150);
    }

    function pauseTimeline() {
      if (state.timer) window.clearInterval(state.timer);
      state.timer = null;
      state.playing = false;
      updatePlayButton();
    }

    function updatePlayButton() {
      dom.playIcon.textContent = state.playing ? "Ⅱ" : "▶";
      dom.playLabel.textContent = state.playing ? "Pause timeline" : (state.index >= months.length - 1 ? "Replay decade" : "Play decade");
      dom.playButton.setAttribute("aria-label", state.playing ? "Pause timeline" : "Play timeline");
    }

    function animateChartDraw() {
      if (!chartRefs || reducedMotion) return;
      const paths = chartRefs.liveRentPaths.nodes().concat(chartRefs.liveInventoryPaths.nodes());
      paths.forEach((node, index) => {
        const length = node.getTotalLength();
        d3.select(node)
          .interrupt()
          .attr("stroke-dasharray", `${length} ${length}`)
          .attr("stroke-dashoffset", length)
          .transition()
          .delay((index % BOROUGHS.length) * 90)
          .duration(1500)
          .ease(d3.easeCubicInOut)
          .attr("stroke-dashoffset", 0)
          .on("end", function () {
            d3.select(this).attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
          });
      });
    }

    function showTooltip(event, index) {
      const shellRect = dom.chartShell.getBoundingClientRect();
      const rows = BOROUGHS
        .filter((borough) => state.selected.has(borough))
        .map((borough) => byBorough.get(borough)[index])
        .sort((a, b) => d3.descending(a.medianAskingRent, b.medianAskingRent));
      dom.tooltip.innerHTML = `
        <strong>${formatMonthLong(months[index])}</strong>
        ${rows.map((row) => `
          <span><i style="background:${COLORS[row.borough]}"></i>${row.borough}<b>${formatCurrency(row.medianAskingRent)} · ${formatInteger(row.rentalInventory)} listings</b></span>
        `).join("")}
      `;
      dom.tooltip.classList.add("is-visible");
      dom.tooltip.setAttribute("aria-hidden", "false");
      const proposedLeft = event.clientX - shellRect.left + 18;
      const proposedTop = event.clientY - shellRect.top + 18;
      const maxLeft = shellRect.width - Math.min(310, dom.tooltip.offsetWidth) - 12;
      const maxTop = shellRect.height - dom.tooltip.offsetHeight - 12;
      dom.tooltip.style.left = `${Math.max(10, Math.min(maxLeft, proposedLeft))}px`;
      dom.tooltip.style.top = `${Math.max(10, Math.min(maxTop, proposedTop))}px`;
    }

    function hideTooltip() {
      dom.tooltip.classList.remove("is-visible");
      dom.tooltip.setAttribute("aria-hidden", "true");
    }

    function createBoardRow(enter) {
      const row = enter.append("div").attr("class", "board-row").attr("role", "row");
      const identity = row.append("div").attr("class", "board-identity").attr("role", "cell");
      identity.append("span").attr("class", "route-disc board-disc");
      const identityCopy = identity.append("div");
      identityCopy.append("strong").attr("class", "board-borough");
      identityCopy.append("small").attr("class", "board-rank");

      const bar = row.append("div").attr("class", "board-bar").attr("role", "cell");
      bar.append("span").attr("class", "board-bar-label");
      bar.append("div").attr("class", "board-bar-track").append("span").attr("class", "board-bar-fill");

      const fields = [
        ["rent", "Asking rent"],
        ["inventory", "Listings"],
        ["change", "From 2016"],
        ["income", "Income needed"]
      ];
      fields.forEach(([key, label]) => {
        const metric = row.append("div").attr("class", `board-metric metric-${key}`).attr("role", "cell");
        metric.append("span").text(label);
        metric.append("strong").attr("data-number-key", key);
      });

      const spark = row.append("svg")
        .attr("class", "board-sparkline")
        .attr("role", "cell")
        .attr("viewBox", "0 0 170 48")
        .attr("aria-hidden", "true");
      spark.append("line").attr("class", "spark-baseline").attr("x1", 0).attr("x2", 170);
      spark.append("path").attr("class", "spark-path");
      spark.append("circle").attr("class", "spark-end").attr("r", 3.5);
      return row;
    }

    function updateBoard(animate = true) {
      const config = metricConfig[state.boardMetric];
      const rows = currentRows()
        .sort((a, b) => d3.descending(config.value(a), config.value(b)))
        .map((row, rank) => ({ ...row, rank }));
      const maxValue = Math.max(0.0001, d3.max(rows, config.value));
      const barScale = d3.scaleLinear().domain([0, maxValue]).range([0, 100]).clamp(true);
      const duration = reducedMotion ? 0 : (state.playing ? 120 : (animate ? 520 : 0));

      dom.board.select(".board-empty").remove();
      const rowJoin = dom.board.selectAll(".board-row")
        .data(rows, (d) => d.borough)
        .join(
          (enter) => createBoardRow(enter)
            .style("opacity", 0)
            .style("transform", (d) => `translateY(${d.rank * 100}px)`),
          (update) => update,
          (exit) => exit.transition().duration(duration).style("opacity", 0).remove()
        );

      rowJoin
        .style("--row-color", (d) => COLORS[d.borough])
        .classed("is-leader", (d) => d.rank === 0)
        .attr("aria-label", (d) => `${d.rank + 1}. ${d.borough}, ${config.label}: ${config.format(config.value(d))}`);

      rowJoin.select(".board-disc")
        .style("background", (d) => COLORS[d.borough])
        .style("color", (d) => DARK_TEXT_BADGES.has(d.borough) ? "#090909" : "#ffffff")
        .text((d) => BADGES[d.borough]);
      rowJoin.select(".board-borough").text((d) => d.borough);
      rowJoin.select(".board-rank").text((d) => `LINE ${String(d.rank + 1).padStart(2, "0")} / ${config.label.toUpperCase()}`);
      rowJoin.select(".board-bar-label").text((d) => `${config.label}: ${config.format(config.value(d))}`);

      rowJoin
        .interrupt()
        .transition()
        .duration(duration)
        .ease(d3.easeCubicInOut)
        .style("opacity", 1)
        .style("transform", (d) => `translateY(${d.rank * 100}px)`);

      rowJoin.select(".board-bar-fill")
        .interrupt()
        .transition()
        .duration(duration)
        .ease(d3.easeCubicOut)
        .style("width", (d) => `${barScale(Math.max(0, config.value(d)))}%`);

      const fieldFormats = {
        rent: (value) => formatCurrency(value),
        inventory: (value) => formatInteger(value),
        change: (value) => `${value >= 0 ? "+" : ""}${d3.format(".1%")(value)}`,
        income: (value) => formatCurrency(value)
      };
      const fieldValues = {
        rent: (d) => d.medianAskingRent,
        inventory: (d) => d.rentalInventory,
        change: (d) => d.changeFromBaseline,
        income: (d) => d.incomeNeeded
      };

      Object.keys(fieldFormats).forEach((key) => {
        rowJoin.select(`[data-number-key="${key}"]`).each(function (d) {
          tweenNumber(d3.select(this), fieldValues[key](d), fieldFormats[key], duration);
        });
      });

      rowJoin.each(function (row) {
        const series = byBorough.get(row.borough);
        const visible = series.slice(0, state.index + 1);
        const xSpark = d3.scaleLinear().domain([0, months.length - 1]).range([3, 167]);
        const yExtent = d3.extent(series, (d) => d.medianAskingRent);
        const ySpark = d3.scaleLinear().domain(yExtent).nice().range([43, 5]);
        const sparkLine = d3.line()
          .x((d) => xSpark(d.index))
          .y((d) => ySpark(d.medianAskingRent))
          .curve(d3.curveMonotoneX);
        const spark = d3.select(this).select(".board-sparkline");
        spark.select(".spark-baseline")
          .attr("y1", ySpark(series[0].medianAskingRent))
          .attr("y2", ySpark(series[0].medianAskingRent));
        spark.select(".spark-path")
          .interrupt()
          .transition()
          .duration(duration)
          .attr("d", sparkLine(visible));
        const end = visible[visible.length - 1];
        spark.select(".spark-end")
          .interrupt()
          .transition()
          .duration(duration)
          .attr("cx", xSpark(end.index))
          .attr("cy", ySpark(end.medianAskingRent));
      });
    }

    function tweenNumber(selection, target, formatter, duration) {
      const node = selection.node();
      const parsedPrevious = Number(node.dataset.value);
      const previous = Number.isFinite(parsedPrevious) ? parsedPrevious : target;
      selection.interrupt();
      node.textContent = formatter(previous);
      if (!duration) {
        node.textContent = formatter(target);
        node.dataset.value = String(target);
        return;
      }
      selection.transition()
        .duration(duration)
        .ease(d3.easeCubicOut)
        .tween("text", () => {
          const interpolate = d3.interpolateNumber(previous, target);
          return (t) => {
            const interpolated = interpolate(Number.isFinite(t) ? t : 1);
            const value = Number.isFinite(interpolated) ? interpolated : target;
            node.textContent = formatter(value);
            node.dataset.value = String(value);
          };
        })
        .on("end", () => {
          node.textContent = formatter(target);
          node.dataset.value = String(target);
        });
    }

    function activateStory(stop) {
      if (state.playing) return;
      dom.storyStops.forEach((item) => item.classList.toggle("is-active", item === stop));
      const index = dateKeys.indexOf(stop.dataset.storyDate);
      if (index >= 0) {
        const focus = stop.dataset.focus;
        state.focus = focus === "all" ? null : new Set(focus.split(","));
        state.sceneLabel = stop.querySelector(".stop-label")?.textContent || "NYC RENT LINES";
        updateRouteStyles();
        setIndex(index, true);
      }
    }

    function setupStoryObserver() {
      if (!("IntersectionObserver" in window)) return;
      const observer = new IntersectionObserver((entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) activateStory(visible.target);
      }, { rootMargin: "-28% 0px -38% 0px", threshold: [0.2, 0.45, 0.7] });
      dom.storyStops.forEach((stop) => observer.observe(stop));

      const chartObserver = new IntersectionObserver((entries) => {
        if (!hasDrawn && entries.some((entry) => entry.isIntersecting)) {
          hasDrawn = true;
          animateChartDraw();
          chartObserver.disconnect();
        }
      }, { threshold: 0.35 });
      chartObserver.observe(dom.chartShell);
    }

    dom.playButton.addEventListener("click", playTimeline);
    dom.replayChart.addEventListener("click", animateChartDraw);
    dom.scrubber.addEventListener("input", (event) => {
      pauseTimeline();
      state.focus = null;
      state.sceneLabel = "MANUAL TIMELINE / DRAG TO EXPLORE";
      updateRouteStyles();
      setIndex(+event.target.value, false);
    });
    dom.scrubber.addEventListener("change", (event) => setIndex(+event.target.value, true));

    dom.routeToggles.forEach((button) => {
      button.addEventListener("click", () => {
        pauseTimeline();
        const borough = button.dataset.borough;
        if (state.selected.has(borough)) {
          if (state.selected.size === 1) return;
          state.selected.delete(borough);
        } else {
          state.selected.add(borough);
        }
        updateRouteStyles();
        animateChartDraw();
      });
    });

    dom.boardTabs.forEach((button) => {
      button.addEventListener("click", () => {
        state.boardMetric = button.dataset.boardMetric;
        dom.boardTabs.forEach((tab) => {
          const active = tab === button;
          tab.classList.toggle("is-active", active);
          tab.setAttribute("aria-pressed", String(active));
        });
        updateBoard(true);
      });
    });

    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => renderChart(false));
    });
    resizeObserver.observe(dom.chartShell);

    renderChart(false);
    updateBoard(false);
    setIndex(months.length - 1, false);
    updatePlayButton();
    setupStoryObserver();
    dom.loading.classList.add("is-hidden");
  }

  function showLoadError(error) {
    console.error(error);
    dom.loading?.classList.add("is-hidden");
    dom.error.hidden = false;
    dom.error.textContent = "The local CSV files could not be loaded. Open this page through a local server rather than as a file.";
  }
})();
