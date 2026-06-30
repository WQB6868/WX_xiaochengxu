/* eslint-disable */
App({
  onLaunch: function () {
    try {
      wx.cloud.init({
        env: wx.cloud.DYNAMIC_CURRENT_ENV,
        traceUser: true
      });
    } catch (e) {
      console.warn("cloud init failed, running in offline mode", e);
    }
    this.initUser();
  },

  globalData: {
    userInfo: {
      nickName: "游客",
      avatarUrl: "",
      phone: "",
      ratingAvg: 0,
      ratingCount: 0,
      idCardVerified: false,
      tripCountAsDriver: 0,
      tripCountAsPassenger: 0
    },
    openid: "",
    isLogin: false
  },

  initUser: function () {
    var that = this;
    // Try to login via cloud, silently fail if cloud not available
    wx.cloud.callFunction({
      name: "login"
    }).then(function (res) {
      if (res.result && res.result.code === 0) {
        var data = res.result.data;
        that.globalData.userInfo = data.user;
        that.globalData.openid = data.openid;
        that.globalData.isLogin = true;
        console.log("User logged in:", data.openid);
      }
    }).catch(function (err) {
      console.warn("Cloud login failed, running in guest mode:", err);
      // Guest mode - UI still works, cloud features disabled
      that.globalData.isLogin = false;
    });
  }
});
