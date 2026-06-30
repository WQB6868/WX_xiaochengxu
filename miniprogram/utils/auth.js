var api = require("./api");

function checkLogin() {
  var app = getApp();
  if (app.globalData.isLogin && app.globalData.openid) {
    return Promise.resolve(app.globalData.userInfo);
  }
  return api.callFunction("login").then(function(data) {
    app.globalData.userInfo = data.user;
    app.globalData.openid = data.openid;
    app.globalData.isLogin = true;
    return data.user;
  });
}

function checkVerified() {
  var app = getApp();
  if (!app.globalData.isLogin) {
    wx.showToast({ title: "请先登录", icon: "none" });
    return Promise.reject({ code: 1002 });
  }
  if (!app.globalData.userInfo.idCardVerified) {
    wx.showModal({
      title: "实名认证",
      content: "发布行程前需要先进行实名认证",
      confirmText: "去认证",
      success: function(res) {
        if (res.confirm) {
          wx.navigateTo({ url: "/pages/auth/auth" });
        }
      }
    });
    return Promise.reject({ code: 1003 });
  }
  return Promise.resolve(app.globalData.userInfo);
}

module.exports = {
  checkLogin: checkLogin,
  checkVerified: checkVerified
};
