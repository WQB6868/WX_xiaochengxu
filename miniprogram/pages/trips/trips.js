var api = require("../../utils/api");
var timeUtil = require("../../utils/time");
var constants = require("../../utils/constants");

Page({
  data: { activeTab: "driver", activeStatus: "", tripList: [], page: 1, pageSize: 20, hasMore: false, loadingMore: false, initialLoading: true },
  onLoad: function() { this.loadTrips(true); },
  onShow: function() { this.loadTrips(true); },
  onPullDownRefresh: function() { this.loadTrips(true); },
  onReachBottom: function() { if (this.data.hasMore && !this.data.loadingMore) this.loadTrips(false); },
  switchTab: function(e) { var tab = e.currentTarget.dataset.tab; if (tab !== this.data.activeTab) { this.setData({ activeTab: tab, page: 1, tripList: [], initialLoading: true }); this.loadTrips(true); } },
  filterStatus: function(e) { this.setData({ activeStatus: e.currentTarget.dataset.status, page: 1, tripList: [], initialLoading: true }); this.loadTrips(true); },
    loadTrips: function(refresh) {
    var that = this;
    var page = refresh ? 1 : this.data.page + 1;
    if (refresh) this.setData({ initialLoading: true });
    
    if (this.data.activeTab === "request") {
      // Load my published ride requests
      var loadRequests = function() {
        var db = wx.cloud.database();
        var openid = getApp().globalData.openid;
        if (!openid) { return Promise.resolve({ list: [], total: 0, hasMore: false }); }
        return db.collection("requests").where({ _openid: openid, status: db.command.neq("cancelled") })
          .orderBy("createTime", "desc")
          .skip((page - 1) * 20).limit(20)
          .get().then(function(res) {
            var list = (res.data || []).map(function(r) {
              r._type = "request";
              r._dateDisplay = that.formatDate(r.departDate) + (r.departTime ? " " + r.departTime : "");
              return r;
            });
            return { list: list, total: list.length, hasMore: false };
          }).catch(function() { return { list: [], total: 0, hasMore: false }; });
      };
      loadRequests().then(function(data) {
        that.setData({ tripList: data.list, page: page, hasMore: data.hasMore, initialLoading: false });
        wx.stopPullDownRefresh();
      }).catch(function() { that.setData({ initialLoading: false }); wx.stopPullDownRefresh(); });
      return;
    }
    
    api.callFunction("getMyTrips", { role: this.data.activeTab, status: this.data.activeStatus || undefined, page: page, pageSize: this.data.pageSize }).then(function(data) {
      var list = (data.list || []).map(function(item) {
        item._dateDisplay = that.formatDate(item.departDate) ? that.formatDate(item.departDate) + " " + (item.departTime || "") : (item.departTime || "");
        return item;
      });
      // Filter out cancelled/rejected from passenger tab
      if (that.data.activeTab === "passenger") {
        list = list.filter(function(item) {
          return item.myStatus !== "cancelled" && item.myStatus !== "rejected";
        });
      }
      if (refresh) { that.setData({ tripList: list, page: page, hasMore: data.hasMore, initialLoading: false }); }
      else { that.setData({ tripList: that.data.tripList.concat(list), page: page, hasMore: data.hasMore }); }
      wx.stopPullDownRefresh();
    }).catch(function() { that.setData({ initialLoading: false }); wx.stopPullDownRefresh(); });
  },
  goDetail: function(e) { wx.navigateTo({ url: "/miniprogram/pages/detail/detail?id=" + e.currentTarget.dataset.id }); },
  statusText: function(s) { return constants.TRIP_STATUS_TEXT[s] || s; },
  myStatusText: function(s) { return constants.PASSENGER_STATUS_TEXT[s] || s; },
    formatPrice: function(p) { return timeUtil.formatPrice(p); },
  formatDate: function(d) {
    if (!d) return "";
    try {
      var date = new Date(d);
      if (isNaN(date.getTime())) return "";
      return (date.getMonth() + 1) + "月" + date.getDate() + "日";
    } catch(e) { return ""; }
  },
    deleteRequest: function(e) {
    var that = this;
    var requestId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条求车信息吗？',
      success: function(res) {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          wx.cloud.callFunction({
            name: 'deleteRequest',
            data: { requestId: requestId }
          }).then(function(res) {
            wx.hideLoading();
            var result = res.result || {};
            if (result.code === 0) {
              wx.showToast({ title: '已删除', icon: 'success' });
              that.loadTrips(true);
            } else {
              wx.showToast({ title: result.message || '删除失败', icon: 'none' });
            }
          }).catch(function(err) {
            wx.hideLoading();
            console.error('deleteRequest error:', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  },
    confirmInvite: function(e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认同行',
      content: '确认与车主同行吗？',
      success: function(res) {
        if (res.confirm) {
          wx.showLoading({ title: '确认中...' });
          api.callFunction('confirmRide', { tripId: id }).then(function(data) {
            wx.hideLoading();
            wx.showToast({ title: '已确认', icon: 'success' });
            that.loadTrips(true);
          }).catch(function(err) {
            wx.hideLoading();
            wx.showToast({ title: (err && err.message) || '网络错误', icon: 'none' });
          });
        }
      }
    });
  },
    cancelApplication: function(e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认取消',
      content: '确定取消这个行程的申请吗？',
      success: function(res) {
        if (res.confirm) {
          wx.showLoading({ title: '取消中...' });
          api.callFunction('cancelTrip', { tripId: id }).then(function(data) {
            wx.hideLoading();
            wx.showToast({ title: '已取消', icon: 'success' });
            that.loadTrips(true);
          }).catch(function(err) {
            wx.hideLoading();
            wx.showToast({ title: (err && err.message) || '网络错误', icon: 'none' });
          });
        }
      }
    });
  },
  requestStatusText: function(s) {
    var map = { "active": "待确认", "invited": "已邀请", "confirmed": "已确认", "cancelled": "已取消" };
    return map[s] || s;
  },
});