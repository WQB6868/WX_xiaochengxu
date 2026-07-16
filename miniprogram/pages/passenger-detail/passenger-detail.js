var api = require("../../utils/api");
var constants = require("../../utils/constants");

Page({
  data: {
    loading: true,
    request: {},
    requestId: "",
    dateDisplay: "",
    myTrips: [],
    hasTrips: false,
    selectedTripId: "",
    invited: false,
    phoneViewStatus: "none",
    phoneViewMsg: "",
    matchedTrips: [],
    hasMatchedTrips: false
  },

  onLoad: function(options) {
    if (options.id) {
      this.setData({ requestId: options.id });
      this.loadData();
    }
  },

  loadData: function() {
    var that = this;
    // Load request detail and user's recruiting trips in parallel
    Promise.all([
      new Promise(function(resolve, reject) {
        api.callFunction("getRequestDetail", { requestId: that.data.requestId }).then(function(data) {
          resolve(data);
        }).catch(function() { resolve(null); });
      }),
      new Promise(function(resolve, reject) {
        api.callFunction("getMyTrips", { role: "driver", status: "recruiting" }).then(function(data) {
          resolve(data);
        }).catch(function() { resolve(null); });
      })
    ]).then(function(results) {
      var reqData = results[0];
      var tripsData = results[1];
      
      if (!reqData) {
        wx.showToast({ title: "请求不存在", icon: "none" });
        that.setData({ loading: false });
        return;
      }

      var dateDisplay = "";
      if (reqData.departDate) {
        try {
          var d = new Date(reqData.departDate);
          if (!isNaN(d.getTime())) {
            dateDisplay = (d.getMonth()+1) + "月" + d.getDate() + "日" + (reqData.departTime ? " " + reqData.departTime : "");
          }
        } catch(e) {}
      }

      var myTrips = (tripsData && tripsData.list) || [];
      var hasTrips = myTrips.length > 0;
      // Select first trip by default
      if (hasTrips) {
        myTrips[0].selected = true;
      }

      // Filter trips that match the passenger route
      var matchedTrips = that.matchRouteTrips(myTrips, reqData);
      var hasMatchedTrips = matchedTrips.length > 0;
      if (hasMatchedTrips) matchedTrips[0].selected = true;

      that.setData({
        request: reqData,
        maskedContactPhone: constants.maskPhone(reqData.contactPhone),
        dateDisplay: dateDisplay,
        myTrips: myTrips,
        hasTrips: hasTrips,
        matchedTrips: matchedTrips,
        hasMatchedTrips: hasMatchedTrips,
        selectedTripId: hasMatchedTrips ? matchedTrips[0]._id : "",
        loading: false
      });
      // Check phone view permission on load
      that.checkPhoneView();


    });
  },

  onTripSelect: function(e) {
    this.setData({ selectedTripId: e.detail.value });
  },

  // Match passenger route with driver trips
  matchRouteTrips: function(trips, req) {
    if (!trips || !req) return [];
    var results = [];
    for (var i = 0; i < trips.length; i++) {
      var t = trips[i];
      var fromCity = (t.from && t.from.city) || "";
      var toCity = (t.to && t.to.city) || "";
      // Handle "市" suffix variations
      var reqFrom = req.fromCity || "";
      var reqTo = req.toCity || "";
      var fromMatch = fromCity === reqFrom || fromCity === reqFrom + "市" || fromCity.replace("市", "") === reqFrom.replace("市", "");
      var toMatch = toCity === reqTo || toCity === reqTo + "市" || toCity.replace("市", "") === reqTo.replace("市", "");
      if (fromMatch && toMatch) {
        results.push(t);
      }
    }
    return results;
  },

  // Check phone view status (called on page load)
  checkPhoneView: function() {
    var that = this;
    var targetOpenId = this.data.request._openid;
    if (!targetOpenId) return;
    wx.cloud.callFunction({
      name: "phoneViewRequest",
      data: { action: "check", tripId: this.data.requestId, targetOpenId: targetOpenId }
    }).then(function(res) {
      if (res.result && res.result.code === 0) {
        that.setData({ phoneViewStatus: res.result.data.status });
      }
    }).catch(function() {});
  },

  // Request to view passenger phone (owner must approve)
  requestPhoneView: function() {
    var that = this;
    var targetOpenId = this.data.request._openid;
    if (!targetOpenId) { wx.showToast({ title: "用户信息异常", icon: "none" }); return; }
    wx.showLoading({ title: "申请中...", mask: true });
    wx.cloud.callFunction({
      name: "phoneViewRequest",
      data: { action: "request", tripId: this.data.requestId, targetOpenId: targetOpenId }
    }).then(function(res) {
      wx.hideLoading();
      if (res.result && res.result.code === 0) {
        wx.showToast({ title: "已发起申请，等待对方同意", icon: "none" });
        that.setData({ phoneViewStatus: "pending" });
      } else {
        wx.showToast({ title: res.result && res.result.message || "申请失败", icon: "none" });
      }
    }).catch(function() {
      wx.hideLoading();
      wx.showToast({ title: "网络错误", icon: "none" });
    });
  },

  invitePassenger: function() {
    var that = this;
    var tripId = this.data.selectedTripId;
    if (!tripId) {
      wx.showToast({ title: "请选择一个行程", icon: "none" });
      return;
    }
    
    var request = this.data.request;
    
    wx.showModal({
      title: "邀请乘客",
      content: "确定邀请该乘客加入您的行程吗？",
      success: function(res) {
        if (res.confirm) {
          api.callFunction("invitePassenger", {
            tripId: tripId,
            passengerOpenId: request._openid,
            phone: request.contactPhone || "",
            passengerCount: request.passengers || 1,
            nickname: (request.userInfo && request.userInfo.nickName) || "乘客",
            avatarUrl: (request.userInfo && request.userInfo.avatarUrl) || "",
            requestId: request._id
          }).then(function() {
            wx.showToast({ title: "邀请成功", icon: "success" });
            that.setData({ invited: true });
          });
        }
      }
    });
  },

  callPassenger: function() {
    var phone = this.data.request.contactPhone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    }
  },

  goPublish: function() {
    wx.navigateTo({ url: "/miniprogram/pages/publish/publish" });
  },

  goBack: function() {
    wx.navigateBack();
  }
});