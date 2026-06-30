var api = require("../../utils/api");
var timeUtil = require("../../utils/time");

Page({
  data: { trip: null, tripId: "", loading: true, isOwner: false, myConfirm: false, pendingCount: 0, hasRated: false, hasCoords: false, markers: [], dateDisplay: "", vehicleDisplay: "", priceDisplay: "", showApplicants: false, driverPhone: "" },
  onLoad: function(options) { if (options.id) { this.setData({ tripId: options.id }); this.loadDetail(); } },
  toggleApplicants: function() { this.setData({ showApplicants: !this.data.showApplicants }); },
  loadDetail: function() {
    var that = this;
    api.callFunction("getTripDetail", { tripId: this.data.tripId }).then(function(data) {
      var app = getApp();
      var openid = app.globalData.openid || "";
      var isOwner = data._openid === openid;
      var myConfirm = false;
      if (!isOwner) {
        var me = (data.passengers || []).find(function(p) { return p.openid === openid; });
        myConfirm = me && me.status === "confirmed";
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
      that.setData({ trip: data, isOwner: isOwner, myConfirm: myConfirm, pendingCount: pendingCount, hasCoords: hasCoords, markers: markers, dateDisplay: dateDisplay, vehicleDisplay: vehicleDisplay, priceDisplay: priceDisplay, driverPhone: driverPhone, loading: false });
    }).catch(function() { that.setData({ loading: false }); });
  },
  // 乘客：确认同行
  confirmRide: function() {
    var that = this;
    wx.showModal({ title: "确认同行", content: "联系车主确认后，点击确定\n确认后车主将看到您的信息", success: function(res) {
      if (res.confirm) {
        api.callFunction("confirmRide", { tripId: that.data.tripId }).then(function() {
          wx.showToast({ title: "已确认同行", icon: "success" });
          that.loadDetail();
        });
      }
    }});
  },
  // 乘客：取消确认
  cancelConfirm: function() {
    var that = this;
    wx.showModal({ title: "取消确认", content: "确定取消同行确认吗？", confirmText: "确定取消", confirmColor: "#fa5151", success: function(res) {
      if (res.confirm) {
        api.callFunction("cancelTrip", { tripId: that.data.tripId }).then(function() {
          wx.showToast({ title: "已取消", icon: "success" });
          that.loadDetail();
        });
      }
    }});
  },
  // 联系车主
  contactDriver: function() { var phone = this.data.driverPhone; if (phone) { wx.makePhoneCall({ phoneNumber: phone }); } },
  // 车主：确认发车
  startTrip: function() {
    var that = this;
    wx.showModal({ title: "确认发车", content: "确认后行程状态将更新为「已出发」", success: function(res) { if (res.confirm) { api.callFunction("updateTripStatus", { tripId: that.data.tripId, status: "departed" }).then(function() { wx.showToast({ title: "祝一路平安！", icon: "success" }); that.loadDetail(); }); } } });
  },
  // 车主：删除行程
  deleteTrip: function() {
    var that = this;
    wx.showModal({ title: "删除行程", content: "确定要永久删除此行程吗？删除后不可恢复", confirmText: "删除", confirmColor: "#fa5151", success: function(res) { if (res.confirm) { api.callFunction("deleteTrip", { tripId: that.data.tripId }).then(function() { wx.showToast({ title: "已删除", icon: "success" }); setTimeout(function() { wx.navigateBack(); }, 1500); }); } } });
  },
  rateTrip: function() { wx.showToast({ title: "评价功能开发中", icon: "none" }); }
});
