// Floor Plan section: grid of 8 floor cards. Clicking a card expands a
// detail panel below the grid showing that floor's plan with hotspot
// notices. Click the same card again to close it; click another card to
// switch (closes the current panel, opens the new floor's).
// Zone coords [name, level, leftPct, topPct, widthPct, heightPct, energy, water, occupancy, cost, aiNote]
// are the center + size of each room's marker, tuned to each cropped floor image.
const fpFloors = [
  { n: 1, name: "Lobby & Facilities", status: "warning", text: "Warning", img: "assets/floor1.png", zones: [
    ["Reception", "normal", 50, 25, 28, 18, "420 kWh", "650 L", "45%", "RM 760", "Usage is normal."],
    ["Cafe", "warning", 82, 35, 32, 32, "850 kWh", "1,100 L", "48%", "RM 1,900", "Cafe water and energy usage is rising."],
    ["Meeting Room 2", "danger", 82, 73, 32, 22, "1,520 kWh", "4,500 L", "89%", "RM 4,800", "Energy overload in meeting area. Check AC and lighting schedule."]
  ] },
  { n: 2, name: "Meeting & Collaboration", status: "normal", text: "Normal", img: "assets/floor2.png", zones: [
    ["Meeting Room 3", "normal", 50, 25, 26, 18, "620 kWh", "900 L", "58%", "RM 1,180", "Usage is stable."],
    ["Pantry", "normal", 50, 75, 20, 18, "300 kWh", "1,000 L", "34%", "RM 620", "Normal usage."],
    ["Collaboration Lounge", "warning", 82, 75, 32, 22, "940 kWh", "700 L", "28%", "RM 1,600", "Low utilization but AC still active."]
  ] },
  { n: 3, name: "Open Office", status: "danger", text: "Overload", img: "assets/floor3.png", zones: [
    ["Open Workspace A", "danger", 50, 32, 90, 26, "2,100 kWh", "2,400 L", "96%", "RM 5,900", "Workspace is overloaded. Move users to Workspace B."],
    ["Pantry / Utility", "normal", 90, 28, 16, 16, "390 kWh", "900 L", "30%", "RM 800", "Normal usage."],
    ["Open Workspace B", "warning", 50, 75, 90, 26, "1,420 kWh", "1,600 L", "72%", "RM 3,400", "High but manageable usage."]
  ] },
  { n: 4, name: "Executive Offices", status: "normal", text: "Normal", img: "assets/floor4.png", zones: [
    ["Executive Office 2", "normal", 50, 25, 26, 18, "410 kWh", "400 L", "38%", "RM 880", "Normal usage."],
    ["Executive Office 3", "normal", 82, 25, 28, 18, "395 kWh", "380 L", "36%", "RM 850", "Normal usage."],
    ["Executive Lounge", "warning", 50, 75, 26, 20, "820 kWh", "550 L", "20%", "RM 1,250", "Low occupancy but lighting and AC are active."]
  ] },
  { n: 5, name: "Departments", status: "normal", text: "Normal", img: "assets/floor5.png", zones: [
    ["Finance Department", "normal", 20, 28, 34, 22, "760 kWh", "620 L", "60%", "RM 1,600", "Normal usage."],
    ["HR Department", "warning", 78, 28, 34, 22, "1,050 kWh", "700 L", "75%", "RM 2,400", "HR area has peak usage."],
    ["Operations Department", "normal", 78, 76, 34, 22, "780 kWh", "500 L", "58%", "RM 1,500", "Normal usage."]
  ] },
  { n: 6, name: "Training & Development", status: "warning", text: "Warning", img: "assets/floor6.png", zones: [
    ["Training Room", "warning", 40, 28, 55, 22, "1,450 kWh", "1,000 L", "32%", "RM 3,200", "Training room is underused but AC is active."],
    ["Breakout Area", "normal", 50, 78, 24, 18, "380 kWh", "500 L", "36%", "RM 760", "Normal usage."],
    ["Workshop Room 2", "warning", 80, 76, 30, 20, "980 kWh", "420 L", "24%", "RM 1,900", "Consolidate workshops."]
  ] },
  { n: 7, name: "IT & Operations", status: "danger", text: "Overload", img: "assets/floor7.png", zones: [
    ["IT Server Room", "danger", 22, 26, 34, 20, "2,450 kWh", "400 L", "85%", "RM 6,800", "Server cooling overload. Optimize cooling schedule."],
    ["NOC", "danger", 75, 26, 40, 20, "2,100 kWh", "500 L", "88%", "RM 5,900", "Network operations energy spike detected."],
    ["Operations Control", "warning", 75, 76, 40, 20, "1,200 kWh", "380 L", "66%", "RM 2,600", "Monitor after-hours usage."]
  ] },
  { n: 8, name: "Amenities & Rooftop", status: "normal", text: "Normal", img: "assets/floor8.png", zones: [
    ["Fitness Center", "normal", 22, 26, 34, 20, "540 kWh", "1,100 L", "40%", "RM 1,100", "Normal usage."],
    ["Outdoor Terrace", "warning", 22, 78, 34, 20, "420 kWh", "1,600 L", "25%", "RM 900", "Water usage is rising."],
    ["Sky Lounge", "normal", 75, 78, 40, 20, "500 kWh", "700 L", "35%", "RM 980", "Normal usage."]
  ] }
];

(function initFloorPlan() {
  const grid = document.getElementById("fpFloorGrid");
  const expand = document.getElementById("fpExpand");
  if (!grid || !expand) return;

  let activeIndex = null;

  function fpSuffix(n) { return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"; }

  function fpShowZone(z) {
    const cls = z[1] === "danger" ? "danger" : z[1] === "warning" ? "warning" : "normal";
    const txt = z[1] === "danger" ? "Overload" : z[1] === "warning" ? "Warning" : "Normal";
    expand.querySelector(".fp-zone-badge").className = `fp-status fp-zone-badge ${cls}`;
    expand.querySelector(".fp-zone-badge").innerText = txt;
    expand.querySelector(".fp-zone-title").innerText = z[0];
    expand.querySelector(".fp-zone-desc").innerText = txt + " zone resource summary";
    expand.querySelector(".fp-m-energy").innerText = z[6];
    expand.querySelector(".fp-m-water").innerText = z[7];
    expand.querySelector(".fp-m-occ").innerText = z[8];
    expand.querySelector(".fp-m-cost").innerText = z[9];
    expand.querySelector(".fp-m-ai").innerText = z[10];
  }

  function fpRenderExpand(i) {
    const f = fpFloors[i];
    expand.querySelector(".fp-plan-title").innerText = `${f.n}${fpSuffix(f.n)} Floor - ${f.name}`;
    const planStatus = expand.querySelector(".fp-plan-status");
    planStatus.className = `fp-status fp-plan-status ${f.status}`;
    planStatus.innerText = f.text;

    const wrap = expand.querySelector(".fp-plan-wrap");
    wrap.innerHTML = `<img src="${f.img}" alt="${f.name} plan">`;
    f.zones.forEach(z => {
      const area = document.createElement("div");
      area.className = `fp-area ${z[1] === "danger" ? "d" : z[1] === "warning" ? "w" : ""}`;
      area.style.left = z[2] + "%";
      area.style.top = z[3] + "%";
      area.style.width = z[4] + "%";
      area.style.height = z[5] + "%";
      wrap.appendChild(area);

      const h = document.createElement("button");
      h.type = "button";
      h.className = `fp-hotspot ${z[1][0]}`;
      h.style.left = z[2] + "%";
      h.style.top = z[3] + "%";
      h.onclick = () => fpShowZone(z);
      wrap.appendChild(h);
    });

    fpShowZone(f.zones[0]);
  }

  function fpHandleCardClick(i, card) {
    if (activeIndex === i) {
      expand.classList.remove("open");
      grid.querySelectorAll(".fp-floor-card").forEach(c => c.classList.remove("active"));
      activeIndex = null;
      return;
    }
    grid.querySelectorAll(".fp-floor-card").forEach(c => c.classList.remove("active"));
    card.classList.add("active");
    activeIndex = i;
    fpRenderExpand(i);
    expand.classList.add("open");
  }

  fpFloors.forEach((f, i) => {
    // Derive badge from worst zone in this floor so card always matches detail panel
    const hasOverload = f.zones.some(z => z[1] === 'danger');
    const hasWarning  = f.zones.some(z => z[1] === 'warning');
    const status = hasOverload ? 'danger'   : hasWarning ? 'warning' : 'normal';
    const text   = hasOverload ? 'Overload' : hasWarning ? 'Warning' : 'Normal';

    const card = document.createElement("button");
    card.type = "button";
    card.className = "fp-floor-card";
    card.innerHTML = `<h3>${f.n}${fpSuffix(f.n)} Floor</h3><p>${f.name}</p><span class="fp-status ${status}">${text}</span>`;
    card.onclick = () => fpHandleCardClick(i, card);
    grid.appendChild(card);
  });
})();
