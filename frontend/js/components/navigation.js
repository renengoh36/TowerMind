function setActiveNav(page) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === page);
  });
}

function closeMobileSidebar() {
  document.getElementById("sidebar").classList.remove("open");
}
