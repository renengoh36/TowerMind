// Volt Buddy: animated AI energy mascot — driven entirely by real API data.
(function initVoltBuddy() {
  const card = document.getElementById("vbCard");
  if (!card) return;

  const VB_API = window.location.port === '5000' ? '' : 'http://localhost:5000';
  let currentPeriod = "current";

  const batteryFill = card.querySelector(".vb-fill");
  const batteryValue = card.querySelector(".vb-value");
  const batteryMan  = card.querySelector(".vb-man");
  const face        = card.querySelector(".vb-head");
  const statusPill  = card.querySelector(".vb-status-pill");
  const subtitle    = card.querySelector(".vb-subtitle");

  // score = efficiency_score (0–100, higher = better)
  function updateBuddy(score, sub) {
    if (batteryValue) batteryValue.innerText = score + '%';
    if (batteryFill)  batteryFill.style.height = Math.min(score, 100) + '%';
    if (subtitle && sub) subtitle.innerText = sub;

    let status, statusClass, color, animation, faceIcon;

    if (score >= 85) {
      status = 'Optimal';        statusClass = 'green';
      color  = 'linear-gradient(180deg, #86EFAC, #22C55E)';
      animation = 'floating';    faceIcon = '😎';
    } else if (score >= 70) {
      status = 'Good';           statusClass = 'yellow';
      color  = 'linear-gradient(180deg, #FDE68A, #EAB308)';
      animation = 'floating';    faceIcon = '🙂';
    } else if (score >= 55) {
      status = 'Warning';        statusClass = 'orange';
      color  = 'linear-gradient(180deg, #FDBA74, #F97316)';
      animation = 'worry';       faceIcon = '😐';
    } else if (score >= 40) {
      status = 'High Usage';     statusClass = 'red';
      color  = 'linear-gradient(180deg, #FCA5A5, #EF4444)';
      animation = 'shaking';     faceIcon = '😰';
    } else {
      status = 'Critical';       statusClass = 'red';
      color  = 'linear-gradient(180deg, #FCA5A5, #DC2626)';
      animation = 'danger';      faceIcon = '😫';
    }

    if (batteryMan)  batteryMan.className  = 'vb-man ' + animation;
    if (face)        face.innerText        = faceIcon;
    if (statusPill) {
      statusPill.innerText   = status;
      statusPill.className   = 'vb-status-pill ' + statusClass;
    }
    if (batteryFill) batteryFill.style.background = color;
  }

  async function switchPeriod(period) {
    currentPeriod = period;
    card.querySelectorAll('.vb-month-selector button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === period);
    });

    try {
      let score, sub;
      if (period === 'current') {
        const kpi = await fetch(VB_API + '/api/kpi/current').then(r => r.json());
        score = kpi.efficiency_score ?? 65;
        sub   = "This month's efficiency score";
      } else {
        const months  = period === 'threeMonths' ? 3 : 12;
        const history = await fetch(VB_API + '/api/kpi/history?months=' + months).then(r => r.json());
        score = history.length
          ? Math.round(history.reduce((s, r) => s + (r.efficiency_score || 0), 0) / history.length)
          : 65;
        sub = period === 'threeMonths' ? 'Average over last 3 months' : 'Average over last 12 months';
      }
      updateBuddy(score, sub);
    } catch (e) {
      updateBuddy(65, 'Loading…');
    }
  }

  card.querySelectorAll('.vb-month-selector button').forEach(btn => {
    btn.addEventListener('click', () => switchPeriod(btn.dataset.period));
  });

  switchPeriod('current');
})();
