var api = require("../../utils/api");
var auth = require("../../utils/auth");
var constants = require("../../utils/constants");

var CITIES = ["北京","上海","广州","深圳","杭州","南京","武汉","成都","重庆","郑州","西安","长沙","合肥","南昌","福州","厦门","济南","青岛","大连","沈阳","哈尔滨","昆明","贵阳","南宁","海口","太原","石家庄","呼和浩特","银川","西宁","兰州","拉萨","乌鲁木齐","天津","苏州","无锡","宁波","东莞","佛山"];

Page({
  data: {
    mode: "publish",
    form: {
      fromAddress: "", fromProvince: "", fromCity: "", fromDistrict: "", fromLat: 0, fromLng: 0, fromDetail: "",
      toAddress: "", toProvince: "", toCity: "", toDistrict: "", toLat: 0, toLng: 0, toDetail: "",
      departDate: "", departTime: "", seats: 2, price: 0, vehicleId: "", tags: [], remarks: "", contactPhone: "", requestPhone: "",
      maxPrice: -1, passengers: 1
    },
    vehicleInfo: "",
    tagOptions: constants.TRIP_TAGS,
    today: (function() { var d = new Date(); return d.getFullYear() + "-" + ((d.getMonth()+1)<10?"0":"") + (d.getMonth()+1) + "-" + (d.getDate()<10?"0":"") + d.getDate(); })(),
    // request search fields removed
    passengerRequests: []
  },

  onLoad: function(options) {
    var mode = (options && options.mode) || "publish";
    this.setData({ mode: mode });
    wx.setNavigationBarTitle({ title: mode === "request" ? "求车" : "发布车源" });
    if (mode === "publish") {
      auth.checkVerified().catch(function() {});
      this.loadRequests();
    }
  },

  switchMode: function(e) {
    var mode = e.currentTarget.dataset.mode;
    this.setData({ mode: mode });
    wx.setNavigationBarTitle({ title: mode === "request" ? "求车" : "发布车源" });
    if (mode === "publish") { this.loadRequests(); }
    if (mode === "request") {
      this.setData({ passengerRequests: [] });
    }
  },

  onInput: function(e) {
    var obj = {};
    obj["form." + e.currentTarget.dataset.field] = e.detail.value;
    this.setData(obj);
  },

  chooseFrom: function() {
    var that = this;
    wx.chooseLocation({
      success: function(res) {
        var parts = (res.address || "").split(" ");
        that.setData({
          "form.fromAddress": res.name || res.address,
          "form.fromProvince": parts[0] || "",
          "form.fromCity": parts[1] || parts[0] || "",
          "form.fromDistrict": parts[2] || "",
          "form.fromLat": res.latitude,
          "form.fromLng": res.longitude
        });
      }
    });
  },

  chooseTo: function() {
    var that = this;
    wx.chooseLocation({
      success: function(res) {
        var parts = (res.address || "").split(" ");
        that.setData({
          "form.toAddress": res.name || res.address,
          "form.toProvince": parts[0] || "",
          "form.toCity": parts[1] || parts[0] || "",
          "form.toDistrict": parts[2] || "",
          "form.toLat": res.latitude,
          "form.toLng": res.longitude
        });
      }
    });
  },

  extractCity: function(address) {
    if (!address) return "";
    for (var i = 0; i < CITIES.length; i++) {
      if (address.indexOf(CITIES[i]) !== -1) return CITIES[i];
    }
    return address.substring(0, 2);
  },

  onDateChange: function(e) { this.setData({ "form.departDate": e.detail.value }); },
  onTimeChange: function(e) { this.setData({ "form.departTime": e.detail.value }); },

  changeSeats: function(e) {
    var s = this.data.form.seats + parseInt(e.currentTarget.dataset.delta);
    if (s < 1) s = 1; if (s > 4) s = 4;
    this.setData({ "form.seats": s });
  },

  changePassengers: function(e) {
    var s = this.data.form.passengers + parseInt(e.currentTarget.dataset.delta);
    if (s < 1) s = 1; if (s > 10) s = 10;
    this.setData({ "form.passengers": s });
  },

  setMaxPrice: function(e) {
    this.setData({ "form.maxPrice": parseInt(e.currentTarget.dataset.price) });
  },

  toggleTag: function(e) {
    var tag = e.currentTarget.dataset.tag;
    var tags = this.data.form.tags;
    var idx = tags.indexOf(tag);
    if (idx > -1) tags.splice(idx,1); else tags.push(tag);
    this.setData({ "form.tags": tags });
  },

  selectVehicle: function() {
    var that = this;
    wx.navigateTo({
      url: "/miniprogram/pages/vehicle/vehicle?select=1",
      events: { acceptData: function(d) { that.setData({ "form.vehicleId": d._id, vehicleInfo: d.brand + " " + d.model + " " + d.plateNumber }); } }
    });
  },

  submitPublish: function() {
    var that = this;
    var form = this.data.form;
    if (!form.fromAddress) { wx.showToast({ title: "请输入出发地", icon: "none" }); return; }
    if (!form.toAddress) { wx.showToast({ title: "请输入目的地", icon: "none" }); return; }
    if (!form.departDate) { wx.showToast({ title: "请选择日期", icon: "none" }); return; }
    if (!form.departTime) { wx.showToast({ title: "请选择时间", icon: "none" }); return; }
    if (!form.contactPhone || form.contactPhone.length !== 11) { wx.showToast({ title: "请填写正确的手机号", icon: "none" }); return; }

    var fromCity = form.fromCity || this.extractCity(form.fromAddress);
    var toCity = form.toCity || this.extractCity(form.toAddress);

    wx.showModal({
      title: "确认发布",
      content: "发布后乘客将看到您的车源信息",
      success: function(res) {
        if (res.confirm) {
          api.callFunction("publishTrip", {
            from: {
              province: form.fromProvince || fromCity, city: fromCity,
              district: form.fromDistrict,
              address: form.fromAddress + (form.fromDetail ? " " + form.fromDetail : ""),
              latitude: form.fromLat, longitude: form.fromLng
            },
            to: {
              province: form.toProvince || toCity, city: toCity,
              district: form.toDistrict,
              address: form.toAddress + (form.toDetail ? " " + form.toDetail : ""),
              latitude: form.toLat, longitude: form.toLng
            },
            departDate: form.departDate, departTime: form.departTime,
            seats: form.seats, price: parseFloat(form.price) || 0,
            vehicleId: form.vehicleId, tags: form.tags, remarks: form.remarks, contactPhone: form.contactPhone
          }).then(function() {
            wx.showToast({ title: "发布成功", icon: "success" });
            setTimeout(function() { wx.navigateBack(); }, 1500);
          });
        }
      }
    });
  },

  submitRequest: function() {
    var that = this;
    var form = this.data.form;
    if (!form.fromCity) { wx.showToast({ title: "请输入出发城市", icon: "none" }); return; }
    if (!form.toCity) { wx.showToast({ title: "请输入目的城市", icon: "none" }); return; }

    var openid = getApp().globalData.openid;
    if (!openid) { wx.showToast({ title: "登录状态异常", icon: "none" }); return; }

    if (form.requestPhone && form.requestPhone.length === 11) {
      wx.cloud.database().collection("users").doc(openid).update({
        data: { phone: form.requestPhone }
      }).catch(function() {});
    }

    wx.showLoading({ title: "发布中...", mask: true });

    wx.cloud.database().collection("requests").add({
      data: {
        _openid: openid,
        fromCity: form.fromCity,
        toCity: form.toCity,
        departDate: form.departDate,
        passengers: parseInt(form.passengers) || 1,
        contactPhone: form.requestPhone || "",
        remarks: form.remarks || "",
        status: "active",
        createTime: wx.cloud.database().serverDate(),
        updateTime: wx.cloud.database().serverDate()
      }
    }).then(function() {
      wx.hideLoading();
      wx.showToast({ title: "求车信息已发布", icon: "success" });
      setTimeout(function() { wx.navigateBack(); }, 1500);
    }).catch(function(err) {
      console.warn("publishRequest direct write failed:", err);
      wx.hideLoading();
      api.callFunctionSilent("publishRequest", {
        fromCity: form.fromCity, toCity: form.toCity,
        departDate: form.departDate || undefined,
        passengers: form.passengers, contactPhone: form.requestPhone,
        remarks: form.remarks
      }).then(function() {
        wx.showToast({ title: "求车信息已发布", icon: "success" });
        setTimeout(function() { wx.navigateBack(); }, 1500);
      }).catch(function() {
        wx.showModal({
          title: "发布失败",
          content: "请在微信开发者工具中：\n1. 创建数据库集合「requests」\n2. 上传并部署「publishRequest」云函数\n\n如果集合已存在，请检查安全规则是否允许前端写入",
          showCancel: false
        });
      });
    });
  },

  formatDateShort: function(d) {
    if (!d) return "";
    try {
      var date = new Date(d);
      if (isNaN(date.getTime())) return "";
      return (date.getMonth() + 1) + "月" + date.getDate() + "日";
    } catch(e) { return ""; }
  },
  callPassenger: function(e) {
    var phone = e.currentTarget.dataset.phone;
    if (phone) { wx.makePhoneCall({ phoneNumber: phone }); }
  },
  loadRequests: function() {
    var that = this;
    api.callFunctionSilent("searchRequests", { page: 1, pageSize: 50 }).then(function(data) {
      that.setData({ passengerRequests: data.list || [] });
    }).catch(function() {});
  },
  goDetail: function(e) {
    wx.navigateTo({ url: "/miniprogram/pages/detail/detail?id=" + e.currentTarget.dataset.id });
  }
});
