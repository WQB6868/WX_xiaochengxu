const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async function(event, context) {
  const { OPENID } = cloud.getWXContext();
  try {
    var tripId = event.tripId;
    var passengerId = event.passengerOpenId;
    var action = event.action; // confirm | reject
    
    var trip = await db.collection("trips").doc(tripId).get();
    if (!trip.data) return { code: 2001, message: "行程不存在" };
    var t = trip.data;
    if (t._openid !== OPENID) return { code: 1004, message: "无权限" };
    
    var passengers = t.passengers || [];
    var idx = passengers.findIndex(function(p) { return p._openid === passengerId; });
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
      await db.collection("applications").where({
        tripId: tripId,
        passengerOpenId: passengerId
      }).update({
        data: { status: "confirmed", updateTime: db.serverDate() }
      });
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
    }
    return { code: 0, data: { status: action === "confirm" ? "confirmed" : "rejected" } };
  } catch (err) {
    return { code: 4001, message: err.message };
  }
};
