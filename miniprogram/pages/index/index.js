var api = require("../../utils/api");
var timeUtil = require("../../utils/time");
var constants = require("../../utils/constants");

// 常用城市列表
var CITIES = ["北京","上海","广州","深圳","杭州","南京","武汉","成都","重庆","郑州","西安","长沙","合肥","南昌","福州","厦门","济南","青岛","大连","沈阳","哈尔滨","昆明","贵阳","南宁","海口","太原","石家庄","呼和浩特","银川","西宁","兰州","拉萨","乌鲁木齐","天津","苏州","无锡","宁波","东莞","佛山"];

Page({
  data: {
    tripList: [],
    trips: [],
    requests: [],
    displayList: [],
    searchParams: { fromCity: "", toCity: "", date: "" },
    hotRoutes: [],
    dateList: [], activeRoute: -1, activeDate: -1,
    page: 1, pageSize: 20, total: 0, tripCount: 0, reqCount: 0, hasMore: false,
    loadingMore: false, initialLoading: false, searched: false, searchTab: "trip",
    // 输入相关
    showSuggest: "", filteredCities: [], inputFocus: "", searchCounter: 0,
    viewedTrips: {}
  },

  onShow: function() {
    var params = this.data.searchParams;
    if (params.fromCity && params.toCity) {
      this.loadViewedTrips();
      this.loadTrips(true);
    }
  },
  onLoad: function() {
    this.initDateList();
    this.loadCommonRoutes();
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
      activeRoute: idx,
      "searchParams.fromCity": route.from, "searchParams.toCity": route.to
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
    this.setData({ searchCounter: this.data.searchCounter + 1 });
    this.saveSearchRoute(params.fromCity, params.toCity);
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
    var currentSearch = that.data.searchCounter;
    var doneCount = 0;
    var totalTasks = 2;

    function tryFinish(err) {
      doneCount++;
      if (doneCount >= totalTasks || err) {
        that.setData({ initialLoading: false, loadingMore: false });
        wx.stopPullDownRefresh();
      }
    }

    function updateList() {
      var tab = that.data.searchTab;
      var trips = that.data.trips || [];
      var requests = that.data.requests || [];
      var list;
      var count = 0;
      var tripCount = trips.length;
      var reqCount = requests.length;
      if (tab === "trip") { list = trips; count = tripCount; }
      else { list = requests; count = reqCount; }
      that.setData({ displayList: list, tripList: list, total: count, tripCount: tripCount, reqCount: reqCount });
    }


    // 车源查询
    api.callFunctionSilent("searchTrip", searchQuery).then(function(tripData) {
      if (that.data.searchCounter !== currentSearch) { return; }
      that.data.trips = (tripData.list || []).map(function(item) {
        item._type = "trip";
        item._dateDisplay = item.departDate ? that.formatDate(item.departDate) + " " + (item.departTime || "") : (item.departTime || "");
        item._viewed = that.data.viewedTrips && that.data.viewedTrips[item._id] ? true : false;
        item._viewCount = item.viewCount || 0;
        item._applyCount = item.applyCount || 0;
        return item;
      });
      updateList();
      that.setData({ page: page, hasMore: tripData.hasMore || false, searched: true });
      tryFinish();
    }).catch(function() {
      if (that.data.searchCounter !== currentSearch) return;
      that.setData({ searched: true });
      tryFinish(true);
    });

    // 乘客请求查询（直查数据库）
    try {
      var db = wx.cloud.database();
      var cond = { status: "active" };
      if (params.fromCity) {
        var cv = [params.fromCity];
        if (params.fromCity.indexOf("市") === -1) cv.push(params.fromCity + "市");
        else cv.push(params.fromCity.replace("市", ""));
        cond.fromCity = db.command.in(cv);
      }
      if (params.toCity) {
        var tv = [params.toCity];
        if (params.toCity.indexOf("市") === -1) tv.push(params.toCity + "市");
        else tv.push(params.toCity.replace("市", ""));
        cond.toCity = db.command.in(tv);
      }
      if (params.departDate) {
        var d = new Date(params.departDate);
        var next = new Date(d);
        next.setDate(next.getDate() + 1);
        cond.departDate = db.command.gte(d).and(db.command.lt(next));
      }
      db.collection("requests").where(cond).orderBy("createTime", "desc").limit(20).get().then(function(res) {
        if (that.data.searchCounter !== currentSearch) { return; }
        that.data.requests = (res.data || []).filter(function(item) {
          if (!params.date) return true;
          if (!item.departDate) return false;
          var dd = new Date(item.departDate);
          if (isNaN(dd.getTime())) return false;
          var sd = new Date(params.date);
          return dd.getFullYear() === sd.getFullYear() && dd.getMonth() === sd.getMonth() && dd.getDate() === sd.getDate();
        }).map(function(item) {
          item._type = "request";
          var ds = item.departDate ? that.formatDate(item.departDate) : "";
          var ts = item.departTime || "";
          item._dateDisplay = ds + (ds && ts ? " " : "") + ts;
          if (!item._dateDisplay) item._dateDisplay = "日期待定";
          item._fromCity = item.fromCity;
          item._toCity = item.toCity;
          item._passengers = item.passengers || 1;
          return item;
        });
        updateList();
        tryFinish();
      }).catch(function() { tryFinish(true); });
    } catch(e) { tryFinish(true); }
  },
  loadCommonRoutes: function() {
    try {
      var routes = wx.getStorageSync("searchRoutes") || [];
      this.setData({ hotRoutes: routes });
    } catch(e) {}
  },

  loadViewedTrips: function() {
    try {
      var viewed = wx.getStorageSync("viewedTrips") || {};
      this.setData({ viewedTrips: viewed });
    } catch(e) {}
  },

  saveSearchRoute: function(from, to) {
    try {
      var routes = wx.getStorageSync("searchRoutes") || [];
      routes = routes.filter(function(r) { return !(r.from === from && r.to === to); });
      routes.unshift({ from: from, to: to });
      if (routes.length > 10) routes = routes.slice(0, 10);
      wx.setStorageSync("searchRoutes", routes);
      var newActive = this.data.activeRoute >= 0 ? 0 : -1;
      this.setData({ hotRoutes: routes, activeRoute: newActive });
    } catch(e) {}
  },


  formatDate: function(d) {
    if (!d) return "";
    try {
      var date = new Date(d);
      if (isNaN(date.getTime())) return "";
      return (date.getMonth() + 1) + "月" + date.getDate() + "日";
    } catch(e) { return ""; }
  },
  switchSearchTab: function(e) {
    var tab = e.currentTarget.dataset.tab;
    var trips = this.data.trips || [];
    var requests = this.data.requests || [];
    var list = tab === "trip" ? trips : requests;
    var count = list.length;
    this.setData({ searchTab: tab, displayList: list, tripList: list, total: count, tripCount: trips.length, reqCount: requests.length });
  },
  goDetail: function(e) {
    var id = e.currentTarget.dataset.id || e.detail;
    if (id) {
      // Mark as viewed
      try {
        var viewed = wx.getStorageSync("viewedTrips") || {};
        viewed[id] = true;
        wx.setStorageSync("viewedTrips", viewed);
      } catch(e) {}
    }
    wx.navigateTo({ url: "/miniprogram/pages/detail/detail?id=" + id });
  },
  goPassengerDetail: function(e) { wx.navigateTo({ url: "/miniprogram/pages/passenger-detail/passenger-detail?id=" + e.currentTarget.dataset.id }); },
  goPublish: function() { wx.navigateTo({ url: "/miniprogram/pages/publish/publish" }); },
  goRequest: function() { wx.navigateTo({ url: "/miniprogram/pages/publish/publish?mode=request" }); }
});

