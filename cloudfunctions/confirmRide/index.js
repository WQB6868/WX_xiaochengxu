const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var tripId = event.tripId;
    var trip = await db.collection("trips").doc(tripId).get();
    if (!trip.data) return { code: 2001, message: "行程不存在" };
    var t = trip.data;

    // Owner confirm/reject a passenger
    var passengerOpenId = event.passengerOpenId;
    var action = event.action;
    
    if (passengerOpenId && t._openid === OPENID) {
      // This is owner action: confirm or reject a specific passenger
      if (action !== "confirm" && action !== "reject") {
        return { code: 1001, message: "无效操作" };
      }
      var passengers = t.passengers || [];
      var idx = passengers.findIndex(function(p) { return p._openid === passengerOpenId; });
      if (idx === -1) return { code: 1001, message: "未找到乘客申请" };

      if (action === "confirm") {
        passengers[idx].status = "confirmed";
        // Send notification to passenger
        try {
          var routeName3 = (t.from && t.from.city || "") + "→" + (t.to && t.to.city || "");
          await cloud.openapi.subscribeMessage.send({
            touser: passengerOpenId,
            templateId: "pgweCWotwr_vH1PwycKeRNtUuRHHD3WJ0DEcmX_pSZc",
            page: "pages/detail/detail?id=" + tripId,
            data: {
              thing15: { value: routeName3 + " 拼车申请" },
              phrase1: { value: "已通过" },
              thing7: { value: "车主已确认你同行，请及时出发" },
              time13: { value: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) }
            }
          });
        } catch(e) { console.log("sendMsg error:", e); }
        passengers[idx].confirmTime = db.serverDate();
        var addCount = passengers[idx].passengerCount || 1;
        var newCount = (t.passengerCount || 0) + addCount;
        var updateData = {
          passengers: passengers,
          passengerCount: newCount
        };
        if (newCount >= t.seats) {
          updateData.status = "full";
        }
        await db.collection("trips").doc(tripId).update({ data: updateData });
        try {
          await db.collection("applications").where({
            tripId: tripId,
            passengerOpenId: passengerOpenId
          }).update({
            data: { status: "confirmed", updateTime: db.serverDate() }
          });
        } catch(e) {}
      } else {
        // Send notification to passenger
        try {
          var routeName2 = (t.from && t.from.city || "") + "→" + (t.to && t.to.city || "");
          await cloud.openapi.subscribeMessage.send({
            touser: passengerOpenId,
            templateId: "pgweCWotwr_vH1PwycKeRNtUuRHHD3WJ0DEcmX_pSZc",
            page: "pages/detail/detail?id=" + tripId,
            data: {
              thing15: { value: routeName2 + " 拼车申请" },
              phrase1: { value: "未通过" },
              thing7: { value: "车主已拒绝你的申请" },
              time13: { value: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) }
            }
          });
        } catch(e) { console.log("sendMsg error:", e); }
        passengers[idx].status = "rejected";
        passengers[idx].reason = event.rejectReason || "";
        await db.collection("trips").doc(tripId).update({
          data: { passengers: passengers }
        });
        try {
          await db.collection("applications").where({
            tripId: tripId,
            passengerOpenId: passengerOpenId
          }).update({
            data: { status: "rejected", rejectReason: event.rejectReason || "", updateTime: db.serverDate() }
          });
        } catch(e) {}
      }
      return { code: 0, data: { status: action === "confirm" ? "confirmed" : "rejected" } };
    }
    // Passenger self-confirm (original behavior)
    if (t.passengerCount >= t.seats) return { code: 2002, message: "座位已满" };
    var passengers = t.passengers || [];
    var idx = passengers.findIndex(function(p) { return p._openid === OPENID; });
    
    if (idx >= 0 && passengers[idx].status === "confirmed") {
      return { code: 0, data: { status: "confirmed" } };
    }
    var user = await db.collection("users").doc(OPENID).get();
    var userData = user.data || {};
    var entry = {
      _openid: OPENID,
      nickname: userData.nickName || "",
      avatarUrl: userData.avatarUrl || "",
      phone: userData.phone || "",
      status: "confirmed",
      applyTime: db.serverDate(),
      confirmTime: db.serverDate()
    };
    if (idx >= 0) {
      passengers[idx] = entry;
    } else {
      passengers.push(entry);
    }
    var newCount = passengers.filter(function(p) { return p.status === "confirmed"; }).length;
    await db.collection("trips").doc(tripId).update({
      data: { passengers: passengers, passengerCount: newCount }
    });

    // Send notification to owner about passenger confirmation
    try {
      var routeName = (t.from && t.from.city || "") + "→" + (t.to && t.to.city || "");
      await cloud.openapi.subscribeMessage.send({
        touser: t._openid,
        templateId: "pgweCWotwr_vH1PwycKeRNtUuRHHD3WJ0DEcmX_pSZc",
        page: "pages/detail/detail?id=" + tripId,
        data: {
              thing15: { value: routeName + " 同行确认" },
              phrase1: { value: "已确认" },
              thing7: { value: "乘客已确认同行，请查看行程详情" },
              time13: { value: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) }
            }
          });
    } catch(e) { console.log("sendMsg error:", e); }
    // Update the request status if this passenger was invited from a request
    try {
      await db.collection("requests").where({
        _openid: OPENID,
        status: "invited",
        invitedTripId: tripId
      }).update({
        data: { status: "confirmed", updateTime: db.serverDate() }
      });
    } catch(e) {}

    return { code: 0, data: { status: "confirmed" } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
