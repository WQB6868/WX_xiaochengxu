var api = require("../../utils/api");

Page({
  data: {
    loading: true,
    request: {},
    requestId: "",
    dateDisplay: "",
    myTrips: [],
    hasTrips: false,
    selectedTripId: "",
    invited: false
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
            dateDisplay = (d.getMonth()+1) + "月" + d.getDate() + "日";
          }
        } catch(e) {}
      }

      var myTrips = (tripsData && tripsData.list) || [];
      var hasTrips = myTrips.length > 0;
      // Select first trip by default
      if (hasTrips) {
        myTrips[0].selected = true;
      }

      that.setData({
        request: reqData,
        dateDisplay: dateDisplay,
        myTrips: myTrips,
        hasTrips: hasTrips,
        selectedTripId: hasTrips ? myTrips[0]._id : "",
        loading: false
      });
    });
  },

  onTripSelect: function(e) {
    this.setData({ selectedTripId: e.detail.value });
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