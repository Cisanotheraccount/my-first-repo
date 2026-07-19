(() => {
  "use strict";

  const shell = document.querySelector("[data-network-shell]");
  const svg = d3.select("#pressure-network");

  if (!shell || svg.empty()) return;

  const tooltip = document.querySelector("[data-network-tooltip]");
  const readout = document.querySelector("[data-network-readout]");
  const loading = document.querySelector("[data-network-loading]");
  const error = document.querySelector("[data-network-error]");
  const filterButtons = Array.from(document.querySelectorAll("[data-network-filter]"));
  const resetButton = document.querySelector("[data-network-reset]");

  const nodeDetails = {
    nyc_market: "The complete rental system from Assignment 4: five borough routes, 120 months, 600 observations.",
    manhattan: "June 2026 asking rent: $4,965. Ten-year increase: 46%. Peak inventory: 40,359 listings in August 2020.",
    brooklyn: "June 2026 asking rent: $3,900. Ten-year increase: 44%. Peak inventory: 25,152 listings in September 2020.",
    queens: "June 2026 asking rent: $3,350. Ten-year increase: 45%. Peak inventory: 7,777 listings in October 2020.",
    bronx: "June 2026 asking rent: $2,995. Ten-year increase: 76%, the fastest percentage growth in the dataset.",
    staten_island: "June 2026 asking rent: $3,300. Ten-year increase: 61%. Smaller listing counts make the line more volatile.",
    asking_rent: "Monthly median asking rent from StreetEasy listings. This is a market signal, not rent paid by all existing tenants.",
    rent_growth: "Change from July 2016 baseline to June 2026. Bronx and Staten Island show the strongest percentage growth.",
    rent_pressure: "A synthetic relationship node that gathers high rent, fast growth, tight vacancy, and rebound pressure.",
    rental_inventory: "Listings available at any point in the month. Assignment 4 indexed inventory to July 2016.",
    inventory_shock: "A supply surge signal. Manhattan, Brooklyn, and Queens show the clearest pandemic-era inventory spike.",
    vacancy_tightness: "Citywide tightness from the Housing and Vacancy Survey. The 2023 net rental vacancy rate is 1.41%.",
    event_2020_shock: "Pandemic market disruption: central borough inventory rose sharply as demand shifted.",
    event_2021_trough: "Rent trough: Manhattan fell to $2,750 in January 2021; Queens reached $2,000 in the same month.",
    event_2022_rebound: "Rapid rebound: asking rents accelerated as inventory contracted.",
    event_2023_vacancy_low: "Official checkpoint: 2023 HVS reports a 1.41% net rental vacancy rate.",
    event_2026_terminus: "New terminus: every borough arrives above its July 2016 baseline."
  };

  const badgeLabels = {
    manhattan: "M",
    brooklyn: "BK",
    queens: "Q",
    bronx: "BX",
    staten_island: "SI",
    nyc_market: "NYC"
  };

  const categoryColors = {
    System: "#f8f3e6",
    Borough: "#f8f3e6",
    Rent: "#ff8f7d",
    Supply: "#8ccf92",
    Vacancy: "#91a8ff",
    Events: "#f8f3e6"
  };

  function radiusFromSize(size) {
    return Math.max(12, Math.round(size * 0.62));
  }

  let allNodes = [];
  let allLinks = [];
  let simulation = null;
  let zoomBehavior = null;
  let activeFilter = "all";
  let focusedId = null;
  let resizeFrame = null;
  let currentNodeSelection = null;
  let currentLinkSelection = null;
  let currentLinks = [];
  let currentNodes = [];

  Promise.all([
    d3.csv("data/assignment5-nodes.csv", (row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      value: +row.age,
      department: row.department,
      connections: +row.friends,
      radius: radiusFromSize(+row.size),
      color: row.color
    })),
    d3.csv("data/assignment5-edges.csv", (row, index) => ({
      source: row.source,
      target: row.target,
      relationship: row.relationship,
      detail: row.course,
      since: row.since ? +row.since : null,
      strength: +row.strength,
      type: row.type,
      department: row.department,
      curve: ((index % 5) - 2) * 6
    }))
  ])
    .then(([nodes, links]) => {
      allNodes = nodes;
      allLinks = links;
      loading?.remove();
      render();
    })
    .catch((loadError) => {
      console.error(loadError);
      if (loading) loading.textContent = "Network data could not load.";
      if (error) {
        error.hidden = false;
        error.textContent = "Could not load Assignment 5 nodes and edges CSV files.";
      }
    });

  function cloneData() {
    return {
      nodes: allNodes.map((node) => ({ ...node })),
      links: allLinks.map((link) => ({ ...link }))
    };
  }

  function render() {
    if (!allNodes.length || !allLinks.length) return;
    if (simulation) simulation.stop();
    svg.selectAll("*").remove();

    const width = Math.max(340, shell.clientWidth || 980);
    const compact = width < 720;
    const height = compact ? 600 : 640;
    const { nodes, links } = cloneData();

    seedPositions(nodes, width, height, compact);

    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height)
      .attr("role", "img")
      .attr("aria-labelledby", "network-title network-description");

    svg.append("title")
      .attr("id", "network-title")
      .text("NYC Rent Pressure Network");

    svg.append("desc")
      .attr("id", "network-description")
      .text("A D3 force-directed relational graph connecting New York City boroughs, rent growth, inventory shock, vacancy tightness, and key rental-market events.");

    const defs = svg.append("defs");
    Object.entries(categoryColors).forEach(([category, color]) => {
      defs.append("marker")
        .attr("id", `arrow-${category.toLowerCase()}`)
        .attr("viewBox", "0 -3.5 7 7")
        .attr("refX", 6.4)
        .attr("refY", 0)
        .attr("markerWidth", 7)
        .attr("markerHeight", 7)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-2.5L6.4,0L0,2.5")
        .attr("fill", color);
    });

    const glow = defs.append("filter")
      .attr("id", "network-glow")
      .attr("x", "-80%")
      .attr("y", "-80%")
      .attr("width", "260%")
      .attr("height", "260%");
    glow.append("feGaussianBlur")
      .attr("stdDeviation", "3.5")
      .attr("result", "blur");
    glow.append("feMerge")
      .selectAll("feMergeNode")
      .data(["blur", "SourceGraphic"])
      .join("feMergeNode")
      .attr("in", (d) => d);

    svg.append("rect")
      .attr("class", "network-hit-surface")
      .attr("width", width)
      .attr("height", height)
      .on("click", clearFocus);

    const zoomRoot = svg.append("g").attr("class", "network-zoom-root");
    const frame = zoomRoot.append("g").attr("class", "network-frame");
    const linkLayer = zoomRoot.append("g").attr("class", "network-links");
    const nodeLayer = zoomRoot.append("g").attr("class", "network-nodes");

    drawFrame(frame, width, height, compact);

    zoomBehavior = d3.zoom()
      .scaleExtent([0.62, 3])
      .on("zoom", (event) => {
        zoomRoot.attr("transform", event.transform);
      });

    svg.call(zoomBehavior).on("dblclick.zoom", null);

    const link = linkLayer.selectAll("path")
      .data(links)
      .join("path")
      .attr("class", "network-link")
      .attr("stroke", (d) => categoryColors[d.department] || "#ffffff")
      .attr("stroke-width", (d) => 0.75 + d.strength * 3.2)
      .attr("marker-end", (d) => d.type === "directed" ? `url(#arrow-${d.department.toLowerCase()})` : null)
      .on("pointerenter", (event, d) => showLinkTooltip(event, d))
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip);

    const node = nodeLayer.selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", (d) => `network-node node-${d.role}`)
      .call(d3.drag()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded))
      .on("pointerenter", (event, d) => showNodeTooltip(event, d))
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip)
      .on("click", (event, d) => {
        event.stopPropagation();
        focusedId = focusedId === d.id ? null : d.id;
        updateReadout(d);
        applyVisualState(node, link, links);
      });

    currentNodeSelection = node;
    currentLinkSelection = link;
    currentLinks = links;
    currentNodes = nodes;

    node.append("circle")
      .attr("class", "node-halo")
      .attr("r", (d) => d.radius + 5)
      .attr("fill", (d) => d.color)
      .attr("filter", "url(#network-glow)");

    node.append("circle")
      .attr("class", "node-core")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => d.color)
      .attr("stroke", (d) => categoryColors[d.department] || "#ffffff");

    node.append("text")
      .attr("class", "node-badge")
      .attr("text-anchor", "middle")
      .attr("dy", "0.34em")
      .text((d) => badgeLabels[d.id] || labelShort(d));

    node.append("text")
      .attr("class", "node-label")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.radius + 15)
      .text((d) => d.name);

    simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links)
        .id((d) => d.id)
        .distance((d) => compact ? 82 + d.strength * 18 : 104 + d.strength * 26)
        .strength((d) => 0.16 + d.strength * 0.24))
      .force("charge", d3.forceManyBody().strength((d) => d.role === "system" ? -580 : -290))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX((d) => anchor(d, width, height, compact).x).strength(0.075))
      .force("y", d3.forceY((d) => anchor(d, width, height, compact).y).strength(0.08))
      .force("collision", d3.forceCollide((d) => d.radius + (compact ? 12 : 16)))
      .on("tick", ticked);

    simulation.tick(compact ? 90 : 130);
    ticked();
    applyVisualState(node, link, links);
    setDefaultReadout(nodes);

    if (resetButton) resetButton.onclick = () => {
      focusedId = null;
      nodes.forEach((d) => {
        d.fx = d.role === "system" ? width / 2 : null;
        d.fy = d.role === "system" ? height / 2 : null;
      });
      svg.transition().duration(420).call(zoomBehavior.transform, d3.zoomIdentity);
      simulation.alpha(0.8).restart();
      applyVisualState(node, link, links);
      setDefaultReadout(nodes);
    };

    filterButtons.forEach((button) => {
      button.onclick = () => {
        activeFilter = button.dataset.networkFilter || "all";
        focusedId = null;
        filterButtons.forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        applyVisualState(node, link, links);
        setDefaultReadout(nodes);
      };
    });

    function ticked() {
      nodes.forEach((d) => {
        if (d.role === "system") {
          d.fx = width / 2;
          d.fy = height / 2;
        }
      });

      link.attr("d", linkPath);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    }

    function dragStarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.28).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event) {
      if (!event.active) simulation.alphaTarget(0);
    }
  }

  function seedPositions(nodes, width, height, compact) {
    const boroughs = nodes.filter((d) => d.role === "borough");
    const metrics = nodes.filter((d) => d.role === "metric");
    const events = nodes.filter((d) => d.role === "event");

    nodes.forEach((d) => {
      const point = anchor(d, width, height, compact);
      d.x = point.x + (Math.random() - 0.5) * 18;
      d.y = point.y + (Math.random() - 0.5) * 18;
    });

    boroughs.forEach((d, i) => {
      const point = ringPoint(width * (compact ? 0.5 : 0.29), height * (compact ? 0.38 : 0.52), compact ? 135 : 170, i, boroughs.length, -Math.PI / 2);
      d.x = point.x;
      d.y = point.y;
    });

    metrics.forEach((d, i) => {
      const point = ringPoint(width * (compact ? 0.5 : 0.66), height * (compact ? 0.5 : 0.36), compact ? 145 : 155, i, metrics.length, Math.PI * 0.12);
      d.x = point.x;
      d.y = point.y;
    });

    events.forEach((d, i) => {
      const point = ringPoint(width * (compact ? 0.5 : 0.68), height * (compact ? 0.58 : 0.66), compact ? 150 : 165, i, events.length, Math.PI * 0.35);
      d.x = point.x;
      d.y = point.y;
    });
  }

  function anchor(d, width, height, compact) {
    if (d.role === "system") return { x: width / 2, y: height / 2 };
    if (compact) {
      if (d.role === "borough") return { x: width * 0.35, y: height * 0.42 };
      if (d.department === "Rent") return { x: width * 0.64, y: height * 0.36 };
      if (d.department === "Supply") return { x: width * 0.42, y: height * 0.65 };
      if (d.department === "Vacancy") return { x: width * 0.62, y: height * 0.65 };
      return { x: width * 0.5, y: height * 0.56 };
    }
    if (d.role === "borough") return { x: width * 0.27, y: height * 0.52 };
    if (d.department === "Rent") return { x: width * 0.72, y: height * 0.28 };
    if (d.department === "Supply") return { x: width * 0.34, y: height * 0.74 };
    if (d.department === "Vacancy") return { x: width * 0.76, y: height * 0.53 };
    return { x: width * 0.7, y: height * 0.72 };
  }

  function ringPoint(cx, cy, r, index, total, startAngle) {
    const angle = startAngle + (index / Math.max(1, total)) * Math.PI * 2;
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r
    };
  }

  function drawFrame(frame, width, height, compact) {
    const cx = width / 2;
    const cy = height / 2;
    const rings = compact ? [96, 168, 242] : [112, 196, 280];
    frame.selectAll("circle")
      .data(rings)
      .join("circle")
      .attr("class", "network-guide-ring")
      .attr("cx", cx)
      .attr("cy", cy)
      .attr("r", (d) => d);

    frame.selectAll("line")
      .data([0, 1, 2, 3, 4])
      .join("line")
      .attr("class", "network-guide-spoke")
      .attr("x1", cx)
      .attr("y1", cy)
      .attr("x2", (_, i) => cx + Math.cos(i * Math.PI * 0.4) * width)
      .attr("y2", (_, i) => cy + Math.sin(i * Math.PI * 0.4) * height);
  }

  function labelShort(d) {
    if (d.role === "metric") return d.name.split(" ").map((word) => word[0]).join("").slice(0, 3);
    if (d.role === "event") return String(d.value).slice(-2);
    return d.name.slice(0, 2).toUpperCase();
  }

  function linkPath(d) {
    const source = { x: d.source.x, y: d.source.y, r: d.source.radius + 2 };
    const target = { x: d.target.x, y: d.target.y, r: d.target.radius + 2 };
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;
    const cx = (source.x + target.x) / 2 + nx * d.curve;
    const cy = (source.y + target.y) / 2 + ny * d.curve;
    const startVector = unitVector(cx - source.x, cy - source.y);
    const endVector = unitVector(target.x - cx, target.y - cy);
    const sx = source.x + startVector.x * source.r;
    const sy = source.y + startVector.y * source.r;
    const tx = target.x - endVector.x * target.r;
    const ty = target.y - endVector.y * target.r;
    return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
  }

  function unitVector(dx, dy) {
    const len = Math.max(1, Math.hypot(dx, dy));
    return { x: dx / len, y: dy / len };
  }

  function sourceId(link) {
    return typeof link.source === "object" ? link.source.id : link.source;
  }

  function targetId(link) {
    return typeof link.target === "object" ? link.target.id : link.target;
  }

  function filterMatches(link) {
    if (activeFilter === "all") return true;
    return (link.department || "").toLowerCase() === activeFilter;
  }

  function applyVisualState(node, link, links) {
    const filterLinkSet = new Set();
    const filterNodeSet = new Set(["nyc_market"]);

    links.forEach((d) => {
      if (filterMatches(d)) {
        filterLinkSet.add(d);
        filterNodeSet.add(sourceId(d));
        filterNodeSet.add(targetId(d));
      }
    });

    const focusLinkSet = new Set();
    const focusNodeSet = new Set();

    if (focusedId) {
      focusNodeSet.add(focusedId);
      links.forEach((d) => {
        if (sourceId(d) === focusedId || targetId(d) === focusedId) {
          focusLinkSet.add(d);
          focusNodeSet.add(sourceId(d));
          focusNodeSet.add(targetId(d));
        }
      });
    }

    link
      .classed("is-filtered-out", (d) => !filterLinkSet.has(d))
      .classed("is-muted", (d) => focusedId ? !focusLinkSet.has(d) : false)
      .classed("is-active", (d) => focusedId ? focusLinkSet.has(d) : filterLinkSet.has(d));

    node
      .classed("is-filtered-out", (d) => !filterNodeSet.has(d.id))
      .classed("is-muted", (d) => focusedId ? !focusNodeSet.has(d.id) : false)
      .classed("is-active", (d) => focusedId ? focusNodeSet.has(d.id) : filterNodeSet.has(d.id));
  }

  function showNodeTooltip(event, d) {
    if (!tooltip) return;
    tooltip.innerHTML = `
      <span>${d.role} / ${d.department}</span>
      <strong>${d.name}</strong>
      <p>${nodeDetails[d.id] || "A node in the rental market relationship network."}</p>
    `;
    tooltip.setAttribute("aria-hidden", "false");
    moveTooltip(event);
  }

  function showLinkTooltip(event, d) {
    if (!tooltip) return;
    tooltip.innerHTML = `
      <span>${d.department} / ${d.relationship}</span>
      <strong>${nameFromLink(d)}</strong>
      <p>${d.detail}</p>
      <em>Strength ${d.strength.toFixed(2)} / ${d.type}</em>
    `;
    tooltip.setAttribute("aria-hidden", "false");
    moveTooltip(event);
  }

  function moveTooltip(event) {
    if (!tooltip) return;
    const bounds = shell.getBoundingClientRect();
    const tooltipBounds = tooltip.getBoundingClientRect();
    const x = Math.min(bounds.width - tooltipBounds.width - 14, Math.max(14, event.clientX - bounds.left + 18));
    const y = Math.min(bounds.height - tooltipBounds.height - 14, Math.max(14, event.clientY - bounds.top + 18));
    tooltip.style.transform = `translate(${x}px, ${y}px)`;
  }

  function hideTooltip() {
    if (!tooltip) return;
    tooltip.setAttribute("aria-hidden", "true");
  }

  function nameFromLink(d) {
    const sourceName = typeof d.source === "object" ? d.source.name : d.source;
    const targetName = typeof d.target === "object" ? d.target.name : d.target;
    return `${sourceName} -> ${targetName}`;
  }

  function updateReadout(d) {
    if (!readout) return;
    readout.innerHTML = `
      <span>Focused node</span>
      <strong>${d.name}</strong>
      <p>${nodeDetails[d.id] || "This node connects boroughs, metrics, and events inside the NYC rental system."}</p>
    `;
  }

  function setDefaultReadout(nodes) {
    if (!readout) return;
    const central = nodes.find((d) => d.id === "nyc_market");
    readout.innerHTML = `
      <span>How to read it</span>
      <strong>${central ? central.name : "NYC Rental Market"}</strong>
      <p>Drag any station, zoom or pan the map, hover for details, and click a node to isolate its direct relationships.</p>
    `;
  }

  function clearFocus() {
    focusedId = null;
    hideTooltip();
    if (currentNodeSelection && currentLinkSelection) {
      applyVisualState(currentNodeSelection, currentLinkSelection, currentLinks);
      setDefaultReadout(currentNodes);
    }
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(render);
    }).observe(shell);
  } else {
    window.addEventListener("resize", () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(render);
    }, { passive: true });
  }
})();
