var api = require("../../utils/api");
var constants = require("../../utils/constants");
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
    applyPhoneDisplay: "", passengerCount: 0,
    // Privacy agreement
    agreeChecked: false,
    // Application timestamps
    applyTime: null,
    agreeTime: null,
    confirmTime: null
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
        that.setData({
          applyTime: myEntry.applyTime || null,
          agreeTime: myEntry.agreeTime || null,
          confirmTime: myEntry.confirmTime || null
        });
        if (myEntry.status === "pending") {
          applyStatusText = "已提交申请，等待车主响应";
          applyStatusIcon = "⏳";
          applyStatusClass = "pending";
        } else if (myEntry.status === "communicating") {
          applyStatusText = "车主已同意沟通，联系方式已显示，请与车主联系";
          applyStatusIcon = "📞";
          applyStatusClass = "communicating";
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

      // Add maskedPhone to passengers
      if (data.passengers) {
        data.passengers = data.passengers.map(function(p) {
          p.maskedPhone = constants.maskPhone(p.phone);
          return p;
        });
      }
      that.setData({
        trip: data, isOwner: isOwner,
        hasApplied: hasApplied, applyStatus: applyStatus,
        myConfirm: myConfirm,
        pendingCount: pendingCount,
        hasCoords: hasCoords, markers: markers,
        dateDisplay: dateDisplay, vehicleDisplay: vehicleDisplay,
        priceDisplay: priceDisplay, driverPhone: driverPhone,
    maskedDriverPhone: constants.maskPhone(driverPhone),
        applyPhone: "", applyCount: applyCount,
        applyStatusText: applyStatusText, applyStatusIcon: applyStatusIcon,
        applyStatusClass: applyStatusClass,
        applyPhoneDisplay: applyPhoneDisplay,
    maskedApplyPhone: constants.maskPhone(applyPhoneDisplay),
        passengerCount: data.passengerCount || 0,
        loading: false
      });
      // Increment view count via cloud function (bypasses security rules)
      try {
        wx.cloud.callFunction({ name: "recordView", data: { tripId: that.data.tripId } }).catch(function() {});
      } catch(e) {}

      // Check phone view status after loading
      that.checkPhoneViewStatus();
    }).catch(function() {
      that.setData({ loading: false });
    });
  },

  // Check if user is logged in with phone
  checkLogin: function() {
    var app = getApp();
    if (!app.globalData.openid) {
      wx.showToast({ title: "请先登录", icon: "none" });
      wx.navigateTo({ url: "/miniprogram/pages/auth/auth" });
      return false;
    }
    return true;
  },

  // Toggle privacy agreement
  toggleAgree: function() {
    this.setData({ agreeChecked: !this.data.agreeChecked });
  },

  checkPhoneViewStatus: function() {
    var that = this;
    var tripId = this.data.tripId;
    var tripData = this.data.trip;
    if (!tripData) return;
    var targetOpenId = tripData._openid;
    if (!targetOpenId) return;
    api.callFunctionSilent("phoneViewRequest", {
      action: "check",
      tripId: tripId,
      targetOpenId: targetOpenId
    }).then(function(res) {
      that.setData({
        phoneViewStatus: res.status,
        phoneViewRequestId: res.requestId,
        phoneViewReverseApproved: res.reverseApproved || false
      });
    }).catch(function() {});
  },

  requestPhoneView: function() {
    var that = this;
    var tripId = this.data.tripId;
    var targetOpenId = this.data.trip._openid;
    if (!tripId || !targetOpenId) return;
    that.setData({ phoneViewLoading: true });
    api.callFunction("phoneViewRequest", {
      action: "request",
      tripId: tripId,
      targetOpenId: targetOpenId
    }).then(function(res) {
      wx.showToast({ title: "已发送申请，等待对方同意", icon: "none" });
      that.setData({
        phoneViewStatus: "pending",
        phoneViewRequestId: res.requestId,
        phoneViewLoading: false
      });
    }).catch(function() {
      that.setData({ phoneViewLoading: false });
    });
  },

  approvePhoneView: function(e) {
    var that = this;
    var requestId = e.currentTarget.dataset.reqid || "";
    var approved = e.currentTarget.dataset.approved === "true";
    if (!requestId) return;
    wx.showModal({
      title: approved ? "同意查看号码" : "拒绝查看号码",
      content: approved ? "同意后对方将能看到您的手机号" : "确定拒绝对方的查看申请吗？",
      success: function(res) {
        if (res.confirm) {
          api.callFunction("phoneViewRequest", {
            action: "approve",
            requestId: requestId,
            approved: approved
          }).then(function() {
            wx.showToast({ title: approved ? "已同意" : "已拒绝", icon: "success" });
            that.loadDetail();
          }).catch(function() {});
        }
      }
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
    // Check login
    if (!this.checkLogin()) return;
    // Check privacy agreement
    if (!this.data.agreeChecked) {
      wx.showToast({ title: "请先阅读并同意隐私协议", icon: "none" });
      return;
    }
    var phone = this.data.applyPhone;
    var count = this.data.applyCount;
    if (!phone || phone.length < 7) {
      wx.showToast({ title: "请填写正确的联系电话", icon: "none" });
      return;
    }
    wx.showModal({
      title: "确认申请",
      content: "您发起申请即视为授权平台在车主同意后将您的联系方式提供给对方用于出行沟通。\n申请人数：" + count + " 人",
      success: function(res) {
        if (res.confirm) {
          wx.showLoading({ title: "提交中...", mask: true });
          api.callFunction("applyTrip", {
            tripId: that.data.tripId,
            phone: phone,
            passengerCount: count
          }).then(function(res) {
            wx.hideLoading();
            wx.showToast({ title: "申请已发送，等待车主响应", icon: "success" });
            that.loadDetail();
          }).catch(function() {
            wx.hideLoading();
          });
        }
      }
    });
  },
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
          wx.requestSubscribeMessage({
            tmplIds: ["pgweCWotwr_vH1PwycKeRNtUuRHHD3WJ0DEcmX_pSZc"],
            success: function() {
              api.callFunction("confirmRide", { tripId: that.data.tripId }).then(function() {
                wx.showToast({ title: "已确认同行", icon: "success" });
                that.loadDetail();
              });
            },
            fail: function() {
              api.callFunction("confirmRide", { tripId: that.data.tripId }).then(function() {
                wx.showToast({ title: "已确认同行", icon: "success" });
                that.loadDetail();
              });
            }
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

  // Owner: agree to communicate (reveal phone numbers)
  agreeToCommunicate: function(e) {
    var that = this;
    var passengerOpenId = e.currentTarget.dataset.openid;
    if (!passengerOpenId) return;
    if (!this.checkLogin()) return;
    wx.showModal({
      title: "同意沟通",
      content: "同意后您和对方将能看到彼此的手机号，用于出行沟通。\n\n确认同意？",
      success: function(res) {
        if (res.confirm) {
          api.callFunction("confirmPassenger", {
            tripId: that.data.tripId,
            passengerOpenId: passengerOpenId,
            action: "agree"
          }).then(function() {
            wx.showToast({ title: "已同意沟通，号码已显示", icon: "success" });
            that.loadDetail();
          }).catch(function() {});
        }
      }
    });
  },

  // Owner: confirm ride (after communication)
  confirmRideOwner: function(e) {
    var that = this;
    var passengerOpenId = e.currentTarget.dataset.openid;
    if (!passengerOpenId) return;
    if (!this.checkLogin()) return;
    wx.showModal({
      title: "确认同行",
      content: "联系确认后，点击确定。确认后行程信息将更新。",
      success: function(res) {
        if (res.confirm) {
          api.callFunction("confirmPassenger", {
            tripId: that.data.tripId,
            passengerOpenId: passengerOpenId,
            action: "confirm"
          }).then(function() {
            wx.showToast({ title: "已确认同行", icon: "success" });
            that.loadDetail();
          }).catch(function() {});
        }
      }
    });
  },

  showPrivacyDetail: function() {
    wx.showModal({
      title: "\u300a\u9690\u79c1\u534f\u8bae\u300b",
      content: "\u60a8\u53d1\u8d77\u7533\u8bf7\u540e\uff0c\u5e73\u53f0\u5c06\u628a\u60a8\u7684\u8054\u7cfb\u65b9\u5f0f\u63d0\u4f9b\u7ed9\u5bf9\u65b9\u7528\u4e8e\u51fa\u884c\u6c9f\u901a\u3002\\n\\n\u5f53\u8f66\u4e3b\u70b9\u51fb\u201c\u540c\u610f\u6c9f\u901a\u201d\u540e\uff0c\u53cc\u65b9\u624b\u673a\u53f7\u5c06\u4e92\u76f8\u663e\u793a\u3002\\n\\n\u6240\u6709\u64cd\u4f5c\u5747\u4f1a\u8bb0\u5f55\u65f6\u95f4\u6233\uff0c\u7528\u4e8e\u51fa\u884c\u5b89\u5168\u4fdd\u969c\u3002",
      showCancel: false,
    });
  },

  toggleApplicants: function() {
    this.setData({ showApplicants: !this.data.showApplicants });
  },

  // 联系车主
  contactDriver: function() {
    var that = this;
    // Check permission: owner can always call, passenger needs communicating/confirmed status
    var canCall = this.data.isOwner || (this.data.hasApplied && (this.data.applyStatus === "communicating" || this.data.applyStatus === "confirmed"));
    if (!canCall) {
      if (!this.data.hasApplied) {
        wx.showToast({ title: "请先申请同行", icon: "none" });
      } else {
        wx.showToast({ title: "等待车主同意后可拨打", icon: "none" });
      }
      return;
    }
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

  // 车主：修改座位数
  editSeats: function() {
    var currentSeats = (this.data.trip && this.data.trip.seats) || 2;
    this.setData({ showSeatEditor: true, editSeatsValue: currentSeats });
  },

  seatStepper: function(e) {
    var delta = parseInt(e.currentTarget.dataset.delta);
    var newVal = this.data.editSeatsValue + delta;
    if (newVal < 1) newVal = 1;
    if (newVal > 20) newVal = 20;
    this.setData({ editSeatsValue: newVal });
  },

  confirmEditSeats: function() {
    var that = this;
    var newSeats = this.data.editSeatsValue;
    wx.showLoading({ title: "更新中...", mask: true });
    wx.cloud.database().collection("trips").doc(that.data.tripId).update({
      data: { seats: newSeats }
    }).then(function() {
      wx.hideLoading();
      wx.showToast({ title: "座位数已更新", icon: "success" });
      that.setData({ showSeatEditor: false });
      that.loadDetail();
    }).catch(function() {
      wx.hideLoading();
      wx.showToast({ title: "更新失败", icon: "none" });
    });
  },

  cancelEditSeats: function() {
    this.setData({ showSeatEditor: false });
  },
  rateTrip: function() {
    wx.showToast({ title: "评价功能开发中", icon: "none" });
  },
  callPassenger: function(e) {
    var phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    } else {
      wx.showToast({ title: '该乘客未提供联系电话', icon: 'none' });
    }
  }
});


