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