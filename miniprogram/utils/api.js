var ERROR_CODE = require("./constants").ERROR_CODE;

function callFunction(name, data) {
  return new Promise(function(resolve, reject) {
    wx.showLoading({ title: "加载中...", mask: true });
    wx.cloud.callFunction({
      name: name,
      data: data || {}
    }).then(function(res) {
      wx.hideLoading();
      if (res.result && res.result.code === 0) {
        resolve(res.result.data);
      } else {
        var msg = res.result ? res.result.message : "出错了";
        wx.showToast({ title: msg, icon: "none" });
        reject(res.result);
      }
    }).catch(function(err) {
      wx.hideLoading();
      wx.showToast({ title: "网络错误", icon: "none" });
      reject(err);
    });
  });
}

function callFunctionSilent(name, data) {
  return new Promise(function(resolve, reject) {
    wx.cloud.callFunction({
      name: name,
      data: data || {}
    }).then(function(res) {
      if (res.result && res.result.code === 0) {
        resolve(res.result.data);
      } else {
        reject(res.result);
      }
    }).catch(function(err) {
      reject(err);
    });
  });
}

module.exports = {
  callFunction: callFunction,
  callFunctionSilent: callFunctionSilent
};
