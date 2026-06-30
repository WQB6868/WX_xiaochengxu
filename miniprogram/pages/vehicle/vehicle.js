var api = require("../../utils/api");
Page({
  data: { vehicles: [], selectMode: false, loading: true, form: { brand: "", model: "", color: "", seats: 4, plateNumber: "" } },
  onLoad: function(options) { if (options.select === "1") this.setData({ selectMode: true }); this.loadVehicles(); },
  loadVehicles: function() {
    var that = this;
    wx.cloud.database().collection("vehicles").where({ _openid: getApp().globalData.openid, status: "active" }).get().then(function(res) { that.setData({ vehicles: res.data || [], loading: false }); }).catch(function() { that.setData({ loading: false }); });
  },
  onFormInput: function(e) { var obj = {}; obj["form." + e.currentTarget.dataset.field] = e.detail.value; this.setData(obj); },
  addVehicle: function() {
    var that = this; var form = this.data.form;
    if (!form.brand || !form.model || !form.plateNumber) { wx.showToast({ title: "请填写完整信息", icon: "none" }); return; }
    wx.showLoading({ title: "保存中...", mask: true });
    wx.cloud.database().collection("vehicles").add({ data: { _openid: getApp().globalData.openid, brand: form.brand, model: form.model, color: form.color || "", plateNumber: form.plateNumber, seats: parseInt(form.seats) || 4, photos: [], isDefault: that.data.vehicles.length === 0, status: "active", createTime: wx.cloud.database().serverDate(), updateTime: wx.cloud.database().serverDate() } }).then(function() { wx.hideLoading(); wx.showToast({ title: "添加成功", icon: "success" }); that.setData({ form: { brand: "", model: "", color: "", seats: 4, plateNumber: "" } }); that.loadVehicles(); }).catch(function() { wx.hideLoading(); wx.showToast({ title: "添加失败", icon: "none" }); });
  },
  selectVehicle: function(e) { if (!this.data.selectMode) return; var item = e.currentTarget.dataset.item; var ec = this.getOpenerEventChannel(); if (ec) ec.emit("acceptData", item); wx.navigateBack(); },
  setDefault: function(e) {
    var id = e.currentTarget.dataset.id; var that = this;
    wx.cloud.database().collection("vehicles").where({ _openid: getApp().globalData.openid }).get().then(function(res) { return Promise.all((res.data || []).map(function(v) { return wx.cloud.database().collection("vehicles").doc(v._id).update({ data: { isDefault: v._id === id } }); })); }).then(function() { wx.showToast({ title: "已设为默认", icon: "success" }); that.loadVehicles(); });
  },
  deleteVehicle: function(e) {
    var id = e.currentTarget.dataset.id; var that = this;
    wx.showModal({ title: "删除车辆", content: "确定要删除这辆车吗？", success: function(res) { if (res.confirm) { wx.cloud.database().collection("vehicles").doc(id).update({ data: { status: "deleted" } }).then(function() { wx.showToast({ title: "已删除", icon: "success" }); that.loadVehicles(); }); } } });
  }
});
