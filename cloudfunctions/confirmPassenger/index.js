const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var tripId = event.tripId;
    var passengerId = event.passengerOpenId;
    var action = event.action; // agree | confirm | reject
    
    var trip = await db.collection("trips").doc(tripId).get();
    if (!trip.data) return { code: 2001, message: "行程不存在" };
    var t = trip.data;
    if (t._openid !== OPENID) return { code: 1004, message: "无权限" };
    
    var passengers = t.passengers || [];
    var idx = passengers.findIndex(function(p) { return p._openid === passengerId; });
    if (idx === -1) return { code: 1001, message: "未找到乘客申请" };
    
    var currentTime = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    
    if (action === "agree") {
      // Owner agrees to communicate -> reveal phone numbers
      passengers[idx].agreeTime = db.serverDate();
      passengers[idx].status = "communicating";
      await db.collection("trips").doc(tripId).update({
        data: { passengers: passengers }
      });
      await db.collection("applications").where({
        tripId: tripId,
        passengerOpenId: passengerId
      }).update({
        data: { status: "communicating", agreeTime: db.serverDate(), updateTime: db.serverDate() }
      });
      // Record in phone_view_logs for traceability
      try {
        await db.collection("phone_view_logs").add({
          data: {
            tripId: tripId,
            viewerOpenId: passengerId,
            targetOpenId: OPENID,
            action: "agree_communicate",
            createTime: db.serverDate()
          }
        });
      } catch(e) {}
      // Send notification
      try {
        var routeName = (t.from && t.from.city || "") + "→" + (t.to && t.to.city || "");
        await cloud.openapi.subscribeMessage.send({
          touser: passengerId,
          templateId: "pgweCWotwr_vH1PwycKeRNtUuRHHD3WJ0DEcmX_pSZc",
          page: "pages/detail/detail?id=" + tripId,
          data: {
            thing15: { value: routeName + " 拼车申请" },
            phrase1: { value: "已同意沟通" },
            thing7: { value: "车主已同意与你沟通，联系方式已互相可见" },
            time13: { value: currentTime }
          }
        });
      } catch(e) { console.log("sendMsg error:", e); }
    } else if (action === "confirm") {
      passengers[idx].status = "confirmed";
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
      await db.collection("applications").where({
        tripId: tripId,
        passengerOpenId: passengerId
      }).update({
        data: { status: "confirmed", updateTime: db.serverDate() }
      });
      // Send notification
      try {
        var routeName2 = (t.from && t.from.city || "") + "→" + (t.to && t.to.city || "");
        await cloud.openapi.subscribeMessage.send({
          touser: passengerId,
          templateId: "pgweCWotwr_vH1PwycKeRNtUuRHHD3WJ0DEcmX_pSZc",
          page: "pages/detail/detail?id=" + tripId,
          data: {
            thing15: { value: routeName2 + " 拼车申请" },
            phrase1: { value: "已通过" },
            thing7: { value: "车主已确认你同行，请准时出发" },
            time13: { value: currentTime }
          }
        });
      } catch(e) { console.log("sendMsg error:", e); }
    } else {
      passengers[idx].status = "rejected";
      passengers[idx].reason = event.rejectReason || "";
      await db.collection("trips").doc(tripId).update({
        data: { passengers: passengers }
      });
      await db.collection("applications").where({
        tripId: tripId,
        passengerOpenId: passengerId
      }).update({
        data: { status: "rejected", rejectReason: event.rejectReason || "", updateTime: db.serverDate() }
      });
      // Send notification
      try {
        var routeName3 = (t.from && t.from.city || "") + "→" + (t.to && t.to.city || "");
        await cloud.openapi.subscribeMessage.send({
          touser: passengerId,
          templateId: "pgweCWotwr_vH1PwycKeRNtUuRHHD3WJ0DEcmX_pSZc",
          page: "pages/detail/detail?id=" + tripId,
          data: {
            thing15: { value: routeName3 + " 拼车申请" },
            phrase1: { value: "未通过" },
            thing7: { value: "车主已拒绝你的申请" },
            time13: { value: currentTime }
          }
        });
      } catch(e) { console.log("sendMsg error:", e); }
    }

    return { code: 0, data: { status: action === "confirm" ? "confirmed" : (action === "agree" ? "communicating" : "rejected") } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
