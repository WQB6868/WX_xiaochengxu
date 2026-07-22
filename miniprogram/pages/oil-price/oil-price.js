var api = require("../../utils/api");
var provinces = ["北京","天津","上海","重庆","河北","山西","辽宁","吉林","黑龙江","江苏","浙江","安徽","福建","江西","山东","河南","湖北","湖南","广东","海南","四川","贵州","云南","陕西","甘肃","青海","内蒙古","广西","西藏","宁夏","新疆"];

// 本地模拟油价数据（云函数不可用时兜底展示）
var MOCK_PRICES = {
  "广东": { p92: "7.96", p95: "8.62", p98: "10.62", p0: "7.62", time: "参考价" },
  "北京": { p92: "7.94", p95: "8.45", p98: "9.46", p0: "7.66", time: "参考价" },
  "上海": { p92: "7.90", p95: "8.41", p98: "9.41", p0: "7.59", time: "参考价" },
  "天津": { p92: "7.93", p95: "8.38", p98: "9.61", p0: "7.61", time: "参考价" },
  "重庆": { p92: "7.99", p95: "8.45", p98: "9.52", p0: "7.67", time: "参考价" },
  "山东": { p92: "7.90", p95: "8.48", p98: "9.20", p0: "7.52", time: "参考价" },
  "浙江": { p92: "7.90", p95: "8.41", p98: "9.22", p0: "7.59", time: "参考价" },
  "江苏": { p92: "7.91", p95: "8.41", p98: "9.31", p0: "7.57", time: "参考价" },
  "四川": { p92: "8.02", p95: "8.58", p98: "9.32", p0: "7.65", time: "参考价" },
  "湖南": { p92: "7.88", p95: "8.38", p98: "9.18", p0: "7.67", time: "参考价" },
  "湖北": { p92: "7.94", p95: "8.50", p98: "9.41", p0: "7.59", time: "参考价" },
  "河南": { p92: "7.95", p95: "8.49", p98: "9.14", p0: "7.59", time: "参考价" },
  "河北": { p92: "7.93", p95: "8.38", p98: "9.20", p0: "7.61", time: "参考价" },
  "福建": { p92: "7.91", p95: "8.44", p98: "9.24", p0: "7.60", time: "参考价" },
  "海南": { p92: "9.05", p95: "9.62", p98: "10.89", p0: "7.70", time: "参考价" },
  "陕西": { p92: "7.83", p95: "8.27", p98: "9.27", p0: "7.51", time: "参考价" },
  "广西": { p92: "7.99", p95: "8.63", p98: "9.45", p0: "7.66", time: "参考价" },
  "山西": { p92: "7.88", p95: "8.51", p98: "9.21", p0: "7.67", time: "参考价" },
  "辽宁": { p92: "7.93", p95: "8.46", p98: "9.22", p0: "7.55", time: "参考价" },
  "安徽": { p92: "7.89", p95: "8.45", p98: "9.28", p0: "7.64", time: "参考价" },
  "江西": { p92: "7.90", p95: "8.48", p98: "9.98", p0: "7.66", time: "参考价" },
  "云南": { p92: "8.08", p95: "8.68", p98: "9.36", p0: "7.68", time: "参考价" },
  "贵州": { p92: "8.07", p95: "8.53", p98: "9.43", p0: "7.71", time: "参考价" },
  "甘肃": { p92: "7.93", p95: "8.48", p98: "9.05", p0: "7.51", time: "参考价" },
  "吉林": { p92: "7.90", p95: "8.53", p98: "9.27", p0: "7.53", time: "参考价" },
  "黑龙江": { p92: "7.96", p95: "8.51", p98: "9.67", p0: "7.47", time: "参考价" },
  "内蒙古": { p92: "7.87", p95: "8.40", p98: "9.22", p0: "7.47", time: "参考价" },
  "新疆": { p92: "7.75", p95: "8.29", p98: "9.26", p0: "7.41", time: "参考价" },
  "宁夏": { p92: "7.84", p95: "8.29", p98: "9.39", p0: "7.50", time: "参考价" },
  "青海": { p92: "7.89", p95: "8.46", p98: "9.22", p0: "7.53", time: "参考价" },
  "西藏": { p92: "8.82", p95: "9.34", p98: "10.41", p0: "8.16", time: "参考价" }
};

Page({
  data: {
    provinces: provinces,
    selectedProvince: "北京",
    loading: false,
    loaded: false,
    priceData: null,
    source: "",
    error: "",
    news: "",
    showNewsModal: false,
    fullNews: ""
  },
  onLoad: function() {
    this.loadPrice();
  },
  selectProvince: function(e) {
    var idx = e.currentTarget.dataset.idx;
    this.setData({ selectedProvince: this.data.provinces[idx] });
    this.loadPrice();
  },
  loadPrice: function() {
    var that = this;
    var province = this.data.selectedProvince;
    this.setData({ loading: true, error: "", loaded: false });
    // 先尝试云函数
    api.callFunctionSilent("getOilPrice", { province: province }).then(function(data) {
      that.setData({
        priceData: data,
        loaded: true,
        loading: false,
        source: "实时",
        news: data.news || ""
      });
    }).catch(function() {
      // 云函数失败，使用本地模拟数据兜底
      var mock = MOCK_PRICES[province] || { p92: "--", p95: "--", p98: "--", p0: "--", time: "暂缺" };
      mock.news = new Date().getFullYear() + "-" + String(new Date().getMonth()+1).padStart(2,"0") + "-" + String(new Date().getDate()).padStart(2,"0") + " 油价仅供参考，以实际加油站为准";
      that.setData({
        priceData: mock,
        loaded: true,
        loading: false,
        source: "参考",
        news: mock.news || ""
      });
      wx.showToast({ title: "使用参考数据", icon: "none" });
    });
  },
  showNewsPopup: function() {
    this.setData({
      showNewsModal: true,
      fullNews: this.data.news
    });
  },
  closeNewsPopup: function() {
    this.setData({ showNewsModal: false });
  }
});
