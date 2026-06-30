var api = require("../../utils/api");

Page({
  data: {
    userInfo: {}
  },

  onShow: function() {
    this.loadUserInfo();
  },

  loadUserInfo: function() {
    var app = getApp();
    this.setData({ userInfo: app.globalData.userInfo || {} });
    if (!app.globalData.isLogin) {
      api.callFunctionSilent("login").then(function(data) {
        app.globalData.userInfo = data.user;
        app.globalData.openid = data.openid;
        app.globalData.isLogin = true;
        this.setData({ userInfo: data.user });
      }.bind(this));
    }
  },



  goOilPrice: function() {
    wx.navigateTo({ url: "/miniprogram/pages/oil-price/oil-price" });
  },

  goVehicle: function() {
    wx.navigateTo({ url: "/miniprogram/pages/vehicle/vehicle" });
  },

  goAuth: function() {
    wx.navigateTo({ url: "/miniprogram/pages/auth/auth" });
  },

  contactService: function() {
    wx.showModal({
      title: "联系客服",
      content: "请发送邮件至：support@hometogether.com\n或在小程序内反馈",
      showCancel: false
    });
  },

  showAbout: function() {
    wx.showModal({
      title: "关于老乡同行",
      content: "老乡同行 v1.0\n\n节假日私家车顺风车信息搭台平台。\n仅提供信息发布，不参与交易。\n\n安全提示：上车前请核对车主信息，分享行程给亲友。",
      showCancel: false
    });
  }
});

