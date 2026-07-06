var api = require("../../utils/api");
var timeUtil = require("../../utils/time");

Page({
  data: {
    trip: null, tripId: "", loading: true,
    isOwner: false, hasApplied: false, applyStatus: "",
    myConfirm: false, pendingCount: 0,
    hasCoords: false, markers: [],
    dateDisplay: "", vehicleDisplay: "", priceDisplay: "",
    showApplicants: false, driverPhone: "",
    applyPhone: "", applyCount: 1,
    applyStatusText: "", applyStatusIcon: "", applyStatusClass: "",
    applyPhoneDisplay: "", passengerCount: 0
  },

  onLoad: function(options) {
    if (options.id) {
      this.setData({ tripId: options.id });
      this.loadDetail();
    }
  },

  loadDetail: function() {
    var that = this;
    api.callFunction("getTripDetail", { tripId: this.data.tripId }).then(function(data) {
      var app = getApp();
      var openid = app.globalData.openid || "";
      var userPhone = app.globalData.userInfo.phone || "";
      var isOwner = data._openid === openid;

      // Check my application status
      var hasApplied = false, applyStatus = "", myConfirm = false;
      var myEntry = (data.passengers || []).find(function(p) { return p.openid === openid; });
      if (myEntry) {
        hasApplied = true;
        applyStatus = myEntry.status;
        myConfirm = myEntry.status === "confirmed";
      }

      var pendingCount = (data.passengers || []).filter(function(p) { return p.status === "pending"; }).length;
      var hasCoords = data.from && data.from.latitude && data.from.longitude;
      var markers = hasCoords ? [{ id: 0, latitude: data.from.latitude, longitude: data.from.longitude, iconPath: "/assets/icons/marker.png", width: 32, height: 32 }] : [];

      var d = new Date(data.departDate);
      var dateDisplay = (d.getMonth()+1) + "月" + d.getDate() + "日 " + data.departTime;

      var v = data.vehicleInfo || {};
      var vehicleDisplay = [v.brand, v.model, v.color, v.plateNumber].filter(Boolean).join(" · ") || "未填写";
      var priceDisplay = data.price > 0 ? "¥" + data.price + "/人" : "免费";
      var driverPhone = data.contactPhone || (data.driver && data.driver.phone) || "";

      // Set apply status display
      var applyStatusText = "", applyStatusIcon = "", applyStatusClass = "";
      var applyPhoneDisplay = "", applyCount = 1;
      if (myEntry) {
        applyPhoneDisplay = myEntry.phone || "";
        applyCount = myEntry.passengerCount || 1;
        if (myEntry.status === "pending") {
          applyStatusText = "已提交申请，等待车主确认";
          applyStatusIcon = "⏳";
          applyStatusClass = "pending";
        } else if (myEntry.status === "confirmed") {
          applyStatusText = "已确认同行，出发前请联系车主";
          applyStatusIcon = "✅";
          applyStatusClass = "confirmed";
        } else if (myEntry.status === "rejected") {
          applyStatusText = "车主已拒绝您的申请";
          applyStatusIcon = "❌";
          applyStatusClass = "rejected";
        } else if (myEntry.status === "cancelled") {
          applyStatusText = "已取消申请";
          applyStatusIcon = "📪";
          applyStatusClass = "cancelled";
        }
      }

      that.setData({
        trip: data, isOwner: isOwner,
        hasApplied: hasApplied, applyStatus: applyStatus,
        myConfirm: myConfirm,
        pendingCount: pendingCount,
        hasCoords: hasCoords, markers: markers,
        dateDisplay: dateDisplay, vehicleDisplay: vehicleDisplay,
        priceDisplay: priceDisplay, driverPhone: driverPhone,
        applyPhone: "", applyCount: applyCount,
        applyStatusText: applyStatusText, applyStatusIcon: applyStatusIcon,
        applyStatusClass: applyStatusClass,
        applyPhoneDisplay: applyPhoneDisplay,
        passengerCount: data.passengerCount || 0,
        loading: false
      });
    }).catch(function() {
      that.setData({ loading: false });
    });
  },

  // 申请相关：输入电话
  onPhoneInput: function(e) {
    this.setData({ applyPhone: e.detail.value });
  },

  // 申请相关：增加人数
  increaseCount: function() {
    var maxSeats = (this.data.trip && this.data.trip.remainingSeats) || 10;
    if (this.data.applyCount < maxSeats) {
      this.setData({ applyCount: this.data.applyCount + 1 });
    } else {
      wx.showToast({ title: "不能超过剩余座位数", icon: "none" });
    }
  },

  // 申请相关：减少人数
  decreaseCount: function() {
    if (this.data.applyCount > 1) {
      this.setData({ applyCount: this.data.applyCount - 1 });
    }
  },

  // 提交申请
  submitApply: function() {
    var that = this;
    var phone = this.data.applyPhone;
    var count = this.data.applyCount;

    if (!phone || phone.length < 7) {
      wx.showToast({ title: "请填写正确的联系电话", icon: "none" });
      return;
    }

    wx.showModal({
      title: "提交申请",
      content: "确定申请同行吗？\n申请人数：" + count + " 人\n联系电话：" + phone,
      success: function(res) {
        if (res.confirm) {
          api.callFunction("applyTrip", {
            tripId: that.data.tripId,
            phone: phone,
            passengerCount: count
          }).then(function() {
            wx.showToast({ title: "申请已提交", icon: "success" });
            that.loadDetail();
          });
        }
      }
    });
  },

  // 取消申请
  cancelApply: function() {
    var that = this;
    wx.showModal({
      title: "取消申请",
      content: "确定取消申请吗？",
      confirmText: "确定取消",
      confirmColor: "#fa5151",
      success: function(res) {
        if (res.confirm) {
          api.callFunction("cancelTrip", { tripId: that.data.tripId }).then(function() {
            wx.showToast({ title: "已取消申请", icon: "success" });
            that.loadDetail();
          });
        }
      }
    });
  },

  // 重新申请（重置后重填）
  resetApply: function() {
    this.setData({ hasApplied: false, applyPhone: "", applyCount: 1 });
  },

  // 车主：确认乘客
  confirmPassenger: function(e) {
    var that = this;
    var passengerOpenId = e.currentTarget.dataset.openid;
    wx.showModal({
      title: "确认乘客",
      content: "确定确认该乘客同行吗？",
      success: function(res) {
        if (res.confirm) {
          api.callFunction("confirmRide", {
            tripId: that.data.tripId,
            passengerOpenId: passengerOpenId,
            action: "confirm"
          }).then(function() {
            wx.showToast({ title: "已确认乘客", icon: "success" });
            that.loadDetail();
          }).catch(function(err) {
            wx.showToast({ title: (err && err.message) || "确认失败", icon: "none" });
          });
        }
      }
    });
  },

  // 车主：拒绝乘客
  rejectPassenger: function(e) {
    var that = this;
    var passengerOpenId = e.currentTarget.dataset.openid;
    wx.showModal({
      title: "拒绝乘客",
      content: "确定拒绝该乘客的申请吗？",
      confirmText: "拒绝",
      confirmColor: "#fa5151",
      success: function(res) {
        if (res.confirm) {
          api.callFunction("confirmRide", {
            tripId: that.data.tripId,
            passengerOpenId: passengerOpenId,
            action: "reject"
          }).then(function() {
            wx.showToast({ title: "已拒绝", icon: "success" });
            that.loadDetail();
          }).catch(function(err) {
            wx.showToast({ title: (err && err.message) || "拒绝失败", icon: "none" });
          });
        }
      }
    });
  },

  // 乘客：确认同行（直接确认，旧逻辑保留）
  confirmRide: function() {
    var that = this;
    wx.showModal({
      title: "确认同行",
      content: "联系车主确认后，点击确定\n确认后车主将看到您的信息",
      success: function(res) {
        if (res.confirm) {
          api.callFunction("confirmRide", { tripId: that.data.tripId }).then(function() {
            wx.showToast({ title: "已确认同行", icon: "success" });
            that.loadDetail();
          });
        }
      }
    });
  },

  // 乘客：取消确认
  cancelConfirm: function() {
    var that = this;
    wx.showModal({
      title: "取消确认",
      content: "确定取消同行确认吗？",
      confirmText: "确定取消",
      confirmColor: "#fa5151",
      success: function(res) {
        if (res.confirm) {
          api.callFunction("cancelTrip", { tripId: that.data.tripId }).then(function() {
            wx.showToast({ title: "已取消", icon: "success" });
            that.loadDetail();
          });
        }
      }
    });
  },

  toggleApplicants: function() {
    this.setData({ showApplicants: !this.data.showApplicants });
  },

  // 联系车主
  contactDriver: function() {
    var phone = this.data.driverPhone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    }
  },

  // 车主：确认发车
  startTrip: function() {
    var that = this;
    wx.showModal({
      title: "确认发车",
      content: "确认后行程状态将更新为「已出发」",
      success: function(res) {
        if (res.confirm) {
          api.callFunction("updateTripStatus", { tripId: that.data.tripId, status: "departed" }).then(function() {
            wx.showToast({ title: "祝一路平安！", icon: "success" });
            that.loadDetail();
          });
        }
      }
    });
  },

  // 车主：删除行程
  deleteTrip: function() {
    var that = this;
    wx.showModal({
      title: "删除行程",
      content: "确定要永久删除此行程吗？删除后不可恢复",
      confirmText: "删除",
      confirmColor: "#fa5151",
      success: function(res) {
        if (res.confirm) {
          api.callFunction("deleteTrip", { tripId: that.data.tripId }).then(function() {
            wx.showToast({ title: "已删除", icon: "success" });
            setTimeout(function() { wx.navigateBack(); }, 1500);
          });
        }
      }
    });
  },

  rateTrip: function() {
    wx.showToast({ title: "评价功能开发中", icon: "none" });
  },
  callPassenger: function(e) {
    var phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    }
  }
});
