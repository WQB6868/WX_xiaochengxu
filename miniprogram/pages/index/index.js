var api = require("../../utils/api");
var timeUtil = require("../../utils/time");
var constants = require("../../utils/constants");

// 常用城市列表
var CITIES = ["北京","上海","广州","深圳","杭州","南京","武汉","成都","重庆","郑州","西安","长沙","合肥","南昌","福州","厦门","济南","青岛","大连","沈阳","哈尔滨","昆明","贵阳","南宁","海口","太原","石家庄","呼和浩特","银川","西宁","兰州","拉萨","乌鲁木齐","天津","苏州","无锡","宁波","东莞","佛山"];

Page({
  data: {
    tripList: [],
    searchParams: { fromCity: "", toCity: "", date: "" },
    hotRoutes: [
      { from: "北京", to: "郑州" }, { from: "上海", to: "合肥" },
      { from: "广州", to: "长沙" }, { from: "深圳", to: "武汉" },
      { from: "杭州", to: "南昌" }, { from: "南京", to: "徐州" }
    ],
    dateList: [], activeRoute: -1, activeDate: -1,
    page: 1, pageSize: 20, total: 0, hasMore: false,
    loadingMore: false, initialLoading: false, searched: false,
    // 输入相关
    showSuggest: "", filteredCities: [], inputFocus: ""
  },

  onShow: function() {
    var params = this.data.searchParams;
    if (params.fromCity && params.toCity) {
      this.loadTrips(true);
    }
  },
  onLoad: function() {
    this.initDateList();
  },

  onPullDownRefresh: function() { if (this.data.searched) this.loadTrips(true); },
  onReachBottom: function() { if (this.data.hasMore && !this.data.loadingMore) this.loadTrips(false); },

  initDateList: function() {
    var list = [];
    var weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    var today = new Date();
    for (var i = 0; i < 14; i++) {
      var d = new Date(today);
      d.setDate(d.getDate() + i);
      var month = d.getMonth() + 1;
      var day = d.getDate();
      var dateStr = d.getFullYear() + "-" + (month < 10 ? "0" : "") + month + "-" + (day < 10 ? "0" : "") + day;
      var display = (month < 10 ? "0" : "") + month + "/" + (day < 10 ? "0" : "") + day;
      list.push({
        weekday: i === 0 ? "今天" : i === 1 ? "明天" : weekdays[d.getDay()],
        date: display,
        fullDate: dateStr
      });
    }
    this.setData({ dateList: list });
  },

  // ========== 城市输入 ==========
  onCityInput: function(e) {
    var type = e.currentTarget.dataset.type;
    var value = e.detail.value;
    var obj = {};
    obj["searchParams." + type + "City"] = value;
    this.setData(obj);
    this.setData({ activeRoute: -1 });

    // 过滤城市建议
    if (value) {
      var filtered = [];
      for (var i = 0; i < CITIES.length; i++) {
        if (CITIES[i].indexOf(value) !== -1) {
          filtered.push(CITIES[i]);
        }
      }
      this.setData({ filteredCities: filtered, showSuggest: filtered.length > 0 ? type : "" });
    } else {
      this.setData({ filteredCities: [], showSuggest: "" });
    }
  },

  onCityFocus: function(e) {
    var type = e.currentTarget.dataset.type;
    this.setData({ inputFocus: type });
    // 如果已有输入，显示建议
    var val = type === "from" ? this.data.searchParams.fromCity : this.data.searchParams.toCity;
    if (val) {
      var filtered = [];
      for (var i = 0; i < CITIES.length; i++) {
        if (CITIES[i].indexOf(val) !== -1) {
          filtered.push(CITIES[i]);
        }
      }
      this.setData({ filteredCities: filtered, showSuggest: filtered.length > 0 ? type : "" });
    }
  },

  onCityBlur: function(e) {
    var that = this;
    this.setData({ inputFocus: "" });
    // 延迟关闭建议，让点击事件能先触发
    setTimeout(function() {
      that.setData({ showSuggest: "", filteredCities: [] });
    }, 200);
  },

  selectSuggestCity: function(e) {
    var type = e.currentTarget.dataset.type;
    var city = e.currentTarget.dataset.city;
    var obj = {};
    obj["searchParams." + type + "City"] = city;
    this.setData(obj);
    this.setData({ showSuggest: "", filteredCities: [], activeRoute: -1 });
  },

  swapCities: function() {
    this.setData({
      "searchParams.fromCity": this.data.searchParams.toCity,
      "searchParams.toCity": this.data.searchParams.fromCity
    });
  },

  // ========== 日期选择 ==========
  onDateChange: function(e) {
    this.setData({
      "searchParams.date": e.detail.value,
      activeDate: -1
    });
  },

  // ========== 热门路线 ==========
  selectRoute: function(e) {
    var idx = parseInt(e.currentTarget.dataset.idx);
    var route = this.data.hotRoutes[idx];
    this.setData({
      activeRoute: idx, activeDate: -1,
      searchParams: { fromCity: route.from, toCity: route.to, date: "" }
    });
  },

  selectDate: function(e) {
    var idx = parseInt(e.currentTarget.dataset.idx);
    var item = this.data.dateList[idx];
    this.setData({
      activeDate: idx,
      "searchParams.date": item.fullDate
    });
  },

  // ========== 搜索 ==========
  doSearch: function() {
    var params = this.data.searchParams;
    if (!params.fromCity) { wx.showToast({ title: "请输入出发城市", icon: "none" }); return; }
    if (!params.toCity) { wx.showToast({ title: "请输入目的城市", icon: "none" }); return; }
    if (!params.date) { wx.showToast({ title: "请选择日期", icon: "none" }); return; }
    this.setData({ showSuggest: "", filteredCities: [] });
    this.loadTrips(true);
  },

    loadTrips: function(refresh) {
    var that = this;
    var params = this.data.searchParams;
    if (refresh) { this.setData({ page: 1, initialLoading: true, searched: true }); }
    var page = refresh ? 1 : this.data.page + 1;
    var searchQuery = {
      fromCity: params.fromCity, toCity: params.toCity,
      departDate: params.date || undefined,
      page: page, pageSize: this.data.pageSize
    };
    var tripPromise = api.callFunction("searchTrip", searchQuery);
    var reqPromise = new Promise(function(resolve) {
      api.callFunctionSilent("searchRequests", searchQuery).then(function(data) {
        resolve(data);
      }).catch(function() {
        try {
          var db = wx.cloud.database();
          var cond = { status: "active" };
          if (params.fromCity) { cond.fromCity = db.RegExp({ regexp: params.fromCity, options: "i" }); }
          if (params.toCity) { cond.toCity = db.RegExp({ regexp: params.toCity, options: "i" }); }
          db.collection("requests").where(cond).orderBy("createTime", "desc").limit(20).get().then(function(res) {
            resolve({ list: res.data || [], total: (res.data || []).length, hasMore: false });
          }).catch(function() { resolve({ list: [], total: 0, hasMore: false }); });
        } catch(e) { resolve({ list: [], total: 0, hasMore: false }); }
      });
    });
    Promise.all([tripPromise, reqPromise]).then(function(results) {
      var tripData = results[0];
      var reqData = results[1];
      var tripList = (tripData.list || []).map(function(item) {
        item._type = "trip";
        item._dateDisplay = item.departDate ? that.formatDate(item.departDate) + " " + (item.departTime || "") : (item.departTime || "");
        return item;
      });
      var reqList = (reqData.list || []).map(function(item) {
        item._type = "request";
        item._dateDisplay = item.departDate ? that.formatDate(item.departDate) : "日期待定";
        item._fromCity = item.fromCity;
        item._toCity = item.toCity;
        item._passengers = item.passengers || 1;
        return item;
      });
      var merged = tripList.concat(reqList);
      var total = (tripData.total || 0) + (reqData.total || 0);
      if (refresh) {
        that.setData({ tripList: merged, total: total, page: page, hasMore: tripData.hasMore || reqData.hasMore, initialLoading: false, loadingMore: false });
      } else {
        that.setData({ tripList: that.data.tripList.concat(merged), page: page, hasMore: tripData.hasMore || reqData.hasMore, loadingMore: false });
      }
      wx.stopPullDownRefresh();
    }).catch(function() { that.setData({ initialLoading: false, loadingMore: false, searched: true }); wx.stopPullDownRefresh(); });
  },

  formatDate: function(d) {
    if (!d) return "";
    try {
      var date = new Date(d);
      if (isNaN(date.getTime())) return "";
      return (date.getMonth() + 1) + "月" + date.getDate() + "日";
    } catch(e) { return ""; }
  },
  goDetail: function(e) { wx.navigateTo({ url: "/miniprogram/pages/detail/detail?id=" + (e.currentTarget.dataset.id || e.detail) }); },
  goPassengerDetail: function(e) { wx.navigateTo({ url: "/miniprogram/pages/passenger-detail/passenger-detail?id=" + e.currentTarget.dataset.id }); },
  goPublish: function() { wx.navigateTo({ url: "/miniprogram/pages/publish/publish" }); },
  goRequest: function() { wx.navigateTo({ url: "/miniprogram/pages/publish/publish?mode=request" }); }
});

