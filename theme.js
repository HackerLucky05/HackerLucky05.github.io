(function () {
  var t; try { t = localStorage.getItem("theme"); } catch (e) {}
  document.documentElement.dataset.theme = t === "light" ? "light" : "dark";
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.getElementById("theme"); if (!b) return;
    function sync() {
      var d = document.documentElement.dataset.theme === "dark";
      b.textContent = d ? "[ light mode ]" : "[ dark mode ]";
      b.setAttribute("aria-label", "Switch to " + (d ? "light" : "dark") + " theme");
    }
    sync();
    b.onclick = function () {
      var n = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = n;
      try { localStorage.setItem("theme", n); } catch (e) {}
      sync();
    };
  });
})();
