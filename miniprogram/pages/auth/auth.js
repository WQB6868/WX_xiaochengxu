var api = require("../../utils/api");
Page({
  data: { realName: "", idCard: "" },
  onInput: function(e) { var obj = {}; obj[e.currentTarget.dataset.field] = e.detail.value; this.setData(obj); },
  submitAuth: function() {
    var name = this.data.realName.trim();
    var idCard = this.data.idCard.trim();
    if (!name) { wx.showToast({ title: "请输入真实姓名", icon: "none" }); return; }
    if (!idCard) { wx.showToast({ title: "请输入身份证号", icon: "none" }); return; }
    if (!/^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(idCard)) {
      wx.showToast({ title: "身份证号格式不正确", icon: "none" }); return;
    }
    wx.showLoading({ title: "认证中...", mask: true });
    api.callFunction("idCardOcr", { realName: name, idCard: idCard }).then(function() {
      wx.hideLoading(); wx.showToast({ title: "认证成功", icon: "success" });
      var app = getApp();
      if (app.globalData.userInfo) app.globalData.userInfo.idCardVerified = true;
      setTimeout(function() { wx.navigateBack(); }, 1500);
    }).catch(function() { wx.hideLoading(); });
  }
});
