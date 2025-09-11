(function () {
  // Toggle submenu visibility using max-height for smooth transitions
  window.toggleMenu = function (menuId, btn) {
    var el = document.getElementById(menuId);
    if (!el) return;
    var isOpen = el.style.maxHeight && el.style.maxHeight !== '0px';
    el.style.maxHeight = isOpen ? '0px' : el.scrollHeight + 'px';
    if (btn) {
      btn.classList.toggle('open', !isOpen);
    }
  };
})();
