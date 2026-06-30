var api = require("../../utils/api");
var cities = ["北京","上海","广州","深圳","杭州","南京","武汉","成都","重庆","郑州","西安","长沙","合肥","南昌","福州","厦门","济南","青岛","大连","沈阳","哈尔滨","昆明","贵阳","南宁","海口","太原","石家庄","呼和浩特","银川","西宁","兰州","拉萨","乌鲁木齐","天津","苏州","无锡","宁波","东莞","佛山"];

Page({
  data: { searchParams: { fromCity: "", toCity: "", date: "" }, tripList: [], searched: false, sortBy: "time" },
  chooseCity: function(e) {
    var that = this;
    wx.showActionSheet({
      itemList: cities,
      success: function(res) { var obj = {}; obj["searchParams." + e.currentTarget.dataset.type + "City"] = cities[res.tapIndex]; that.setData(obj); }
    });
  },
  swapCities: function() { this.setData({ "searchParams.fromCity": this.data.searchParams.toCity, "searchParams.toCity": this.data.searchParams.fromCity }); },
  onDateChange: function(e) { this.setData({ "searchParams.date": e.detail.value }); },
  setSort: function(e) { this.setData({ sortBy: e.currentTarget.dataset.sort }); this.doSearch(); },
  doSearch: function() {
    var that = this;
    if (!this.data.searchParams.fromCity) { wx.showToast({ title: "请选择出发城市", icon: "none" }); return; }
    if (!this.data.searchParams.toCity) { wx.showToast({ title: "请选择目的城市", icon: "none" }); return; }
    if (!this.data.searchParams.date) { wx.showToast({ title: "请选择日期", icon: "none" }); return; }
    api.callFunction("searchTrip", {
      fromCity: this.data.searchParams.fromCity, toCity: this.data.searchParams.toCity,
      departDate: this.data.searchParams.date || undefined, sortBy: this.data.sortBy
    }).then(function(data) { that.setData({ tripList: data.list || [], searched: true }); });
  },
  goDetail: function(e) { wx.navigateTo({ url: "/miniprogram/pages/detail/detail?id=" + e.currentTarget.dataset.id }); }
});
