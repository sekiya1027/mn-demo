/**
 * セラピスト・出勤データの取得先（同じサーバー上の PHP。GAS 不要）
 * therapist-api.php が駅ちか（ranking-deli）店舗50740 から自動取得します。
 */
var ICHIGOMILK_GAS_API_URL = "static/api.json?v=202611262339";  // [DEMO] therapist-api.php の取得結果を同梱

/** 取得失敗時の表示用（メンエスじゃぱん画像URL・駅ちかリンク） */
var ICHIGOMILK_STATIC_THERAPIST_DATA = {
  details: [
    [
      "https://images.mens-est.jp/files.mens-est.jp/img/shop/imperialspa/gimg/20260806150906095.jpg",
      "みゆ",
      "22",
      "150",
      "-"
    ],
    [
      "https://images.mens-est.jp/files.mens-est.jp/img/shop/imperialspa/gimg/20260806150909722.jpg",
      "はる",
      "24",
      "156",
      "C"
    ]
  ],
  schedule: [
    ["", "21:00〜03:00", "-", "-", "-", "-", "-", "-"],
    ["", "18:00〜00:30", "-", "-", "-", "-", "-", "-"]
  ],
  links: [
    ["", "https://mens-est.jp/shop/imperialspa/girllist/girl/246302/"],
    ["", "https://mens-est.jp/shop/imperialspa/girllist/girl/246680/"]
  ]
};

function getIchigomilkGasUrlOrEmpty() {
  var u = (typeof ICHIGOMILK_GAS_API_URL !== "undefined" && String(ICHIGOMILK_GAS_API_URL).trim())
    ? String(ICHIGOMILK_GAS_API_URL).trim() : "";
  if (!u && typeof location !== "undefined" && /^https?:/i.test(location.protocol)) {
    return "therapist-api.php?api=therapist";
  }
  return u;
}

function ichigomilkLoadingHtml() {
  return "<p style=\"text-align:center; grid-column: 1 / -1;\">読み込み中</p>";
}

var ICHIGOMILK_THERAPIST_PLACEHOLDER_IMG = "https://mens-est.jp/assets/img/common/none.png";

function normalizeMensestheTherapistImageUrl(url) {
  if (url == null || url === "") {
    return ICHIGOMILK_THERAPIST_PLACEHOLDER_IMG;
  }
  return String(url).replace(/\?.*$/, "");
}

function fetchIchigomilkTherapistData() {
  var u = getIchigomilkGasUrlOrEmpty();
  if (!u) {
    return Promise.resolve(ICHIGOMILK_STATIC_THERAPIST_DATA);
  }
  return fetch(u, { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      if (!data || !data.details || !data.details.length) {
        return ICHIGOMILK_STATIC_THERAPIST_DATA;
      }
      return data;
    })
    .catch(function () {
      return ICHIGOMILK_STATIC_THERAPIST_DATA;
    });
}
