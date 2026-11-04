(function () {
  var tabs = ["minesweep", "lecture", "seeds"];
  function show(name) {
    if (tabs.indexOf(name) < 0) name = "minesweep";
    tabs.forEach(function (t) {
      var on = t === name;
      document.getElementById(t).hidden = !on;
      document.getElementById("t-" + t).setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  document.querySelectorAll(".tabs button").forEach(function (b) {
    b.addEventListener("click", function () {
      var t = b.getAttribute("data-tab");
      try { history.replaceState(null, "", "#" + t); } catch (e) {}
      show(t);
    });
  });
  window.addEventListener("hashchange", function () { show(location.hash.slice(1)); });
  show(location.hash.slice(1));

  var rows = document.querySelectorAll("#flist .frow");
  document.querySelectorAll(".chip").forEach(function (c) {
    c.addEventListener("click", function () {
      document.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
      c.classList.add("on");
      var f = c.getAttribute("data-f");
      rows.forEach(function (r) {
        var ok = f === "all" || r.dataset.status === f || r.dataset.tier === f || (f === "ask" && r.dataset.ask === "1");
        r.hidden = !ok;
      });
    });
  });
})();
