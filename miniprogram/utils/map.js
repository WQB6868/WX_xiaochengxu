var QQMapWX = require("../libs/qqmap-wx-jssdk.min");

var qqmapsdk = null;

function getMapInstance() {
  if (!qqmapsdk) {
    qqmapsdk = new QQMapWX({
      key: "请替换为腾讯地图Key" // 在 https://lbs.qq.com/ 申请
    });
  }
  return qqmapsdk;
}

function chooseLocation() {
  return new Promise(function(resolve, reject) {
    wx.chooseLocation({
      success: resolve,
      fail: function(err) {
        if (err.errMsg.indexOf("cancel") > -1) {
          reject({ code: "cancel" });
        } else {
          wx.showToast({ title: "定位失败", icon: "none" });
          reject(err);
        }
      }
    });
  });
}

function searchPOI(keyword, region) {
  return new Promise(function(resolve, reject) {
    getMapInstance().search({
      keyword: keyword,
      region: region || "",
      page_size: 20,
      success: function(res) {
        resolve(res.data || []);
      },
      fail: reject
    });
  });
}

function reverseGeocoding(lat, lng) {
  return new Promise(function(resolve, reject) {
    getMapInstance().reverseGeocoder({
      location: lat + "," + lng,
      success: function(res) {
        resolve(res.result);
      },
      fail: reject
    });
  });
}

module.exports = {
  chooseLocation: chooseLocation,
  searchPOI: searchPOI,
  reverseGeocoding: reverseGeocoding,
  getMapInstance: getMapInstance
};
