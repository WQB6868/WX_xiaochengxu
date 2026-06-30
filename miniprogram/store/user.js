// User state store
// Usage: var app = getApp(); app.globalData.userInfo
// This module provides helper functions

function getUserInfo() {
  var app = getApp();
  return app.globalData.userInfo || null;
}

function isLogin() {
  var app = getApp();
  return app.globalData.isLogin && !!app.globalData.openid;
}

function getOpenid() {
  var app = getApp();
  return app.globalData.openid || "";
}

module.exports = {
  getUserInfo: getUserInfo,
  isLogin: isLogin,
  getOpenid: getOpenid
};
