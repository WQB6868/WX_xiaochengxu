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

    return { code: 0, data: { status: "confirmed" } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
