const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var tripId = event.tripId;
    var phone = event.phone || "";
    var passengerCount = parseInt(event.passengerCount) || 1;
    
    var trip = await db.collection("trips").doc(tripId).get();
    if (!trip.data) return { code: 2001, message: "行程不存在" };
    var t = trip.data;
    if (t.status !== "recruiting") return { code: 2003, message: "该行程已停止招募" };
    if (t._openid === OPENID) return { code: 3002, message: "不能申请自己的行程" };
    var confirmedCount = (t.passengers || []).filter(function(p) { return p.status === "confirmed"; }).length;
    var pendingCount = (t.passengers || []).filter(function(p) { return p.status === "pending"; }).length;
    var takenSeats = confirmedCount + pendingCount;
    if (takenSeats >= t.seats) return { code: 2002, message: "座位已满" };
    if (takenSeats + passengerCount > t.seats) return { code: 2002, message: "剩余座位不足" };
    
    var existing = (t.passengers || []).find(function(p) { return p._openid === OPENID; });
    if (existing && existing.status !== "rejected" && existing.status !== "cancelled") {
      return { code: 3001, message: "您已申请过该行程" };
    }
    
    var user = await db.collection("users").doc(OPENID).get();
    var userData = user.data || {};
    
    // Save phone to user profile if not exists
    if (phone && !userData.phone) {
      await db.collection("users").doc(OPENID).update({
        data: { phone: phone }
      });
    }
    
    var passengerEntry = {
      _openid: OPENID,
      nickname: userData.nickName || "",
      avatarUrl: userData.avatarUrl || "",
      phone: phone || userData.phone || "",
      passengerCount: passengerCount,
      status: "pending",
      applyTime: db.serverDate(),
      agreeTime: null,
      confirmTime: null,
      cancelTime: null,
      reason: ""
    };
    
    if (existing) {
      // Update existing entry (reapply after rejection/cancellation)
      var passengers = t.passengers || [];
      var idx = passengers.findIndex(function(p) { return p._openid === OPENID; });
      passengers[idx] = passengerEntry;
      await db.collection("trips").doc(tripId).update({
        data: { passengers: passengers }
      });
      await db.collection("applications").where({
        tripId: tripId,
        passengerOpenId: OPENID
      }).update({
        data: { status: "pending", updateTime: db.serverDate() }
      });
    } else {
      // New application
      await db.collection("trips").doc(tripId).update({
        data: { "passengers": _.push(passengerEntry) }
      });
      await db.collection("applications").add({
        data: {
          tripId: tripId,
          driverOpenId: t._openid,
          passengerOpenId: OPENID,
          tripInfo: {
            from: { city: t.from.city, address: t.from.address },
            to: { city: t.to.city, address: t.to.address },
            departDate: t.departDate,
            departTime: t.departTime,
            price: t.price
          },
          passengerInfo: {
            nickName: userData.nickName || "",
            avatarUrl: userData.avatarUrl || "",
            phone: phone || userData.phone || "",
            passengerCount: passengerCount
          },
          status: "pending",
          message: event.message || "",
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
    }
    
    // 发送订阅消息通知车主
    try {
      var routeName = (t.from && t.from.city || "") + "→" + (t.to && t.to.city || "");
      var now = new Date();
      var timeStr = now.getFullYear() + "-" + (now.getMonth()+1).toString().padStart(2,"0") + "-" + now.getDate().toString().padStart(2,"0") + " " + now.getHours().toString().padStart(2,"0") + ":" + now.getMinutes().toString().padStart(2,"0");
      await cloud.openapi.subscribeMessage.send({
        touser: t._openid,
        templateId: "UE8ZZtN4_r999dwfncBoEV0ui5hI1mEg6kJxdWdkLtw",
        page: "pages/detail/detail?id=" + tripId,
        data: {
          thing6: { value: routeName + " 拼车" },
          time4: { value: timeStr },
          phrase5: { value: "已申请" },
          thing22: { value: (userData.nickName || "乘客") + " 申请加入你的行程，请及时处理" }
        }
      });
    } catch(e) { console.log("sendMsg error:", e); }

    return { code: 0, data: { status: "pending" } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
