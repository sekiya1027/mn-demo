/* [DEMO] ③ JS 描画後のセラピ名横にメンエスなう SNS アイコンを後付け (本番は render 関数側に 1 行足すだけ) */
(function () {
  var SEL = "#todays-cast-list .cast-name, #therapist-list .therapist-name, #all-list .name, #schedule-list .schedule-name-bar";
  var IMG = '<img src="static/img/mn-icon.svg" alt="メンエスなう">';
  function add() {
    var els = document.querySelectorAll(SEL), n = 0;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.querySelector(".mn-sns-inline")) continue;
      var inA = !!el.closest("a");
      el.insertAdjacentHTML("beforeend", inA
        ? '<span class="mn-sns-inline" data-mn-hl="③ SNSアイコン">' + IMG + '</span>'
        : '<a class="mn-sns-inline" href="https://men-esthe.co.jp/" target="_blank" rel="nofollow noopener" data-mn-hl="③ SNSアイコン">' + IMG + '</a>');
      n++;
    }
    return n;
  }
  function watch() {
    var roots = document.querySelectorAll("#todays-cast-list, #therapist-list, #all-list, #schedule-list");
    if (!roots.length) return;
    add();
    var mo = new MutationObserver(function () { add(); });
    for (var i = 0; i < roots.length; i++) mo.observe(roots[i], { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();
})();
