(function () {
  if (document.getElementById("im-float-actions")) {
    return;
  }
  document.body.insertAdjacentHTML(
    "beforeend",
    "<div id=\"im-float-actions\" aria-label=\"電話のショートカット\">" +
      "<a href=\"tel:07014834844\" class=\"im-float-tel\" title=\"070-1483-4844 へ発信\">" +
      "<span class=\"im-float-icon\" aria-hidden=\"true\">&#x260E;</span>" +
      "電話</a>" +
      "</div>"
  );
})();
